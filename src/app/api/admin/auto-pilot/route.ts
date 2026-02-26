import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { processArticleFromUrl } from "@/lib/generate-logic";
import { discoverNewNews } from "@/lib/discovery-logic";

export async function POST(request: NextRequest) {
    try {
        const { secret, mode } = await request.json();

        // 1. Authorization
        if (secret !== process.env.ADMIN_SECRET) {
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

        let itemsToProcess: any[] = [];

        if (mode === 'automated') {
            // AUTOMATED CRON MODE
            if (!autopilotEnabled) {
                return NextResponse.json({ message: "Autopilot is disabled in settings" });
            }

            // A. Discover fresh news from last 1 day
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
            const categoriesMap = new Map();
            (inserted || []).forEach(item => {
                const cat = item.category || "Umelá Inteligencia";
                if (!categoriesMap.has(cat)) {
                    categoriesMap.set(cat, item);
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
        const results = await Promise.allSettled(itemsToProcess.map(async (item) => {
            const article = await processArticleFromUrl(item.url, 'published', item.category);
            await supabase.from('suggested_news').update({ status: 'processed' }).eq('id', item.id);
            return { item, article };
        }));

        results.forEach((r, idx) => {
            if (r.status === 'rejected') {
                console.error(`Autopilot error processing category ${itemsToProcess[idx].category} (url: ${itemsToProcess[idx].url}):`, r.reason);
                // Also update the status to 'ignored' or something so it doesn't block forever, wait, let's keep it 'pending' so it retries, or maybe that's why it's stuck.
            }
        });

        const successCount = results.filter(r => r.status === 'fulfilled').length;

        // 6. Update stats (KEEP enabled status as it was)
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
                ? `Automatický beh dokončený. Spracovaných ${successCount} nových článkov.`
                : `Manuálny beh dokončený. Spracovaných ${successCount} článkov z pripravených tém.`,
            count: successCount
        });

    } catch (error: unknown) {
        console.error("Autopilot API error:", error);
        return NextResponse.json({ message: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
    }
}
