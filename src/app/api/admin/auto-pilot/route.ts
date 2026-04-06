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
  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    request.headers.get("x-vercel-cron") === "1"; // legacy fallback

  const secret =
    request.nextUrl.searchParams.get("secret") ||
    request.headers.get("x-api-key") ||
    request.headers.get("x-bot-secret");

  console.log(`>>> [AutoPilot] Triggered (Vercel Cron: ${isVercelCron}, secret: ${!!secret})`);

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

      // ── Social media posting ──────────────────────────────────────────────
      if (result.success && result.articleId) {
        let platforms: string[] = [];
        let imageFormat = "studio";
        let autoPublish = true;

        // Check workflow for social-poster module (new way)
        if (bot.workflow?.modules) {
          const socialModule = bot.workflow.modules.find(m => m.type === "social-poster");
          if (socialModule?.settings) {
            platforms = (socialModule.settings.platforms as string[]) || [];
            imageFormat = (socialModule.settings.imageFormat as string) || "studio";
            autoPublish = (socialModule.settings.autoPublish as boolean) ?? true;
          }
        }

        // Fallback to legacy config (old way) if no workflow module
        if (platforms.length === 0) {
          if (bot.post_instagram) platforms.push("Instagram");
          if (bot.post_facebook) platforms.push("Facebook");
          imageFormat = bot.instagram_format || "studio";
          autoPublish = bot.auto_publish_social ?? true;
        }

        // Post to social media if platforms configured
        if (platforms.length > 0) {
          try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aiwai.news";
            console.log(`>>> [AutoPilot] Posting to: ${platforms.join(", ")} for bot "${bot.name}"`);

            const socialRes = await fetch(`${siteUrl}/api/admin/social-autopilot`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                secret: process.env.ADMIN_SECRET || LEGACY_SECRET,
                articleId: result.articleId,
                platforms,
                instagramVariant: imageFormat,
                autoPublish,
              }),
            });

            if (socialRes.ok) {
              const socialData = await socialRes.json();
              console.log(`>>> [AutoPilot] ✅ Social posts successful for bot "${bot.name}":`, socialData.message);
              console.log(`>>> [AutoPilot] Posts saved:`, socialData.posts?.length || 0, `| Published:`, socialData.publishResults?.filter((r: any) => r.success).length || 0);
            } else {
              const errText = await socialRes.text().catch(() => "unknown");
              console.error(`>>> [AutoPilot] ❌ Social post failed for bot "${bot.name}": ${socialRes.status}`);
              console.error(`>>> [AutoPilot] Error details:`, errText.substring(0, 300));
            }
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error(`>>> [AutoPilot] ❌ Social post error for bot "${bot.name}":`, errorMsg);
            console.error(`>>> [AutoPilot] Stack:`, e instanceof Error ? e.stack?.substring(0, 200) : "N/A");
          }
        } else {
          console.log(`>>> [AutoPilot] ℹ️ No social platforms configured for bot "${bot.name}"`);
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
