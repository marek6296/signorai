/**
 * bot-cycle.ts
 * Shared logic for running a bot cycle: fetch topic → generate article + images → save to DB.
 * Used by both /api/admin/bot-generate (manual) and /api/admin/auto-pilot (cron).
 */

import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getGeminiClient } from "@/lib/generate-logic";
import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";

const VALID_CATEGORIES = ["AI", "Tech", "Návody & Tipy"];
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200";

export interface WorkflowModule {
  id: string;
  type: string;
  x: number;
  y: number;
  settings: Record<string, unknown>;
}

export interface WorkflowConnection {
  id: string;
  fromId: string;
  toId: string;
}

export interface BotWorkflow {
  modules: WorkflowModule[];
  connections: WorkflowConnection[];
}

export interface BotConfig {
  id: string;
  name: string;
  type: "article_only" | "full";
  enabled: boolean;
  interval_hours: number;       // run every N hours since last_run
  run_times?: string[];         // legacy — ignored, kept for backward compat
  categories: string[];
  post_instagram?: boolean;
  post_facebook?: boolean;
  instagram_format?: string;
  auto_publish_social?: boolean;
  last_run?: string | null;
  processed_count?: number;
  workflow?: BotWorkflow;       // visual workflow from Bot Layout
}

export interface BotCycleResult {
  success: boolean;
  articleId?: string;
  articleTitle?: string;
  error?: string;
}

// Module execution progress callback
export type ModuleProgressCallback = (event: {
  type: "module_start" | "module_complete" | "module_error" | "progress";
  moduleType?: string;
  moduleId?: string;
  message?: string;
  timestamp?: string;
}) => Promise<void> | void;

// ─── Module Execution Context ────────────────────────────────────────────────
export interface ModuleContext {
  // Topic data
  topic: { title: string; summary: string; url: string | null; category: string } | null;

  // Article data
  article: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    category: string;
    ai_summary: string;
  } | null;

  // Images
  images: {
    hero: string | null;
    inline1: string | null;
    inline2: string | null;
  };

  // Module execution control
  skipRemaining: boolean; // Set by conditional-check to skip rest
  shouldRateLimitAbort: boolean; // Set by rate-limiter to skip if throttled
  qualityCheckFailed: boolean; // Set by content-quality if validation fails

  // Published article ID (set by publisher)
  publishedArticleId: string | null;

  // Derived config
  config: ReturnType<typeof getEffectiveBotConfig>;

  // AI client
  ai: GoogleGenAI;
}

// ─── Extract effective settings from workflow modules (fallback to flat config) ─
function getWorkflowModuleSettings(bot: BotConfig, moduleType: string): Record<string, unknown> | null {
  if (!bot.workflow?.modules) return null;
  const mod = bot.workflow.modules.find(m => m.type === moduleType);
  return mod?.settings ?? null;
}

export function getEffectiveBotConfig(bot: BotConfig) {
  const topicScout = getWorkflowModuleSettings(bot, "topic-scout");
  const articleWriter = getWorkflowModuleSettings(bot, "article-writer");
  const imageSourcer = getWorkflowModuleSettings(bot, "image-sourcer");
  const aiImageGen = getWorkflowModuleSettings(bot, "ai-image-gen");
  const publisher = getWorkflowModuleSettings(bot, "publisher");
  const socialPoster = getWorkflowModuleSettings(bot, "social-poster");
  const trigger = getWorkflowModuleSettings(bot, "trigger");

  const hasSocialPoster = !!socialPoster;
  const contentQuality = getWorkflowModuleSettings(bot, "content-quality");
  const contentCache = getWorkflowModuleSettings(bot, "content-cache");

  return {
    // topic-scout
    categories: (topicScout?.categories as string[]) ?? bot.categories ?? ["AI"],
    timeRange: (topicScout?.timeRange as string) ?? "48h",
    googleSearch: (topicScout?.googleSearch as boolean) ?? true,
    dedup: (topicScout?.dedup as boolean) ?? true,
    
    // article-writer
    language: (articleWriter?.language as string) ?? "sk",
    minWords: (articleWriter?.minWords as number) ?? 400,
    style: (articleWriter?.style as string) ?? "journalistic",
    addSummary: (articleWriter?.addSummary as boolean) ?? true,
    
    // image-sourcer
    tryOg: (imageSourcer?.tryOg as boolean) ?? true,
    tryArticle: (imageSourcer?.tryArticle as boolean) ?? true,
    minWidth: (imageSourcer?.minWidth as number) ?? 300,
    minHeight: (imageSourcer?.minHeight as number) ?? 200,
    
    // ai-image-gen
    imageModel: (aiImageGen?.model as string) ?? "gemini",
    imageCount: (aiImageGen?.count as number) ?? 3,
    imageStyle: (aiImageGen?.style as string) ?? "editorial",
    smartPrompts: (aiImageGen?.smartPrompts as boolean) ?? true,
    
    // publisher
    publishStatus: (publisher?.status as string) ?? "published",
    featuredImage: (publisher?.featuredImage as boolean) ?? true,
    
    // social-poster
    platforms: (socialPoster?.platforms as string[]) ?? [],
    imageFormat: (socialPoster?.imageFormat as string) ?? bot.instagram_format ?? "photo",
    socialHashtags: (socialPoster?.hashtags as string) ?? "",
    addLink: (socialPoster?.addLink as boolean) ?? true,
    autoPublish: (socialPoster?.autoPublish as boolean) ?? bot.auto_publish_social ?? true,
    
    // content-quality
    minContentWords: (contentQuality?.minWordCount as number) ?? 300,
    
    // content-cache
    cacheExpiry: (contentCache?.cacheExpiry as number) ?? 24,
    
    // legacy/derived
    type: hasSocialPoster ? "full" as const : bot.type,
    post_instagram: hasSocialPoster ? ((socialPoster?.platforms as string[]) ?? []).includes("Instagram") : (bot.post_instagram ?? true),
    post_facebook: hasSocialPoster ? ((socialPoster?.platforms as string[]) ?? []).includes("Facebook") : (bot.post_facebook ?? false),
    triggerEnabled: (trigger?.enabled as boolean) ?? true,
    schedule: (trigger?.schedule as string) ?? "0 * * * *",
  };
}

