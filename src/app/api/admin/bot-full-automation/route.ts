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
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";

    console.log(`>>> [Bot] Request received. Cron Header: ${isVercelCron}, Force: ${force}`);

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

        // 2. Time Check (unless forced)
        if (!force && settings.posting_times && settings.posting_times.length > 0) {
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

            // Find the closest scheduled time that has passed but not been executed yet
            const isTime = settings.posting_times.some((t: string) => {
                const [h, m] = t.split(':').map(Number);
                const scheduledMinutes = h * 60 + m;

                // We allow a large window (e.g. 5 hours) but the 'last_run' will prevent double execution.
                // This ensures that if the cron runs 10 mins late, it still catches the window.
                const diff = currTotalMinutes - scheduledMinutes;

                // If the scheduled time is in the future but within the day, diff will be negative.
                // If the scheduled time was earlier today, diff is positive.
                return diff >= 0 && diff < 60; // 60 minute window for cron to catch it
            });

            // Double run protection: If we are in a valid window, check when we last succeeded.
            if (isTime) {
                const lastRunDate = settings.last_run ? new Date(settings.last_run) : null;
                if (lastRunDate) {
                    const diffMs = now.getTime() - lastRunDate.getTime();
                    const diffMins = diffMs / (1000 * 60);

                    // If we run successfully less than 70 minutes ago, don't run again in this window.
                    if (diffMins < 70 && settings.last_status?.includes("Úspešne publikované")) {
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

        // 3. Category Selection (Round Robin)
        const categories = settings.target_categories && settings.target_categories.length > 0
            ? settings.target_categories
            : ["AI"];

        let categoryIndex = (settings.last_category_index !== undefined)
            ? (settings.last_category_index + 1) % categories.length
            : 0;

        // Safety: if categories changed and index is now invalid
        if (categoryIndex >= categories.length) categoryIndex = 0;

        const category = categories[categoryIndex];

        // Prepare updated settings base
        const baseSettings = {
            ...settings,
            last_run: new Date().toISOString(),
            last_category_index: categoryIndex
        };

        console.log(`>>> [Bot] Starting automation for category: ${category}`);

        // 4. Discovery
        await supabase.from('site_settings').update({ value: { ...baseSettings, last_status: `Aktívny (Hľadám novinky v ${category}...)` } }).eq('key', 'social_bot');
        const foundItems = await discoverNewNews(3, [category]);
        if (foundItems.length === 0) {
            await supabase
                .from('site_settings')
                .update({ value: { ...baseSettings, last_status: `Aktívny (Žiadne nové správy v kategórii ${category})` } })
                .eq('key', 'social_bot');
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
            await supabase
                .from('site_settings')
                .update({ value: { ...baseSettings, last_status: `Aktívny (Všetky novinky v ${category} už boli spracované)` } })
                .eq('key', 'social_bot');
            return NextResponse.json({ message: "All discovered items are already processed" });
        }

        const target = freshItems[0];
        console.log(`>>> [Bot] Selected target: ${target.title} (${target.url})`);

        // 6. Generate Article
        await supabase.from('site_settings').update({ value: { ...baseSettings, last_status: `Aktívny (Píšem článok: ${target.title}...)` } }).eq('key', 'social_bot');
        const article = await processArticleFromUrl(target.url, 'published', category);
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
