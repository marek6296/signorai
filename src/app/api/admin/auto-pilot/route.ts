import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { discoverNewNews } from "@/lib/discovery-logic";

export const runtime = "nodejs";
export const maxDuration = 300; // Increased to 5 minutes for parallel article generation
export const dynamic = 'force-dynamic';

interface AutopilotItem {
    id: string;
    url: string;
    category?: string;
    title: string;
    publishedAt?: string;
}

export async function GET(request: NextRequest) {
    return handleAutopilot(request, 'automated');
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return handleAutopilot(request, body.mode || 'manual', body.secret);
}

async function handleAutopilot(request: NextRequest, mode: 'automated' | 'manual', providedSecret?: string) {
    const isVercelCron = request.headers.get("x-vercel-cron") === "1";
    console.log(`>>> [Autopilot] Starting mode: ${mode} (Vercel Cron: ${isVercelCron})`);

    try {
        const secret = providedSecret || request.nextUrl.searchParams.get('secret') || request.headers.get('x-api-key');

        if (secret !== process.env.ADMIN_SECRET && secret !== 'make-com-webhook-secret' && !isVercelCron) {
            console.warn(`>>> [Autopilot] Unauthorized attempt (Mode: ${mode}, Secret Provided: ${!!secret})`);
            return NextResponse.json({ message: "Invalid token" }, { status: 401 });
        }

        const { data: settings, error: settingsError } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'auto_pilot')
            .single();

        if (settingsError || !settings) {
            console.error(">>> [Autopilot] Settings fetch error:", settingsError);
            return NextResponse.json({ message: "Could not fetch autopilot settings" }, { status: 500 });
        }

        const autopilotEnabled = settings.value.enabled;
        let itemsToProcess: AutopilotItem[] = [];

        console.log(`>>> [Autopilot] Logic branch for mode: ${mode}`);

        if (mode === 'automated') {
            if (!autopilotEnabled) {
                console.log(">>> [Autopilot] Automated run skipped (disabled)");
                return NextResponse.json({ message: "Autopilot is disabled in settings" });
            }

            const freshNews = await discoverNewNews(1);
            console.log(`>>> [Autopilot] Discovered ${freshNews.length} fresh items`);

            if (freshNews.length === 0) {
                return NextResponse.json({ message: "No fresh news found for autopilot run", count: 0 });
            }

            const { data: inserted, error: insertError } = await supabase
                .from('suggested_news')
                .insert(freshNews)
                .select();

            if (insertError) {
                if (insertError.message.includes('unique')) {
                    console.log(">>> [Autopilot] All items were duplicates");
                    return NextResponse.json({ message: "No new unique news discovered today", count: 0 });
                }
                throw insertError;
            }

            const insertedItems = inserted as AutopilotItem[];
            const categoriesMap = new Map();
            freshNews.forEach(newsItem => {
                const cat = newsItem.category || "AI";
                if (!categoriesMap.has(cat)) {
                    const match = insertedItems.find(i => i.url === newsItem.url);
                    if (match) categoriesMap.set(cat, match);
                }
            });
            itemsToProcess = Array.from(categoriesMap.values());

        } else {
            // MANUAL MODE - processes EXISTING pending suggestions
            console.log(">>> [Autopilot] Manual mode: Fetching pending suggestions");
            const { data: suggestions, error: suggestionsError } = await supabase
                .from('suggested_news')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (suggestionsError) throw suggestionsError;

            console.log(`>>> [Autopilot] Found ${suggestions?.length || 0} pending suggestions`);

            if (!suggestions || suggestions.length === 0) {
                return NextResponse.json({ message: "Nenašli sa žiadne navrhované témy. Najprv spusti objavovanie správ.", count: 0 });
            }

            const categoriesMap = new Map();
            suggestions.forEach(item => {
                const cat = item.category || "AI";
                if (!categoriesMap.has(cat)) {
                    categoriesMap.set(cat, item);
                }
            });
            itemsToProcess = Array.from(categoriesMap.values());
            console.log(`>>> [Autopilot] Selected ${itemsToProcess.length} unique categories to process`);
        }

        if (itemsToProcess.length === 0) {
            return NextResponse.json({ message: "Žiadne články na spracovanie", count: 0 });
        }

        const limitedItems = itemsToProcess.slice(0, 15);
        console.log(`>>> [Autopilot] Starting parallel processing for ${limitedItems.length} articles`);

        const { processArticleFromUrl } = await import("../../../../lib/generate-logic");

        const results = await Promise.allSettled(limitedItems.map(async (item) => {
            console.log(`>>> [Autopilot] Processing article: ${item.url} (${item.category})`);
            const article = await processArticleFromUrl(item.url, 'published', item.category);
            await supabase.from('suggested_news').update({ status: 'processed' }).eq('id', item.id);
            return { item, article };
        }));

        let successCount = 0;
        results.forEach((r, idx) => {
            if (r.status === 'fulfilled') {
                successCount++;
                console.log(`>>> [Autopilot] Successfully processed: ${limitedItems[idx].url}`);
            } else {
                console.error(`>>> [Autopilot] Error processing ${limitedItems[idx].category}:`, r.reason);
            }
        });

        const newValue = {
            ...settings.value,
            last_run: new Date().toISOString(),
            processed_count: (settings.value.processed_count || 0) + successCount
        };

        await supabase
            .from('site_settings')
            .update({ value: newValue })
            .eq('key', 'auto_pilot');

        console.log(`>>> [Autopilot] Run finished. Success count: ${successCount}`);

        return NextResponse.json({
            success: true,
            message: mode === 'automated'
                ? `Autopilot: Spracovaných ${successCount} najnovších článkov z rôznych kategórií.`
                : `Manuálny beh dokončený. Spracovaných ${successCount} článkov.`,
            count: successCount
        });

    } catch (error: unknown) {
        console.error(">>> [Autopilot] CRITICAL ERROR:", error);
        return NextResponse.json({
            message: error instanceof Error ? error.message : "Internal server error"
        }, { status: 500 });
    }
}