// ─── Scrape images from a source URL (og:image + <img> tags) ─────────────────
async function scrapeSourceImages(url: string): Promise<{ hero: string | null; inline1: string | null; inline2: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AIWaiBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { hero: null, inline1: null, inline2: null };

    const html = await res.text();

    // 1. Try og:image first (highest quality, usually the hero)
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const ogImage = ogMatch?.[1] || null;

    // 2. Extract all <img> src values from article body (skip tiny icons/logos)
    const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
    const candidateImgs = imgMatches
      .map((m) => m[1])
      .filter((src) => {
        if (!src.startsWith("http")) return false;
        // Skip likely icons/avatars/logos/trackers
        if (/\/(icon|logo|avatar|pixel|tracking|placeholder|spinner|gif)/i.test(src)) return false;
        if (/\.(svg|gif|ico)(\?|$)/i.test(src)) return false;
        return true;
      });

    // Deduplicate keeping order
    const seen = new Set<string>();
    const deduped = candidateImgs.filter((u) => { if (seen.has(u)) return false; seen.add(u); return true; });

    // og:image is always the hero; pick next 2 unique inline images (skip if same as og)
    const inlines = deduped.filter((u) => u !== ogImage).slice(0, 2);

    const hero   = ogImage || deduped[0] || null;
    const inline1 = inlines[0] || null;
    const inline2 = inlines[1] || null;

    console.log(`[BotCycle] Source images scraped — hero=${!!hero}, inline1=${!!inline1}, inline2=${!!inline2}`);
    return { hero, inline1, inline2 };
  } catch (e) {
    console.warn("[BotCycle] Source image scraping failed:", e);
    return { hero: null, inline1: null, inline2: null };
  }
}

// ─── Generate smart journalist-grade image prompt from article section ────────
async function generateSmartImagePrompt(
  ai: GoogleGenAI,
  articleTitle: string,
  sectionText: string,
  role: "hero" | "inline"
): Promise<string> {
  const roleCtx = role === "hero"
    ? "HERO IMAGE — represents the entire article. Wide, cinematic establishing shot."
    : "INLINE ILLUSTRATION — illustrates this specific paragraph/section of the article.";

  const meta = `You are a senior photo editor at Wired / MIT Technology Review magazine.
Article title: "${articleTitle}"
Section: "${sectionText.slice(0, 350)}"

Role: ${roleCtx}

Write ONE precise Stable Diffusion / Imagen prompt for a photorealistic editorial photo.
Rules:
- Photorealistic editorial photography, no CGI illustrations
- Specific subject, lighting, composition, camera angle
- NO human faces, NO real logos, NO text/words in the image
- Must literally match what this SECTION of the article is about
- Style: modern editorial, clean background when appropriate

Return ONLY the prompt. No explanations.`;

  try {
    const r = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: meta });
    return r.text?.trim() || "";
  } catch {
    return "";
  }
}

// ─── Generate and upload one AI image ──────────────────────────────────────────
async function generateAndUploadImage(
  ai: GoogleGenAI,
  prompt: string
): Promise<string | null> {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: prompt,
      config: {
        // @ts-ignore
        aspectRatio: "16:9",
        personGeneration: "ALLOW_ADULT",
      },
    });

    if (result.candidates?.[0]?.content?.parts) {
      for (const part of result.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const buffer = Buffer.from(part.inlineData.data, "base64");
          const ext = (part.inlineData.mimeType || "image/png").includes("png") ? "png" : "jpg";
          const filename = `article-generated/${Date.now()}-${Math.floor(Math.random() * 99999)}.${ext}`;

          const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          );

          const { data: uploadData, error } = await adminSupabase.storage
            .from("social-images")
            .upload(filename, buffer, {
              contentType: part.inlineData.mimeType || "image/png",
              upsert: true,
            });

          if (!error && uploadData) {
            const { data: urlData } = adminSupabase.storage
              .from("social-images")
              .getPublicUrl(filename);
            return urlData.publicUrl;
          }
        }
      }
    }
  } catch (e) {
    console.error("[BotCycle] Image generation failed:", e);
  }
  return null;
}

