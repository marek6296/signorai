import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { discoverNewNews } from "@/lib/discovery-logic";
import { processArticleFromUrl } from "@/lib/generate-logic";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const LEGACY_SECRET = "make-com-webhook-secret";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const force = url.searchParams.get("force") === "true";

    if (secret !== process.env.ADMIN_SECRET && secret !== LEGACY_SECRET) {
        return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
    }

    try {
        // 1. Fetch Bot Settings
        const { data: settingsData, error: settingsError } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'social_bot')
            .single();

        if (settingsError || !settingsData) {
            return NextResponse.json({ message: "Bot settings not found" }, { status: 404 });
        }

        const settings = settingsData.value;
        if (!settings.enabled && !force) {
            return NextResponse.json({ message: "Bot is disabled" });
        }

        // 2. Time Check (unless forced)
        if (!force && settings.posting_times && settings.posting_times.length > 0) {
            const now = new Date();
            // Get time in Europe/Bratislava (approximate via offset or just UTC if simplified, but let's try to be smart)
            const bratislavaTime = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/Bratislava',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(now);

            console.log(`>>> [Bot] Current Bratislava Time: ${bratislavaTime}`);

            const isTime = settings.posting_times.some((t: string) => {
                const [h, m] = t.split(':').map(Number);
                const [currH, currM] = bratislavaTime.split(':').map(Number);

                // 30 minute window
                const diff = (currH * 60 + currM) - (h * 60 + m);
                return diff >= 0 && diff < 30;
            });

            if (!isTime) {
                return NextResponse.json({ message: "Not a scheduled time window", currentTime: bratislavaTime });
            }
        }

        // 3. Category Selection
        const categories = settings.target_categories || ["Umelá Inteligencia"];
        const category = categories[Math.floor(Math.random() * categories.length)];

        console.log(`>>> [Bot] Starting automation for category: ${category}`);

        // 4. Discovery
        const foundItems = await discoverNewNews(3, [category]);
        if (foundItems.length === 0) {
            return NextResponse.json({ message: `No new items found for ${category}` });
        }

        // 5. Filter for Freshness
        const { data: latestArticles } = await supabase.from("articles").select("source_url");
        const existingUrls = (latestArticles || []).map(a => (a.source_url || "").trim().toLowerCase());

        const freshItems = foundItems.filter((item) => {
            const url = (item.url || "").trim().toLowerCase();
            return url && !existingUrls.includes(url);
        });

        if (freshItems.length === 0) {
            return NextResponse.json({ message: "All discovered items are already processed" });
        }

        const target = freshItems[0];
        console.log(`>>> [Bot] Selected target: ${target.title} (${target.url})`);

        // 6. Generate Article
        const article = await processArticleFromUrl(target.url, 'published', category);
        console.log(`>>> [Bot] Article generated: ${article.id}`);

        // 7. Generate Social Posts (using existing autopilot route logic or calling it)
        const currentHost = req.headers.get("host") || "postovinky.news";
        const protocol = currentHost.includes("localhost") ? "http" : "https";

        const autopilotRes = await fetch(`${protocol}://${currentHost}/api/admin/social-autopilot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                articleId: article.id,
                platforms: ['Facebook', 'Instagram'],
                secret: LEGACY_SECRET,
                autoPublish: true
            })
        });

        const autopilotData = await autopilotRes.json();
        console.log(`>>> [Bot] Social Autopilot finished:`, autopilotData);

        return NextResponse.json({
            success: true,
            article: article.title,
            social: autopilotData
        });

    } catch (error: any) {
        console.error(">>> [Bot] CRITICAL ERROR:", error);
        return NextResponse.json({
            error: true,
            message: error.message || "Internal server error"
        }, { status: 500 });
    }
}
