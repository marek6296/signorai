import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { processArticleFromUrl } from "@/lib/generate-logic";
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
    try {
        const secret = providedSecret || request.nextUrl.searchParams.get('secret') || request.headers.get('x-api-key');

        // 1. Authorization
        if (secret !== process.env.ADMIN_SECRET && secret !== 'make-com-webhook-secret') {
            return NextResponse.json({ message: "Invalid token" }, { status: 401 });
        }

        // 2. Check site settings
        const { data: settings, error: settingsError } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'auto_pilot')
            .single();

        if (settingsError || !settings) {
            return NextResponse.json({ message: "Could not fetch autopilot settings" }, { status: 500 });
        }

        const autopilotEnabled = settings.value.enabled;

        let itemsToProcess: AutopilotItem[] = [];

        if (mode === 'automated') {
            // AUTOMATED CRON MODE
            if (!autopilotEnabled) {
                return NextResponse.json({ message: "Autopilot is disabled in settings" });
            }

            // A. Discover fresh news from last 1 day (24 hours)
            // They are returned sorted by date DESC (newest first)
            const freshNews = await discoverNewNews(1);
            if (freshNews.length === 0) {
                return NextResponse.json({ message: "No fresh news found for autopilot run", count: 0 });
            }

            // B. Insert them as suggested_news first (to maintain history and URL tracking)
            const { data: inserted, error: insertError } = await supabase
                .from('suggested_news')
                .insert(freshNews)
                .select();

            if (insertError) {
                // If all are duplicates (unique constraint), just finish
                if (insertError.message.includes('unique')) {
                    return NextResponse.json({ message: "No new unique news discovered today", count: 0 });
                }
                throw insertError;
            }

            // C. Pick one per category from the NEWLY discovered items
            // Since freshNews was sorted DESC, we pick the first occurrence in the result
            const insertedItems = inserted as AutopilotItem[];
            const categoriesMap = new Map();

            // We iterate through freshNews to preserve the chronological order
            freshNews.forEach(newsItem => {
                const cat = newsItem.category || "Umelá Inteligencia";
                if (!categoriesMap.has(cat)) {
                    // Find the corresponding inserted ID
                    const match = insertedItems.find(i => i.url === newsItem.url);
                    if (match) {
                        categoriesMap.set(cat, match);
                    }
                }
            });
            itemsToProcess = Array.from(categoriesMap.values());

        } else {
            // MANUAL TRIGGER MODE (from UI) - uses EXISTING suggestions
            const { data: suggestions, error: suggestionsError } = await supabase
                .from('suggested_news')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (suggestionsError) throw suggestionsError;

            if (!suggestions || suggestions.length === 0) {
                return NextResponse.json({ message: "Nenašli sa žiadne navrhované témy. Najprv spusti objavovanie správ.", count: 0 });
            }

            const categoriesMap = new Map();
            suggestions.forEach(item => {
                const cat = item.category || "Umelá Inteligencia";
                if (!categoriesMap.has(cat)) {
                    categoriesMap.set(cat, item);
                }
            });
            itemsToProcess = Array.from(categoriesMap.values());
        }

        if (itemsToProcess.length === 0) {
            return NextResponse.json({ message: "Žiadne články na spracovanie", count: 0 });
        }

        // 5. Process articles in parallel
        // We limit to max 12 categories to avoid overloading
        const limitedItems = itemsToProcess.slice(0, 15);

        const results = await Promise.allSettled(limitedItems.map(async (item) => {
            // processArticleFromUrl will scrape, translate, and INSERT as published
            const article = await processArticleFromUrl(item.url, 'published', item.category);
            // Mark suggestion as processed
            await supabase.from('suggested_news').update({ status: 'processed' }).eq('id', item.id);
            return { item, article };
        }));

        let successCount = 0;
        results.forEach((r, idx) => {
            if (r.status === 'fulfilled') {
                successCount++;
            } else {
                console.error(`Autopilot error processing ${limitedItems[idx].category}:`, r.reason);
            }
        });

        // 6. Update stats
        const newValue = {
            ...settings.value,
            last_run: new Date().toISOString(),
            processed_count: (settings.value.processed_count || 0) + successCount
        };

        await supabase
            .from('site_settings')
            .update({ value: newValue })
            .eq('key', 'auto_pilot');

        return NextResponse.json({
            success: true,
            message: mode === 'automated'
                ? `Autopilot: Spracovaných ${successCount} najnovších článkov z rôznych kategórií.`
                : `Manuálny beh dokončený. Spracovaných ${successCount} článkov.`,
            count: successCount
        });

    } catch (error: unknown) {
        console.error("Autopilot API error:", error);
        return NextResponse.json({
            message: error instanceof Error ? error.message : "Internal server error"
        }, { status: 500 });
    }
}