// ─── Module Executors ────────────────────────────────────────────────────────
// Each executor receives context, executes module logic, and updates context

async function executeConditionalCheck(
  ctx: ModuleContext,
  settings: Record<string, unknown>
): Promise<void> {
  const field = settings.field as string || "category";
  const operator = settings.operator as string || "equals";
  const value = settings.value as string || "";

  let conditionMet = false;

  if (field === "category" && ctx.article) {
    const articleCategory = ctx.article.category || "";
    if (operator === "equals") conditionMet = articleCategory === value;
    else if (operator === "not_equals") conditionMet = articleCategory !== value;
    else if (operator === "contains") conditionMet = articleCategory.includes(value);
  } else if (field === "hasUrl" && ctx.article) {
    const hasUrl = ctx.topic?.url ? true : false;
    conditionMet = operator === "equals" ? hasUrl : !hasUrl;
  } else if (field === "hasImages" && ctx.article) {
    const hasImages = !!(ctx.images.hero || ctx.images.inline1 || ctx.images.inline2);
    conditionMet = operator === "equals" ? hasImages : !hasImages;
  } else if (field === "wordCount" && ctx.article) {
    const wordCount = ctx.article.content.split(/\s+/).length;
    const checkValue = parseInt(value, 10) || 400;
    if (operator === "gt") conditionMet = wordCount > checkValue;
    else if (operator === "lt") conditionMet = wordCount < checkValue;
    else if (operator === "equals") conditionMet = wordCount === checkValue;
  }

  if (!conditionMet) {
    console.log(`[ModuleExecutor] conditional-check failed (${field} ${operator} ${value}) — skipping remaining modules`);
    ctx.skipRemaining = true;
  } else {
    console.log(`[ModuleExecutor] conditional-check passed (${field} ${operator} ${value})`);
  }
}

async function executeRateLimiter(
  ctx: ModuleContext,
  settings: Record<string, unknown>
): Promise<void> {
  const delaySeconds = (settings.seconds as number) || 0;
  const maxPerHour = (settings.maxPerHour as number) || 10;
  const maxPerDay = (settings.maxPerDay as number) || 100;

  // Check rate limits from recent runs (simplified — in production use Redis)
  try {
    const { count: hourCount } = await supabase
      .from("articles")
      .select("id", { count: "exact" })
      .gte("created_at", new Date(Date.now() - 3600000).toISOString())
      .limit(1);

    const { count: dayCount } = await supabase
      .from("articles")
      .select("id", { count: "exact" })
      .gte("created_at", new Date(Date.now() - 86400000).toISOString())
      .limit(1);

    if ((hourCount || 0) >= maxPerHour || (dayCount || 0) >= maxPerDay) {
      console.log(`[ModuleExecutor] rate-limiter triggered — throttling (hour: ${hourCount}/${maxPerHour}, day: ${dayCount}/${maxPerDay})`);
      ctx.shouldRateLimitAbort = true;
      return;
    }
  } catch (e) {
    console.warn("[ModuleExecutor] rate-limiter check failed:", e);
  }

  if (delaySeconds > 0) {
    console.log(`[ModuleExecutor] rate-limiter applying ${delaySeconds}s delay`);
    await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
  }
}

async function executeContentQuality(
  ctx: ModuleContext,
  settings: Record<string, unknown>
): Promise<void> {
  if (!ctx.article) return;

  const minWordCount = (settings.minWordCount as number) || 300;
  const wordCount = ctx.article.content.split(/\s+/).length;

  if (wordCount < minWordCount) {
    console.log(`[ModuleExecutor] content-quality check failed — ${wordCount} words < ${minWordCount} min`);
    ctx.qualityCheckFailed = true;
    ctx.skipRemaining = true;
  } else {
    console.log(`[ModuleExecutor] content-quality check passed — ${wordCount} words >= ${minWordCount} min`);
  }
}

async function executeContentCache(
  ctx: ModuleContext,
  settings: Record<string, unknown>,
  botId: string
): Promise<void> {
  // Simple cache: store/retrieve topics by hash
  const cacheExpiry = (settings.cacheExpiry as number) || 24;

  if (ctx.topic) {
    // Store topic in cache
    try {
      const cacheKey = `cache_${botId}_topic_${ctx.topic.title.slice(0, 50).replace(/\W/g, "_")}`;
      await supabase.from("site_settings").upsert(
        {
          key: cacheKey,
          value: JSON.stringify({
            topic: ctx.topic,
            timestamp: Date.now(),
            expiry: cacheExpiry * 3600000,
          }),
        },
        { onConflict: "key" }
      );
      console.log(`[ModuleExecutor] content-cache stored topic: ${ctx.topic.title}`);
    } catch (e) {
      console.warn("[ModuleExecutor] content-cache store failed:", e);
    }
  }
}

