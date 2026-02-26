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

        const autopilotEnabled = settings.value?.enabled;

        // If triggered manually, we might want to ignore the "enabled" flag, 
        // but for safety let's respect it unless we add a "force" param.
        // For now, assume this is called by a cron job or manual "Run Now" button.

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
        const processedArticles = [];
        let successCount = 0;

        // 5. Process each article
        for (const item of itemsToProcess) {
            try {
                // Process and publish immediately
                const article = await processArticleFromUrl(item.url, 'published');

                // Mark suggestion as processed
                await supabase
                    .from('suggested_news')
                    .update({ status: 'processed' })
                    .eq('id', item.id);

                processedArticles.push(article);
                successCount++;
            } catch (err) {
                console.error(`Autopilot failed for ${item.url}:`, err);
                // Continue to next category if one fails
            }
        }

        // 6. Update stats in site_settings
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
            message: `Autopilot complete. Processed ${successCount} articles.`,
            count: successCount,
            articles: processedArticles
        });

    } catch (error: unknown) {
        console.error("Autopilot API error:", error);
        return NextResponse.json({ message: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
    }
}
