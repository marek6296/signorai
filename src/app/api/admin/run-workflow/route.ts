import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runBotCycle, BotConfig } from "@/lib/bot-cycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LEGACY_SECRET = "make-com-webhook-secret";

// ── Convert workflow modules → BotConfig ──────────────────────────────────────
function workflowToBotConfig(id: string, name: string, workflow: Record<string, unknown>): BotConfig {
  const modules = (workflow.modules || []) as Array<{ type: string; settings: Record<string, unknown> }>;
  const getSettings = (type: string) => modules.find((m) => m.type === type)?.settings || {};

  const topicScout    = getSettings("topic-scout");
  const socialPoster  = getSettings("social-poster");
  const hasSocial     = modules.some((m) => m.type === "social-poster");
  const platforms     = (socialPoster.platforms as string[]) || [];

  return {
    id,
    name,
    type: hasSocial ? "full" : "article_only",
    enabled: true,
    interval_hours: 1,
    categories: (topicScout.categories as string[])?.length
      ? (topicScout.categories as string[])
      : ["AI"],
    post_instagram:       platforms.includes("Instagram"),
    post_facebook:        platforms.includes("Facebook"),
    instagram_format:     (socialPoster.imageFormat as string) || "studio",
    auto_publish_social:  (socialPoster.autoPublish as boolean) ?? true,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, workflowId } = body ?? {};

    if (secret !== process.env.ADMIN_SECRET && secret !== LEGACY_SECRET) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!workflowId) {
      return NextResponse.json({ message: "workflowId is required" }, { status: 400 });
    }

    const adminSb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Load workflow record from DB
    const { data: wf, error } = await adminSb
      .from("bot_workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (error || !wf) {
      return NextResponse.json({ message: "Workflow not found" }, { status: 404 });
    }

    const config = workflowToBotConfig(wf.id, wf.name, wf.workflow as Record<string, unknown>);
    console.log(`[RunWorkflow] Running workflow "${wf.name}" as ${config.type} bot`);

    const result = await runBotCycle(config);

    // Social posting (if workflow has social-poster module and article succeeded)
    if (config.type === "full" && result.success && result.articleId) {
      const platforms: string[] = [];
      if (config.post_instagram) platforms.push("Instagram");
      if (config.post_facebook)  platforms.push("Facebook");

      if (platforms.length > 0) {
        try {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aiwai.news";
          const socialRes = await fetch(`${siteUrl}/api/admin/social-autopilot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret:           process.env.ADMIN_SECRET || LEGACY_SECRET,
              articleId:        result.articleId,
              platforms,
              instagramVariant: config.instagram_format || "studio",
              autoPublish:      config.auto_publish_social ?? true,
            }),
          });
          if (socialRes.ok) {
            console.log(`[RunWorkflow] Social posts triggered for "${wf.name}"`);
          } else {
            console.warn(`[RunWorkflow] Social post failed: ${socialRes.status}`);
          }
        } catch (e) {
          console.warn("[RunWorkflow] Social post error:", e);
        }
      }
    }

    // Update last_run & run_count
    await adminSb.from("bot_workflows").update({
      last_run:   new Date().toISOString(),
      run_count:  (wf.run_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", workflowId);

    if (!result.success) {
      return NextResponse.json({ message: result.error || "Chyba pri generovaní" }, { status: 500 });
    }

    return NextResponse.json({ success: true, articleId: result.articleId, title: result.articleTitle });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Neznáma chyba";
    return NextResponse.json({ message: msg, error: true }, { status: 500 });
  }
}
