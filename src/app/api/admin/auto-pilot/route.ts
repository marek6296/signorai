import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { runBotCycle, shouldBotRunNow, BotConfig } from "@/lib/bot-cycle";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const LEGACY_SECRET = "make-com-webhook-secret";

export async function GET(request: NextRequest) {
  return handleAutopilot(request);
}

export async function POST(request: NextRequest) {
  return handleAutopilot(request);
}

async function handleAutopilot(request: NextRequest) {
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const secret =
    request.nextUrl.searchParams.get("secret") ||
    request.headers.get("x-api-key") ||
    request.headers.get("x-bot-secret");

  console.log(`>>> [AutoPilot] Triggered (Vercel Cron: ${isVercelCron})`);

  // Auth
  if (
    secret !== process.env.ADMIN_SECRET &&
    secret !== LEGACY_SECRET &&
    !isVercelCron
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    // ── Read bots from site_settings ────────────────────────────────────────
    const { data: botsRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "bots")
      .single();

    let bots: BotConfig[] = [];
    if (botsRow?.value) {
      try {
        bots = typeof botsRow.value === "string" ? JSON.parse(botsRow.value) : botsRow.value;
      } catch {
        bots = [];
      }
    }

    console.log(`>>> [AutoPilot] Loaded ${bots.length} bots from DB`);

    // ── Determine which bots should run now ─────────────────────────────────
    const isManual = request.nextUrl.searchParams.get("manual") === "true";
    const forceBotId = request.nextUrl.searchParams.get("botId"); // optional: run specific bot

    const botsToRun = bots.filter((bot) => {
      if (!bot.enabled) return false;
      if (forceBotId) return bot.id === forceBotId;
      if (isManual) return true; // manual run: run all enabled bots
      return shouldBotRunNow(bot);
    });

    if (botsToRun.length === 0) {
      console.log(">>> [AutoPilot] No bots scheduled for this time slot.");
      return NextResponse.json({
        message: "Žiadne boty nie sú naplánované na tento čas.",
        botsChecked: bots.length,
        time: new Date().toISOString(),
      });
    }

    console.log(`>>> [AutoPilot] Running ${botsToRun.length} bot(s): ${botsToRun.map((b) => b.name).join(", ")}`);

    // ── Run each bot sequentially (avoid Vercel timeout on parallel) ────────
    const results: Array<{ botId: string; botName: string; success: boolean; articleId?: string; error?: string }> = [];

    for (const bot of botsToRun) {
      console.log(`>>> [AutoPilot] Starting bot: "${bot.name}"`);
      const result = await runBotCycle(bot);

      // Update bot stats in the bots array
      const now = new Date().toISOString();
      bots = bots.map((b) =>
        b.id === bot.id
          ? {
              ...b,
              last_run: now,
              processed_count: (b.processed_count || 0) + (result.success ? 1 : 0),
            }
          : b
      );

      results.push({
        botId: bot.id,
        botName: bot.name,
        success: result.success,
        articleId: result.articleId,
        error: result.error,
      });

      // ── For 'full' bots: also generate social post ────────────────────────
      if (bot.type === "full" && result.success && result.articleId) {
        const platforms: string[] = [];
        if (bot.post_instagram) platforms.push("instagram");
        if (bot.post_facebook) platforms.push("facebook");

        if (platforms.length > 0) {
          try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://postovinky.news";
            const socialRes = await fetch(`${siteUrl}/api/admin/generate-social-post`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                secret: process.env.ADMIN_SECRET || LEGACY_SECRET,
                articleId: result.articleId,
                platforms,
                instagramFormat: bot.instagram_format || "image_text",
                autoPublish: bot.auto_publish_social ?? true,
              }),
            });
            if (socialRes.ok) {
              console.log(`>>> [AutoPilot] Social post generated for bot "${bot.name}"`);
            } else {
              console.warn(`>>> [AutoPilot] Social post failed for bot "${bot.name}": ${socialRes.status}`);
            }
          } catch (e) {
            console.warn(`>>> [AutoPilot] Social post error for bot "${bot.name}":`, e);
          }
        }
      }
    }

    // ── Save updated bots back to site_settings ─────────────────────────────
    await supabase
      .from("site_settings")
      .upsert({ key: "bots", value: JSON.stringify(bots) }, { onConflict: "key" });

    // ── Also write legacy auto_pilot key for backward compat ────────────────
    const anySuccess = results.some((r) => r.success);
    if (anySuccess) {
      await supabase
        .from("site_settings")
        .upsert(
          { key: "auto_pilot", value: JSON.stringify({ enabled: true, last_run: new Date().toISOString() }) },
          { onConflict: "key" }
        );
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`>>> [AutoPilot] Done. ${successCount}/${botsToRun.length} bots succeeded.`);

    return NextResponse.json({
      success: true,
      message: `Spracovaných ${successCount} z ${botsToRun.length} botov.`,
      results,
      time: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(">>> [AutoPilot] CRITICAL ERROR:", msg);
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
