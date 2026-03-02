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
    const authHeader = req.headers.get("authorization");
    const headerSecret = authHeader ? authHeader.replace("Bearer ", "").trim() : null;
    const customHeaderSecret = req.headers.get("x-bot-secret");
    const secret = url.searchParams.get("secret") || customHeaderSecret || headerSecret;
    const force = url.searchParams.get("force") === "true";
    const ignoreTime = url.searchParams.get("ignoreTime") === "true";
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";

    console.log(`>>> [Bot] Request received. Cron Header: ${isVercelCron}, Force: ${force}, IgnoreTime: ${ignoreTime}`);

    // Auth check: allow if secret matches OR if it's a legitimate Vercel Cron request
    if (secret !== process.env.ADMIN_SECRET && secret !== LEGACY_SECRET && !isVercelCron) {
        console.warn(">>> [Bot] Unauthorized attempt (Invalid secret and not a Vercel Cron)");
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

        // 2. Time Check (unless forced or ignoreTime is set)
        if (!force && !ignoreTime && settings.posting_times && settings.posting_times.length > 0) {
            const now = new Date();
            const bratislavaTime = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/Bratislava',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(now);

            console.log(`>>> [Bot] Current Bratislava Time: ${bratislavaTime}`);

            const [currH, currM] = bratislavaTime.split(':').map(Number);
            const currTotalMinutes = currH * 60 + currM;

            // GitHub action now runs every hour, but might be delayed by 10-45 mins.
            // Alebo používateľ testuje manuálne.
            // Overíme, či aktuálny čas neubehol viac než 59 minút po naplánovanom čase.
            const isTime = settings.posting_times.some((t: string) => {
                const [h, m] = t.split(':').map(Number);
                const scheduledTotalMinutes = h * 60 + (m || 0);

                let diff = currTotalMinutes - scheduledTotalMinutes;
                // Prechod cez polnoc
                if (diff < -12 * 60) {
                    diff += 24 * 60;
                }

                return diff >= 0 && diff < 59;
            });

            // Double run protection: If we are in a valid window, check when we last succeeded.
            if (isTime) {
                const lastRunDate = settings.last_run ? new Date(settings.last_run) : null;
                if (lastRunDate) {
                    const diffMs = now.getTime() - lastRunDate.getTime();
                    const diffMins = diffMs / (1000 * 60);

                    // ak bežal úspešne pred menej ako 55 minútami, v tej istej hodine už druhýkrát nepôjde
                    if (diffMins < 55 && settings.last_status?.includes("Úspešne publikované")) {
                        console.log(`>>> [Bot] Skipping: Already run successfully ${Math.round(diffMins)} mins ago.`);
                        return NextResponse.json({ message: "Already run recently for this window", lastRun: settings.last_run });
                    }
                }
            } else {
                // Not in any scheduled window
                await supabase
                    .from('site_settings')
                    .update({ value: { ...settings, last_run: new Date().toISOString(), last_status: `Aktívny (Čakám na čas publikovania: ${settings.posting_times.join(', ')})` } })
                    .eq('key', 'social_bot');
                return NextResponse.json({ message: "Not a scheduled time window", currentTime: bratislavaTime, scheduled: settings.posting_times });
            }
        }

        // 3. Category Selection (Round Robin with Fallback)
        const categories = settings.target_categories && settings.target_categories.length > 0
            ? settings.target_categories
            : ["AI"];

        let startIndex = (settings.last_category_index !== undefined)
            ? (settings.last_category_index + 1) % categories.length
            : 0;

        // Safety: if categories changed and index is now invalid
        if (startIndex >= categories.length) startIndex = 0;

        // Fetch existing URLs once before the loop to optimize performance
        const { data: latestArticles } = await supabase.from("articles").select("source_url");
        const existingUrls = (latestArticles || []).map(a => (a.source_url || "").trim().toLowerCase());

        let targetCategory = "";
        let targetCategoryIndex = startIndex;
        let freshItems: { url: string; title: string; source: string; summary: string; category: string; status: string }[] = [];

        // Loop through all selected categories, starting intelligently from the next one in line
        for (let i = 0; i < categories.length; i++) {
            const currentIndex = (startIndex + i) % categories.length;
            const categoryToTry = categories[currentIndex];

            console.log(`>>> [Bot] Trying category (${i + 1}/${categories.length}): ${categoryToTry}`);
            await supabase.from('site_settings').update({
                value: { ...settings, last_status: `Aktívny (Hľadám novinky v sekcii ${categoryToTry}...)` }
            }).eq('key', 'social_bot');

            const foundItems = await discoverNewNews(5, [categoryToTry]); // fetch a bit more per category to increase chance of fresh content
            if (foundItems.length > 0) {
                // Filter for freshness
                const fresh = foundItems.filter((item) => {
                    const url = (item.url || "").trim().toLowerCase();
                    return url && !existingUrls.includes(url);
                });

                if (fresh.length > 0) {
                    freshItems = fresh;
                    targetCategory = categoryToTry;
                    targetCategoryIndex = currentIndex;
                    break; // Stop searching! We found fresh content in this category.
                }
            }
        }

        // Base settings to be saved whether we found an article or not
        const baseSettings = {
            ...settings,
            last_run: new Date().toISOString(),
            last_category_index: targetCategoryIndex // Always remember the last category we successfully processed or tried last
        };

        if (freshItems.length === 0) {
            await supabase
                .from('site_settings')
                .update({ value: { ...baseSettings, last_status: `Aktívny (Nenašli sa žiadne nespracované články v priradených kategóriách)` } })
                .eq('key', 'social_bot');
            return NextResponse.json({ message: "No fresh items found across all selected categories." });
        }

        const target = freshItems[0];
        console.log(`>>> [Bot] Selected target: ${target.title} (${target.url}) from category: ${targetCategory}`);

        // 6. Generate Article
        await supabase.from('site_settings').update({ value: { ...baseSettings, last_status: `Aktívny (Píšem článok: ${target.title}...)` } }).eq('key', 'social_bot');
        const article = await processArticleFromUrl(target.url, 'published', targetCategory);
        console.log(`>>> [Bot] Article generated: ${article.id}`);

        // 7. Generate Social Posts
        await supabase.from('site_settings').update({ value: { ...baseSettings, last_status: `Aktívny (Publikujem na sociálne siete...)` } }).eq('key', 'social_bot');

        const origin = req.nextUrl.origin;

        const autopilotRes = await fetch(`${origin}/api/admin/social-autopilot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                articleId: article.id,
                platforms: ['Facebook', 'Instagram'],
                secret: LEGACY_SECRET,
                autoPublish: true
            })
        });

        if (!autopilotRes.ok) {
            const errorText = await autopilotRes.text();
            throw new Error(`Social Autopilot failed (${autopilotRes.status}): ${errorText.substring(0, 50)}`);
        }

        const autopilotData = await autopilotRes.json();
        console.log(`>>> [Bot] Social Autopilot finished:`, autopilotData);

        const finalStatus = `Úspešne publikované: ${article.title}`;
        await supabase
            .from('site_settings')
            .update({ value: { ...baseSettings, last_status: finalStatus } })
            .eq('key', 'social_bot');

        return NextResponse.json({
            success: true,
            article: article.title,
            social: autopilotData,
            status: finalStatus
        });

    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : "Internal server error";
        console.error(">>> [Bot] CRITICAL ERROR:", error);

        // Log error even for settings
        try {
            const { data: currentSettings } = await supabase.from('site_settings').select('value').eq('key', 'social_bot').single();
            if (currentSettings) {
                await supabase
                    .from('site_settings')
                    .update({ value: { ...(currentSettings.value as object), last_run: new Date().toISOString(), last_status: `Chyba: ${errorMsg}` } })
                    .eq('key', 'social_bot');
            }
        } catch { }

        return NextResponse.json({
            error: true,
            message: errorMsg
        }, { status: 500 });
    }
}
