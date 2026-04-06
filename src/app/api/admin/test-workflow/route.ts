import { NextRequest, NextResponse } from "next/server";
import { runBotCycle, BotConfig } from "@/lib/bot-cycle";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { bot } = await request.json() as { bot: BotConfig };

    if (!bot) {
      return NextResponse.json({ error: "Bot config required" }, { status: 400 });
    }

    // Create a progress stream response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const sendLog = (message: string, type: "info" | "success" | "error" | "progress" = "info") => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "log",
                  message,
                  logType: type,
                  timestamp: new Date().toISOString(),
                })}\n\n`
              )
            );
          };

          const sendStatus = (status: string, currentModule: string | null = null, progress: number = 0, articleId?: string) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "status",
                  status,
                  currentModule,
                  progress,
                  articleId,
                })}\n\n`
              )
            );
          };

          // Start test
          sendLog("🚀 Spúšťa sa test workflow...", "progress");
          sendLog(`📌 Bot: "${bot.name}"`, "info");
          sendLog(`📋 Modulov: ${bot.workflow?.modules.length || 0}`, "info");
          sendStatus("starting", null, 0);
          await new Promise((r) => setTimeout(r, 300));

          if(!bot.workflow?.modules || bot.workflow.modules.length === 0) {
            sendLog("❌ Bot nemá workflow moduly!", "error");
            sendStatus("error", null, 0);
            controller.close();
            return;
          }

          let result;
          try {
            console.log("[test-workflow] Calling runBotCycle with bot:", {
              id: bot.id,
              name: bot.name,
              hasWorkflow: !!bot.workflow,
              moduleCount: bot.workflow?.modules.length,
              moduleTypes: bot.workflow?.modules.map(m => m.type)
            });

            sendLog("⏳ Nastavuje sa workflow...", "progress");
            await new Promise((r) => setTimeout(r, 200));

            // Progress callback to stream module updates
            const onProgress = async (event: any) => {
              if (event.type === "module_start") {
                const moduleEmoji: Record<string, string> = {
                  "trigger": "⚡",
                  "topic-scout": "🔍",
                  "article-writer": "✍️",
                  "image-sourcer": "🔗",
                  "ai-image-gen": "✨",
                  "publisher": "🚀",
                  "social-poster": "📢",
                  "conditional-check": "🔀",
                  "rate-limiter": "⏱️",
                  "content-quality": "✔️",
                  "content-cache": "💾"
                };
                const emoji = moduleEmoji[event.moduleType] || "▶️";
                sendLog(`${emoji} ${event.moduleType}...`, "progress");
                sendStatus("module_running", event.moduleType, 30);
              } else if (event.type === "module_complete") {
                const completeEmoji: Record<string, string> = {
                  "trigger": "⚡",
                  "topic-scout": "🔍",
                  "article-writer": "✍️",
                  "image-sourcer": "🔗",
                  "ai-image-gen": "✨",
                  "publisher": "🚀",
                  "social-poster": "📢",
                  "conditional-check": "🔀",
                  "rate-limiter": "⏱️",
                  "content-quality": "✔️",
                  "content-cache": "💾"
                };
                const emoji = completeEmoji[event.moduleType] || "✓";
                sendLog(`${emoji} ${event.moduleType}`, "success");
              } else if (event.type === "module_error") {
                sendLog(`❌ ${event.moduleType}: ${event.message}`, "error");
              } else if (event.type === "progress") {
                sendLog(`⏳ ${event.message}`, "progress");
              }
            };

            result = await runBotCycle(bot, onProgress);
          } catch (e: any) {
            const errMsg = e instanceof Error ? e.message : String(e);
            sendLog(`❌ CHYBA pri spustení bot cycle: ${errMsg}`, "error");
            sendStatus("error", null, 0);
            controller.close();
            return;
          }

          if (!result.success) {
            sendLog(`❌ Chyba: ${result.error}`, "error");
            sendStatus("error", null, 0);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: result.error })}\n\n`));
            controller.close();
            return;
          }

          // Article created successfully
          sendLog(`✅ Článok vytvorený: "${result.articleTitle}" (ID: ${result.articleId})`, "success");
          sendStatus("article_created", null, 50, result.articleId);
          await new Promise((r) => setTimeout(r, 800));

          // Check if we need to generate social posts
          const hasSocialPoster = bot.workflow?.modules.some((m) => m.type === "social-poster");

          if (hasSocialPoster && result.articleId) {
            sendLog("📱 Generovanie príspevkov na sociálne siete...", "progress");

            const socialPosterMod = bot.workflow?.modules.find((m) => m.type === "social-poster");
            const platforms = (socialPosterMod?.settings?.platforms as string[]) || [];

            if (platforms.length > 0) {
              try {
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aiwai.news";
                sendLog(`📢 Публикуем na: ${platforms.join(", ")}`, "progress");

                const socialRes = await fetch(`${siteUrl}/api/admin/social-autopilot`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    secret: process.env.ADMIN_SECRET,
                    articleId: result.articleId,
                    platforms,
                    instagramVariant: (socialPosterMod?.settings?.imageFormat as string) || "studio",
                    autoPublish: (socialPosterMod?.settings?.autoPublish as boolean) ?? true,
                  }),
                });

                if (socialRes.ok) {
                  const socialData = await socialRes.json();
                  sendLog(`✅ Sociálne príspevky publikované: ${socialData.message}`, "success");
                } else {
                  const errText = await socialRes.text().catch(() => "unknown error");
                  sendLog(
                    `⚠️ Sociálne príspevky: ${socialRes.status} - ${errText.substring(0, 100)}`,
                    "error"
                  );
                }
              } catch (e: any) {
                sendLog(`⚠️ Chyba pri publikovaní: ${e.message}`, "error");
              }
            } else {
              sendLog("⏭️ Žiadne sociálne platformy nakonfigurované", "info");
            }

            sendStatus("social_done", null, 100);
            await new Promise((r) => setTimeout(r, 500));
          }

          // Test completed
          sendLog("✨ Test workflow dokončený úspešne!", "success");
          sendStatus("completed", null, 100, result.articleId);
          controller.close();
        } catch (error: any) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "log",
                message: `❌ KRITICKÁ CHYBA: ${errorMsg}`,
                logType: "error",
                timestamp: new Date().toISOString(),
              })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "status",
                status: "error",
                currentModule: null,
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
