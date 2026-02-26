import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { processArticleFromUrl } from "@/lib/generate-logic";

export async function POST(request: NextRequest) {
    try {
        const { secret } = await request.json();

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

        // 3. Get pending suggestions grouped by category
        const { data: suggestions, error: suggestionsError } = await supabase
            .from('suggested_news')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (suggestionsError) {
            return NextResponse.json({ message: "Could not fetch suggestions" }, { status: 500 });
        }

        if (!suggestions || suggestions.length === 0) {
            // Even if no suggestions, we should turn off the autopilot if it was "on" for a run
            const newValue = {
                ...settings.value,
                enabled: false,
                last_run: new Date().toISOString()
            };
            await supabase.from('site_settings').update({ value: newValue }).eq('key', 'auto_pilot');
            return NextResponse.json({ message: "No pending suggestions found", count: 0 });
        }

        // 4. Logic: Pick one suggestion per available category
        const categoriesMap = new Map();
        suggestions.forEach(item => {
            const cat = item.category || "Umelá Inteligencia";
            if (!categoriesMap.has(cat)) {
                categoriesMap.set(cat, item);
            }
        });

        const itemsToProcess = Array.from(categoriesMap.values());

        // 5. Process articles in parallel
        const results = await Promise.allSettled(itemsToProcess.map(async (item) => {
            const article = await processArticleFromUrl(item.url, 'published');
            await supabase.from('suggested_news').update({ status: 'processed' }).eq('id', item.id);
            return article;
        }));

        const successCount = results.filter(r => r.status === 'fulfilled').length;

        // 6. Update stats and DISABLE autopilot (as per user request: "potom sa to vypne")
        const newValue = {
            ...settings.value,
            enabled: false, // Turn off after processing
            last_run: new Date().toISOString(),
            processed_count: (settings.value.processed_count || 0) + successCount
        };

        await supabase
            .from('site_settings')
            .update({ value: newValue })
            .eq('key', 'auto_pilot');

        return NextResponse.json({
            success: true,
            message: `Autopilot dokončený. Spracovaných ${successCount} článkov. Autopilot bol následne vypnutý.`,
            count: successCount
        });

    } catch (error: unknown) {
        console.error("Autopilot API error:", error);
        return NextResponse.json({ message: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
    }
}