// ─── Fetch one topic from Gemini for given categories ─────────────────────────
async function fetchGeminiTopic(
  categories: string[],
  ai: GoogleGenAI
): Promise<{ title: string; summary: string; url: string | null; category: string } | null> {
  const categoryDescriptions: Record<string, string> = {
    AI: "umelá inteligencia, nové AI modely (GPT, Claude, Gemini, Grok), AI výskum, AI agenti",
    Tech: "technológie, spotrebná elektronika, smartfóny, softvér, startupy, Apple, Google, Microsoft",
    "Návody & Tipy": "návody ako používať AI nástroje, ChatGPT tipy, Midjourney, produktivita s AI",
  };

  const validCats = categories.filter((c) => VALID_CATEGORIES.includes(c));
  const usedCats = validCats.length > 0 ? validCats : ["AI"];

  // Dedup: avoid already-written titles
  const { data: existingArticles } = await supabase
    .from("articles")
    .select("title")
    .order("created_at", { ascending: false })
    .limit(40);
  const usedTitles = (existingArticles || []).map((a: { title: string }) => a.title).filter(Boolean);
  const dedupeBlock =
    usedTitles.length > 0
      ? `\nTIETO TÉMY UŽ MÁME — navrhni VÝHRADNE odlišné témy:\n${usedTitles.slice(0, 20).map((t) => `- ${t}`).join("\n")}\n`
      : "";

  const today = new Date().toLocaleDateString("sk-SK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const catDescList = usedCats
    .map((c) => `- ${c}: ${categoryDescriptions[c] || c}`)
    .join("\n");

  const prompt = `Dnes je ${today}. Si expert na technologické správy.
${dedupeBlock}
Nájdi JEDNU najnovšiu, najtrendovejšiu správu pre tieto kategórie:
${catDescList}

Správa musí byť zo dneška alebo včera (max 48h). Vráť JSON objekt:
{
  "title": "slovenský titulok max 80 znakov",
  "summary": "zhrnutie v 2-3 vetách",
  "category": "JEDNA Z: ${usedCats.join(" | ")}",
  "url": "priamy odkaz na originálny článok alebo null",
  "source": "názov portálu"
}
Vráť ČISTÝ JSON bez markdown blokov.`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text = result.text || "";
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.title) return null;

    return {
      title: parsed.title,
      summary: parsed.summary || "",
      url: parsed.url && parsed.url.startsWith("http") ? parsed.url : null,
      category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : usedCats[0],
    };
  } catch (e) {
    console.error("[BotCycle] fetchGeminiTopic error:", e);
    return null;
  }
}

