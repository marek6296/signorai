import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getGeminiClient } from "@/lib/generate-logic";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LEGACY_SECRET = "make-com-webhook-secret";
const VALID_CATEGORIES = ["AI", "Tech", "Návody & Tipy"];
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200";

// ── Generate & upload one AI image, returns public URL or null ──────────────
async function generateAndUploadImage(prompt: string): Promise<string | null> {
  try {
    const ai = getGeminiClient();
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
    console.error(">>> [BotGenerate] Image generation failed:", e);
  }
  return null;
}

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

    const finalCategory = VALID_CATEGORIES.includes(category) ? category : "AI";

    // ── Step 1: Generate article text with Gemini ──────────────────────────
    console.log(`>>> [BotGenerate][${rid}] Generating article: "${title}"`);

    const fullPrompt = `Si šéfredaktor a špičkový copywriter pre prestížny AI & Tech magazín AIWai.
Tvojou úlohou je napísať prémiový, pútavý a odborne presný článok v STOPERCENTNEJ, ČISTEJ SLOVENČINE.

ZÁVÄZNÉ PRAVIDLÁ:
1. STRIKTNÁ SLOVENČINA: Žiadne české slová, žiadne bohemizmy.
2. ŽIADNY STROJOVÝ PREKLAD: Text ako od slovenského technologického novinára.
3. Plynulý žurnalistický štýl. Rozčleň text na odseky s h2/h3 podnadpismi.
4. CLICKBAIT nadpis – pútavý, čestný, vzbudzuje zvedavosť.
5. Minimálne 400 slov v obsahu. Obsah musí byť informatívny a detailný.

Tvoj výstup VŽDY EXAKTNE VO FORMÁTE JSON (žiadny markdown okolo JSON):
{
    "title": "Virálny nadpis v dokonalej slovenčine",
    "slug": "url-friendly-nazov-bez-diakritiky-a-medzier",
    "excerpt": "Perex: 1 až 2 pútavé vety.",
    "content": "Článok v HTML s p, strong, h2, h3. Minimálne 400 slov.",
    "ai_summary": "PRESNE 1-2 krátke vety. Výstižné zhrnutie pre audio.",
    "category": "JEDNA Z TÝCHTO: AI, Tech, Návody & Tipy"
}

Napíš článok na základe tejto správy:
TITULOK: ${title}
ZHRNUTIE: ${summary || "Informácia z oblasti technológií a AI."}
KATEGÓRIA: ${finalCategory}
${sourceUrl ? `ZDROJ: ${sourceUrl}` : ""}

Napíš kompletný, detailný, informatívny článok. Rozviň tému, pridaj kontext a zaujímavé detaily pre slovenského čitateľa.`;

    const client = getGeminiClient();
    const textResult = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
    });

    const rawText = textResult.text || "";
    console.log(`>>> [BotGenerate][${rid}] Text response length: ${rawText.length}`);

    if (!rawText) throw new Error("Gemini vrátil prázdnu odpoveď");

    const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Gemini nevrátil platný JSON");

    const articleData = JSON.parse(jsonMatch[0]);
    console.log(`>>> [BotGenerate][${rid}] Article parsed: "${articleData.title}"`);

    const aiCategory = VALID_CATEGORIES.includes(articleData.category)
      ? articleData.category
      : finalCategory;

    // ── Step 2: Generate images in parallel ───────────────────────────────
    console.log(`>>> [BotGenerate][${rid}] Generating 3 AI images in parallel...`);

    const imagePromptBase = `Generate a photorealistic, ultra-high quality cinematic editorial photograph.
Theme: ${articleData.title || title}
Context: ${articleData.excerpt || summary || "Technology news"}

CRITICAL RULES:
- NO specific real-world public figures (no Elon Musk, Sam Altman, etc.) — use generic representations
- NO trademarked logos or brand marks
- Style: Realistic editorial photography, high detail, professional lighting
- NO text overlays, NO watermarks`;

    const [heroUrl, inline1Url, inline2Url] = await Promise.all([
      generateAndUploadImage(
        `${imagePromptBase}\nFocus: The main subject — innovative hardware, futuristic technology, or the core concept of this article. Hero shot, wide angle, dramatic lighting.`
      ),
      generateAndUploadImage(
        `${imagePromptBase}\nFocus: A close-up detail — specific component, interface, or technical element central to this story.`
      ),
      generateAndUploadImage(
        `${imagePromptBase}\nFocus: The broader impact — people using technology, futuristic environment, or global/societal context of this story.`
      ),
    ]);

    console.log(`>>> [BotGenerate][${rid}] Images: hero=${!!heroUrl}, inline1=${!!inline1Url}, inline2=${!!inline2Url}`);

    // ── Step 3: Inject inline images into content ─────────────────────────
    let content = (articleData.content || "").replace(/<img[^>]*>/gi, ""); // strip any existing imgs

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

      // If article was too short for 4th paragraph, append inline2 at end
      if (inline2Url && pCount < 4) {
        content += `\n<figure class="my-8"><img src="${inline2Url}" alt="Doplnkový obrázok k článku" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
      }
    }

    // ── Step 4: Save to Supabase ──────────────────────────────────────────
    const dbData = {
      title: articleData.title || title,
      slug:
        (articleData.slug || "article-" + Date.now()) +
        "-" +
        Math.random().toString(36).substring(2, 7),
      excerpt: articleData.excerpt || summary || "",
      content,
      category: aiCategory,
      ai_summary: articleData.ai_summary || "",
      main_image: heroUrl || FALLBACK_IMAGE,
      source_url: sourceUrl || null,
      status,
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

    console.log(`>>> [BotGenerate][${rid}] Saved article ID: ${inserted.id}, main_image: ${!!heroUrl}`);
    revalidatePath("/", "layout");

    return NextResponse.json({ success: true, article: inserted });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Neznáma chyba";
    console.error(`>>> [BotGenerate][${rid}] ERROR:`, msg);
    return NextResponse.json({ message: msg, error: true }, { status: 500 });
  }
}
