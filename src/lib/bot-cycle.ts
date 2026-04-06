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
}

export interface BotCycleResult {
  success: boolean;
  articleId?: string;
  articleTitle?: string;
  error?: string;
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

// ─── Main: run one full bot cycle ─────────────────────────────────────────────
export async function runBotCycle(bot: BotConfig): Promise<BotCycleResult> {
  const rid = Math.random().toString(36).substring(7);
  console.log(`[BotCycle][${rid}] Starting cycle for bot: "${bot.name}" (${bot.type})`);

  try {
    const ai = getGeminiClient();

    // ── 1. Fetch topic ────────────────────────────────────────────────────────
    console.log(`[BotCycle][${rid}] Fetching topic for categories: ${bot.categories.join(", ")}`);
    const topic = await fetchGeminiTopic(bot.categories, ai);
    if (!topic) throw new Error("Nepodarilo sa nájsť tému");
    console.log(`[BotCycle][${rid}] Topic: "${topic.title}"`);

    const finalCategory = VALID_CATEGORIES.includes(topic.category)
      ? topic.category
      : (bot.categories[0] || "AI");

    // ── 2. Generate article text ──────────────────────────────────────────────
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
      heroUrl   = scraped.hero;
      inline1Url = scraped.inline1;
      inline2Url = scraped.inline2;
    }

    // 3b. AI-generate only the images still missing
    const missingHero   = !heroUrl;
    const missingInline1 = !inline1Url;
    const missingInline2 = !inline2Url;
    const anyMissing = missingHero || missingInline1 || missingInline2;

    if (anyMissing) {
      console.log(`[BotCycle][${rid}] AI-generating missing images (hero=${missingHero}, inline1=${missingInline1}, inline2=${missingInline2})...`);
      const imageBase = `Generate a photorealistic, ultra-high quality cinematic editorial photograph.
Theme: ${articleData.title || topic.title}
Context: ${articleData.excerpt || topic.summary || "Technology news"}
RULES: NO real public figures, NO branded logos, NO text overlays, NO watermarks. Realistic editorial photography.`;

      const [aiHero, aiInline1, aiInline2] = await Promise.all([
        missingHero   ? generateAndUploadImage(ai, `${imageBase}\nFocus: Main subject — innovative hardware or core concept of story. Hero shot, dramatic lighting.`) : Promise.resolve(null),
        missingInline1 ? generateAndUploadImage(ai, `${imageBase}\nFocus: Close-up detail — specific component, interface, or technical element.`) : Promise.resolve(null),
        missingInline2 ? generateAndUploadImage(ai, `${imageBase}\nFocus: Broader impact — people using technology or futuristic environment.`) : Promise.resolve(null),
      ]);

      if (missingHero   && aiHero)   heroUrl   = aiHero;
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
