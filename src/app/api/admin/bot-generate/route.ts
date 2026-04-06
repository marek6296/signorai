import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getGeminiClient } from "@/lib/generate-logic";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LEGACY_SECRET = "make-com-webhook-secret";
const VALID_CATEGORIES = ["AI", "Tech", "Návody & Tipy"];

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200";

export async function POST(request: NextRequest) {
  const rid = Math.random().toString(36).substring(7);
  console.log(`>>> [BotGenerate][${rid}] POST received`);

  try {
    const body = await request.json();
    const { secret, title, summary, category, sourceUrl, status = "draft" } = body ?? {};

    // Auth
    if (secret !== process.env.ADMIN_SECRET && secret !== LEGACY_SECRET) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!title) {
      return NextResponse.json({ message: "title je povinný" }, { status: 400 });
    }

    // Validate category
    const finalCategory = VALID_CATEGORIES.includes(category) ? category : "AI";

    console.log(`>>> [BotGenerate][${rid}] Generating article from topic: "${title}"`);

    const promptSystem = `Si šéfredaktor a špičkový copywriter pre prestížny AI & Tech magazín AIWai.
Tvojou úlohou je napísať prémiový, pútavý a odborne presný článok v STOPERCENTNEJ, ČISTEJ SLOVENČINE na základe zadaného titulku a zhrnutia správy.

ZÁVÄZNÉ PRAVIDLÁ:
1. STRIKTNÁ SLOVENČINA: Žiadne české slová, žiadne bohemizmy.
2. ŽIADNY STROJOVÝ PREKLAD: Text ako od slovenského technologického novinára.
3. Plynulý žurnalistický štýl. Rozčleň text na odseky s h2/h3 podnadpismi.
4. CLICKBAIT nadpis – pútavý, čestný, vzbudzuje zvedavosť.
5. Minimálne 400 slov v obsahu.

Tvoj výstup VŽDY EXAKTNE VO FORMÁTE JSON (žiadny markdown okolo JSON):
{
    "title": "Virálny nadpis v dokonalej slovenčine",
    "slug": "url-friendly-nazov-bez-diakritiky-a-medzier",
    "excerpt": "Perex: 1 až 2 pútavé vety.",
    "content": "Článok v HTML s p, strong, h2, h3. Minimálne 400 slov.",
    "ai_summary": "PRESNE 1-2 krátke vety. Výstižné zhrnutie pre audio.",
    "category": "JEDNA Z TÝCHTO: AI, Tech, Návody & Tipy"
}
Nikdy nevracaj inú kategóriu. Nikdy nevracaj markdown bloky okolo JSON.`;

    const userPrompt = `Napíš článok na základe tejto správy:

TITULOK: ${title}
ZHRNUTIE: ${summary || "Informácia z oblasti technológií a AI."}
KATEGÓRIA: ${finalCategory}
${sourceUrl ? `ZDROJ: ${sourceUrl}` : ""}

Napíš kompletný, detailný, informatívny článok. Rozviň tému, pridaj kontext a zaujímavé detaily.`;

    const client = getGeminiClient();
    const result = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt.replace("{SYSTEM}", promptSystem),
    });

    // Retry with full prompt if first attempt fails
    const fullPrompt = `${promptSystem}\n\n${userPrompt}`;
    const result2 = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
    });

    const text = result2.text || result.text || "";
    console.log(`>>> [BotGenerate][${rid}] Gemini response length: ${text.length}`);

    if (!text) {
      throw new Error("Gemini vrátil prázdnu odpoveď");
    }

    // Parse JSON
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Gemini nevrátil platný JSON");
    }
    const articleData = JSON.parse(jsonMatch[0]);
    console.log(`>>> [BotGenerate][${rid}] Parsed article: "${articleData.title}"`);

    // Validate category from AI response
    const aiCategory = VALID_CATEGORIES.includes(articleData.category) ? articleData.category : finalCategory;

    // Save to Supabase
    const dbData = {
      title: articleData.title || title,
      slug: (articleData.slug || "article-" + Date.now()) + "-" + Math.random().toString(36).substring(2, 7),
      excerpt: articleData.excerpt || summary || "",
      content: articleData.content || "",
      category: aiCategory,
      ai_summary: articleData.ai_summary || "",
      main_image: FALLBACK_IMAGE,
      source_url: sourceUrl || null,
      status: status,
      published_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from("articles")
      .insert([dbData])
      .select()
      .single();

    if (error) {
      console.error(`>>> [BotGenerate][${rid}] Supabase error:`, error);
      throw error;
    }

    console.log(`>>> [BotGenerate][${rid}] Saved article ID: ${inserted.id}`);
    revalidatePath("/", "layout");

    return NextResponse.json({ success: true, article: inserted });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Neznáma chyba";
    console.error(`>>> [BotGenerate][${rid}] ERROR:`, msg);
    return NextResponse.json({ message: msg, error: true }, { status: 500 });
  }
}