// ─── Execute workflow-based bot cycle ────────────────────────────────────────
async function executeWorkflow(
  bot: BotConfig,
  ai: GoogleGenAI,
  onProgress?: ModuleProgressCallback
): Promise<BotCycleResult> {
  const rid = Math.random().toString(36).substring(7);

  if (!bot.workflow || bot.workflow.modules.length === 0) {
    throw new Error("Bot has no workflow modules");
  }

  const cfg = getEffectiveBotConfig(bot);
  const modules = bot.workflow.modules;
  const connections = bot.workflow.connections;

  // Initialize context
  const ctx: ModuleContext = {
    topic: null,
    article: null,
    images: { hero: null, inline1: null, inline2: null },
    skipRemaining: false,
    shouldRateLimitAbort: false,
    qualityCheckFailed: false,
    publishedArticleId: null,
    config: cfg,
    ai,
  };

  // Find trigger module (entry point)
  const triggerMod = modules.find((m) => m.type === "trigger");
  if (!triggerMod) throw new Error("No trigger module in workflow");

  // Build adjacency list for traversal
  const adj = new Map<string, string[]>();
  modules.forEach((m) => adj.set(m.id, []));
  connections.forEach((c) => {
    const list = adj.get(c.fromId) || [];
    list.push(c.toId);
    adj.set(c.fromId, list);
  });

  // Traverse and execute modules starting from trigger
  const visited = new Set<string>();
  const toExecute: string[] = [triggerMod.id];

  console.log(`[BotCycle][${rid}] Starting workflow traversal with ${modules.length} modules, ${connections.length} connections`);

  while (toExecute.length > 0) {
    const modId = toExecute.shift()!;
    if (visited.has(modId)) {
      console.log(`[BotCycle][${rid}] Skipping already visited: ${modId}`);
      continue;
    }
    visited.add(modId);

    const mod = modules.find((m) => m.id === modId);
    if (!mod) {
      console.log(`[BotCycle][${rid}] Module ${modId} not found!`);
      continue;
    }

    console.log(`[BotCycle][${rid}] Executing: ${mod.type} (id: ${mod.id})`);

    // Skip if conditional-check failed
    if (ctx.skipRemaining && mod.type !== "trigger") {
      console.log(`[BotCycle][${rid}] Skipping ${mod.type} (condition failed)`);
      continue;
    }

    // Skip if rate-limiter blocked
    if (ctx.shouldRateLimitAbort && mod.type !== "rate-limiter") {
      console.log(`[BotCycle][${rid}] Skipping ${mod.type} (rate-limited)`);
      continue;
    }

    // Report module start
    if (onProgress && mod.type !== "trigger") {
      await onProgress({
        type: "module_start",
        moduleType: mod.type,
        moduleId: mod.id,
        message: `🚀 Spúšťa sa modul: ${mod.type}`,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      // Execute module based on type
      if (mod.type === "trigger") {
        // Trigger just marks the starting point, no execution needed
      } else if (mod.type === "topic-scout") {
        // Progress: searching for topics
        if (onProgress) {
          await onProgress({
            type: "progress",
            message: `Hľadá sa téma v kategóriách: ${cfg.categories.join(", ")}`,
            timestamp: new Date().toISOString(),
          });
        }
        const topic = await fetchGeminiTopic(cfg.categories, ai);
        if (!topic) throw new Error("Failed to fetch topic");
        ctx.topic = topic;
        // Progress: topic found
        if (onProgress) {
          await onProgress({
            type: "progress",
            message: `Nájdená téma: "${topic.title}"`,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (mod.type === "article-writer") {
        if (!ctx.topic) throw new Error("topic-scout must run before article-writer");
        const finalCategory = VALID_CATEGORIES.includes(ctx.topic.category)
          ? ctx.topic.category
          : (cfg.categories[0] || "AI");

        // Progress: preparing article
        if (onProgress) {
          await onProgress({
            type: "progress",
            message: `Generuje sa článok o: "${ctx.topic.title}"`,
            timestamp: new Date().toISOString(),
          });
        }

        const articlePrompt = `Si šéfredaktor a špičkový copywriter pre prestížny AI & Tech magazín AIWai.
Napíš prémiový, pútavý a odborne presný článok v STOPERCENTNEJ, ČISTEJ SLOVENČINE.

ZÁVÄZNÉ PRAVIDLÁ:
1. STRIKTNÁ SLOVENČINA: Žiadne české slová, žiadne bohemizmy.
2. ŽIADNY STROJOVÝ PREKLAD: Text ako od slovenského technologického novinára.
3. Plynulý žurnalistický štýl. Rozčleň text na odseky s h2/h3 podnadpismi.
4. CLICKBAIT nadpis – pútavý, čestný, vzbudzuje zvedavosť.
5. Minimálne 400 slov v obsahu.

Vráť LEN čistý JSON (žiadny markdown):
{
    "title": "Virálny nadpis v dokonalej slovenčine",
    "slug": "url-friendly-nazov-bez-diakritiky",
    "excerpt": "Perex: 1 až 2 pútavé vety.",
    "content": "Článok v HTML s p, strong, h2, h3. Min. 400 slov.",
    "ai_summary": "1-2 krátke vety pre audio.",
    "category": "JEDNA Z: AI, Tech, Návody & Tipy"
}

TITULOK: ${ctx.topic.title}
ZHRNUTIE: ${ctx.topic.summary || "Informácia z oblasti technológií a AI."}
KATEGÓRIA: ${finalCategory}
${ctx.topic.url ? `ZDROJ: ${ctx.topic.url}` : ""}`;

        const textResult = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: articlePrompt,
        });

        const rawText = textResult.text || "";
        if (!rawText) throw new Error("Gemini vrátil prázdnu odpoveď");

        const cleanedText = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Gemini nevrátil platný JSON");

        const articleData = JSON.parse(jsonMatch[0]);
        const aiCategory = VALID_CATEGORIES.includes(articleData.category)
          ? articleData.category
          : finalCategory;

        ctx.article = {
          title: articleData.title,
          slug: articleData.slug,
          excerpt: articleData.excerpt,
          content: articleData.content,
          category: aiCategory,
          ai_summary: articleData.ai_summary,
        };
      } else if (mod.type === "image-sourcer") {
        if (!ctx.topic?.url) {
          console.log(`[BotCycle][${rid}] Skipping image-sourcer (no source URL)`);
        } else {
          const scraped = await scrapeSourceImages(ctx.topic.url);
          ctx.images.hero = scraped.hero;
          ctx.images.inline1 = scraped.inline1;
          ctx.images.inline2 = scraped.inline2;
        }
      } else if (mod.type === "ai-image-gen") {
        if (!ctx.article) throw new Error("article-writer must run before ai-image-gen");

        const missingHero = !ctx.images.hero;
        const missingInline1 = !ctx.images.inline1;
        const missingInline2 = !ctx.images.inline2;
        const anyMissing = missingHero || missingInline1 || missingInline2;

        if (anyMissing) {
          // Progress: preparing to generate images
          if (onProgress) {
            const missing = [
              missingHero && "Hero",
              missingInline1 && "Obrázok 1",
              missingInline2 && "Obrázok 2"
            ].filter(Boolean).join(", ");
            await onProgress({
              type: "progress",
              message: `Generuje sa: ${missing}`,
              timestamp: new Date().toISOString(),
            });
          }
          const plainText = (ctx.article.content || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const words = plainText.split(" ");
          const total = words.length;
          const heroCtx = words.slice(0, Math.min(80, total)).join(" ");
          const mid1Ctx = words.slice(Math.floor(total * 0.2), Math.floor(total * 0.45)).join(" ");
          const mid2Ctx = words.slice(Math.floor(total * 0.55), Math.floor(total * 0.78)).join(" ");

          const [heroPrompt, inline1Prompt, inline2Prompt] = await Promise.all([
            missingHero
              ? generateSmartImagePrompt(ai, ctx.article.title, heroCtx, "hero")
              : Promise.resolve(""),
            missingInline1
              ? generateSmartImagePrompt(ai, ctx.article.title, mid1Ctx, "inline")
              : Promise.resolve(""),
            missingInline2
              ? generateSmartImagePrompt(ai, ctx.article.title, mid2Ctx, "inline")
              : Promise.resolve(""),
          ]);

          const [aiHero, aiInline1, aiInline2] = await Promise.all([
            missingHero && heroPrompt ? generateAndUploadImage(ai, heroPrompt) : Promise.resolve(null),
            missingInline1 && inline1Prompt
              ? generateAndUploadImage(ai, inline1Prompt)
              : Promise.resolve(null),
            missingInline2 && inline2Prompt
              ? generateAndUploadImage(ai, inline2Prompt)
              : Promise.resolve(null),
          ]);

          if (missingHero && aiHero) ctx.images.hero = aiHero;
          if (missingInline1 && aiInline1) ctx.images.inline1 = aiInline1;
          if (missingInline2 && aiInline2) ctx.images.inline2 = aiInline2;
        }
      } else if (mod.type === "publisher") {
        if (!ctx.article) throw new Error("article-writer must run before publisher");

        // Inject inline images into content
        let content = (ctx.article.content || "").replace(/<img[^>]*>/gi, "");
        if (ctx.images.inline1 || ctx.images.inline2) {
          let pCount = 0;
          content = content.replace(/<\/p>/gi, (match: string) => {
            pCount++;
            if (pCount === 1 && ctx.images.inline1) {
              return `</p>\n<figure class="my-8"><img src="${ctx.images.inline1}" alt="Ilustračný obrázok k článku" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
            }
            if (pCount === 4 && ctx.images.inline2) {
              return `</p>\n<figure class="my-8"><img src="${ctx.images.inline2}" alt="Doplnkový obrázok k článku" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
            }
            return match;
          });
          if (ctx.images.inline2 && content.split("</p>").length - 1 < 4) {
            content += `\n<figure class="my-8"><img src="${ctx.images.inline2}" alt="Doplnkový obrázok k článku" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
          }
        }

        const dbData = {
          title: ctx.article.title,
          slug: ctx.article.slug + "-" + Math.random().toString(36).substring(2, 7),
          excerpt: ctx.article.excerpt,
          content,
          category: ctx.article.category,
          ai_summary: ctx.article.ai_summary,
          main_image: ctx.images.hero || FALLBACK_IMAGE,
          source_url: ctx.topic?.url || null,
          status: cfg.publishStatus || "published",
          published_at: new Date().toISOString(),
        };

        const { data: inserted, error } = await supabase
          .from("articles")
          .insert([dbData])
          .select()
          .single();

        if (error) throw error;

        ctx.publishedArticleId = inserted.id;

        revalidatePath("/", "layout");
      } else if (mod.type === "social-poster") {
        // Social-poster execution is handled in auto-pilot.ts
        console.log(`[BotCycle][${rid}] social-poster marked for post-processing`);
      } else if (mod.type === "conditional-check") {
        await executeConditionalCheck(ctx, mod.settings);
      } else if (mod.type === "rate-limiter") {
        await executeRateLimiter(ctx, mod.settings);
      } else if (mod.type === "content-quality") {
        await executeContentQuality(ctx, mod.settings);
      } else if (mod.type === "content-cache") {
        await executeContentCache(ctx, mod.settings, bot.id);
      }

      // Report module completion
      if (onProgress && mod.type !== "trigger") {
        await onProgress({
          type: "module_complete",
          moduleType: mod.type,
          moduleId: mod.id,
          message: `✅ Modul dokončený: ${mod.type}`,
          timestamp: new Date().toISOString(),
        });
      }

      // Add children to execute queue
      const children = adj.get(modId) || [];
      toExecute.push(...children);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[BotCycle][${rid}] Module ${mod.type} error:`, msg);

      // Report module error
      if (onProgress && mod.type !== "trigger") {
        await onProgress({
          type: "module_error",
          moduleType: mod.type,
          moduleId: mod.id,
          message: `❌ Chyba v module ${mod.type}: ${msg}`,
          timestamp: new Date().toISOString(),
        });
      }

      throw e;
    }
  }

  if (!ctx.article) {
    throw new Error("Workflow did not generate an article");
  }

  if (!ctx.publishedArticleId) {
    throw new Error("Workflow did not publish article");
  }

  return {
    success: true,
    articleId: ctx.publishedArticleId,
    articleTitle: ctx.article.title,
  };
}

// ─── Main: run one full bot cycle ─────────────────────────────────────────────
export async function runBotCycle(
  bot: BotConfig,
  onProgress?: ModuleProgressCallback
): Promise<BotCycleResult> {
  const rid = Math.random().toString(36).substring(7);
  const cfg = getEffectiveBotConfig(bot);
  const effectiveType = cfg.type;
  console.log(`[BotCycle][${rid}] Starting cycle for bot: "${bot.name}" (${effectiveType}, workflow: ${!!bot.workflow})`);

  try {
    const ai = getGeminiClient();

    // If bot has workflow, execute it; otherwise use legacy mode
    if (bot.workflow && bot.workflow.modules.length > 0) {
      return await executeWorkflow(bot, ai, onProgress);
    }

    // Legacy mode: hardcoded flow (backward compat for bots without workflow)
    console.log(`[BotCycle][${rid}] Fetching topic for categories: ${cfg.categories.join(", ")}`);
    const topic = await fetchGeminiTopic(cfg.categories, ai);
    if (!topic) throw new Error("Nepodarilo sa nájsť tému");
    console.log(`[BotCycle][${rid}] Topic: "${topic.title}"`);

    const finalCategory = VALID_CATEGORIES.includes(topic.category)
      ? topic.category
      : (cfg.categories[0] || "AI");

    const articlePrompt = `Si šéfredaktor a špičkový copywriter pre prestížny AI & Tech magazín AIWai.
Napíš prémiový, pútavý a odborne presný článok v STOPERCENTNEJ, ČISTEJ SLOVENČINE.

ZÁVÄZNÉ PRAVIDLÁ:
1. STRIKTNÁ SLOVENČINA: Žiadne české slová, žiadne bohemizmy.
2. ŽIADNY STROJOVÝ PREKLAD: Text ako od slovenského technologického novinára.
3. Plynulý žurnalistický štýl. Rozčleň text na odseky s h2/h3 podnadpismi.
4. CLICKBAIT nadpis – pútavý, čestný, vzbudzuje zvedavosť.
5. Minimálne 400 slov v obsahu.

Vráť LEN čistý JSON (žiadny markdown):
{
    "title": "Virálny nadpis v dokonalej slovenčine",
    "slug": "url-friendly-nazov-bez-diakritiky",
    "excerpt": "Perex: 1 až 2 pútavé vety.",
    "content": "Článok v HTML s p, strong, h2, h3. Min. 400 slov.",
    "ai_summary": "1-2 krátke vety pre audio.",
    "category": "JEDNA Z: AI, Tech, Návody & Tipy"
}

TITULOK: ${topic.title}
ZHRNUTIE: ${topic.summary || "Informácia z oblasti technológií a AI."}
KATEGÓRIA: ${finalCategory}
${topic.url ? `ZDROJ: ${topic.url}` : ""}`;

    const textResult = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: articlePrompt,
    });

    const rawText = textResult.text || "";
    if (!rawText) throw new Error("Gemini vrátil prázdnu odpoveď");

    const cleanedText = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Gemini nevrátil platný JSON");

    const articleData = JSON.parse(jsonMatch[0]);
    const aiCategory = VALID_CATEGORIES.includes(articleData.category)
      ? articleData.category
      : finalCategory;

    console.log(`[BotCycle][${rid}] Article generated: "${articleData.title}"`);

    // ── 3. Images: try source first, AI-generate only what's missing ─────────
    let heroUrl: string | null = null;
    let inline1Url: string | null = null;
    let inline2Url: string | null = null;

    // 3a. Try to scrape images from the source article URL
    if (topic.url) {
      console.log(`[BotCycle][${rid}] Scraping images from source: ${topic.url}`);
      const scraped = await scrapeSourceImages(topic.url);
      heroUrl = scraped.hero;
      inline1Url = scraped.inline1;
      inline2Url = scraped.inline2;
    }

    // 3b. AI-generate only the images still missing
    const missingHero = !heroUrl;
    const missingInline1 = !inline1Url;
    const missingInline2 = !inline2Url;
    const anyMissing = missingHero || missingInline1 || missingInline2;

    if (anyMissing) {
      console.log(
        `[BotCycle][${rid}] AI-generating missing images (hero=${missingHero}, inline1=${missingInline1}, inline2=${missingInline2})...`
      );

      // Extract article plain text for contextual image prompts
      const plainText = (articleData.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const words = plainText.split(" ");
      const total = words.length;
      const heroCtx = words.slice(0, Math.min(80, total)).join(" ");
      const mid1Ctx = words.slice(Math.floor(total * 0.2), Math.floor(total * 0.45)).join(" ");
      const mid2Ctx = words.slice(Math.floor(total * 0.55), Math.floor(total * 0.78)).join(" ");

      // Generate contextual prompts in parallel (only for missing images)
      const [heroPrompt, inline1Prompt, inline2Prompt] = await Promise.all([
        missingHero
          ? generateSmartImagePrompt(ai, articleData.title, heroCtx, "hero")
          : Promise.resolve(""),
        missingInline1
          ? generateSmartImagePrompt(ai, articleData.title, mid1Ctx, "inline")
          : Promise.resolve(""),
        missingInline2
          ? generateSmartImagePrompt(ai, articleData.title, mid2Ctx, "inline")
          : Promise.resolve(""),
      ]);

      // Generate images with smart prompts
      const [aiHero, aiInline1, aiInline2] = await Promise.all([
        missingHero && heroPrompt ? generateAndUploadImage(ai, heroPrompt) : Promise.resolve(null),
        missingInline1 && inline1Prompt
          ? generateAndUploadImage(ai, inline1Prompt)
          : Promise.resolve(null),
        missingInline2 && inline2Prompt
          ? generateAndUploadImage(ai, inline2Prompt)
          : Promise.resolve(null),
      ]);

      if (missingHero && aiHero) heroUrl = aiHero;
      if (missingInline1 && aiInline1) inline1Url = aiInline1;
      if (missingInline2 && aiInline2) inline2Url = aiInline2;
    } else {
      console.log(`[BotCycle][${rid}] All images from source — skipping AI generation`);
    }

    console.log(`[BotCycle][${rid}] Images ready: hero=${!!heroUrl}, inline1=${!!inline1Url}, inline2=${!!inline2Url}`);

    // ── 4. Inject inline images into content ──────────────────────────────────
    let content = (articleData.content || "").replace(/<img[^>]*>/gi, "");
    if (inline1Url || inline2Url) {
      let pCount = 0;
      content = content.replace(/<\/p>/gi, (match: string) => {
        pCount++;
        if (pCount === 1 && inline1Url) {
          return `</p>\n<figure class="my-8"><img src="${inline1Url}" alt="Ilustračný obrázok k článku" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
        }
        if (pCount === 4 && inline2Url) {
          return `</p>\n<figure class="my-8"><img src="${inline2Url}" alt="Doplnkový obrázok k článku" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
        }
        return match;
      });
      if (inline2Url && content.split("</p>").length - 1 < 4) {
        content += `\n<figure class="my-8"><img src="${inline2Url}" alt="Doplnkový obrázok k článku" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
      }
    }

    // ── 5. Save to Supabase ───────────────────────────────────────────────────
    const dbData = {
      title: articleData.title || topic.title,
      slug:
        (articleData.slug || "article-" + Date.now()) +
        "-" +
        Math.random().toString(36).substring(2, 7),
      excerpt: articleData.excerpt || topic.summary || "",
      content,
      category: aiCategory,
      ai_summary: articleData.ai_summary || "",
      main_image: heroUrl || FALLBACK_IMAGE,
      source_url: topic.url || null,
      status: "published",
      published_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from("articles")
      .insert([dbData])
      .select()
      .single();

    if (error) throw error;
    console.log(`[BotCycle][${rid}] Article saved: ID=${inserted.id}`);

    revalidatePath("/", "layout");

    return { success: true, articleId: inserted.id, articleTitle: inserted.title };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[BotCycle][${rid}] ERROR:`, msg);
    return { success: false, error: msg };
  }
}

// ─── Check if a bot should run now (interval-based) ──────────────────────────
// Vercel cron fires every hour; bot runs if interval_hours have passed since last_run.
export function shouldBotRunNow(bot: BotConfig): boolean {
  if (!bot.enabled) return false;

  const intervalHours = bot.interval_hours ?? 4; // default: every 4 hours

  // Never ran before → run immediately
  if (!bot.last_run) {
    console.log(`[BotCycle] Bot "${bot.name}" has never run — triggering now`);
    return true;
  }

  const lastRunMs = new Date(bot.last_run).getTime();
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const elapsedMs = Date.now() - lastRunMs;

  if (elapsedMs >= intervalMs) {
    const elapsedH = (elapsedMs / 3600000).toFixed(1);
    console.log(`[BotCycle] Bot "${bot.name}" due — ${elapsedH}h since last run (interval: ${intervalHours}h)`);
    return true;
  }

  const minsLeft = Math.round((intervalMs - elapsedMs) / 60000);
  console.log(`[BotCycle] Bot "${bot.name}" not due — ${minsLeft}min remaining until next run`);
  return false;
}
