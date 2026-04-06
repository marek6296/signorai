import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { runFinalReviewAndPublish } from "@/lib/generate-logic";

export const runtime = "nodejs";
export const maxDuration = 300;

const LEGACY_SECRET = "make-com-webhook-secret";

function getGeminiClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY nie je nastavený v prostredí.");
    return new GoogleGenAI({ apiKey });
}

async function scrapeUrl(url: string) {
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) return null;

        const html = await response.text();
        const doc = new JSDOM(html, { url });
        const reader = new Readability(doc.window.document);
        const parsedArticle = reader.parse();

        // Extract images
        const images: string[] = [];
        const document = doc.window.document;
        const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        if (ogImage) images.push(ogImage);
        document.querySelectorAll('article img, img').forEach(img => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('http')) images.push(src);
        });

        return {
            title: parsedArticle?.title || "",
            content: parsedArticle?.textContent?.substring(0, 6000) || "",
            images: Array.from(new Set(images)).slice(0, 5),
            url
        };
    } catch (error) {
        console.error(`>>> [Multi] Error scraping ${url}:`, error);
        return null;
    }
}

const VALID_CATEGORIES = ["AI", "Tech", "Návody & Tipy"];

export async function POST(request: NextRequest) {
    try {
        const { urls, secret } = await request.json();

        // 1. Authorization
        if (secret !== process.env.ADMIN_SECRET && secret !== LEGACY_SECRET) {
            return NextResponse.json({ message: "Invalid token" }, { status: 401 });
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ message: "GEMINI_API_KEY nie je nastavený." }, { status: 500 });
        }

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ message: "Aspoň jedna URL je povinná." }, { status: 400 });
        }

        // 2. Scrape all URLs in parallel
        console.log(`>>> [Multi] Scraping ${urls.length} URL(s)...`);
        const scrapeResults = await Promise.all(urls.map((u: string) => scrapeUrl(u)));
        const validResults = scrapeResults.filter(r => r !== null) as NonNullable<Awaited<ReturnType<typeof scrapeUrl>>>[];

        if (validResults.length === 0) {
            return NextResponse.json({ message: "Nepodarilo sa extrahovať obsah z žiadnej URL adresy." }, { status: 422 });
        }

        // 3. Prepare combined content for Gemini
        const combinedContent = validResults.map((res, i) =>
            `ZDROJ č. ${i + 1} (${res.url}):\nTITULOK: ${res.title}\nOBSAH: ${res.content}`
        ).join("\n\n---\n\n");

        const allImages = validResults.flatMap(r => r.images || []);

        const promptSystem = `Si šéfredaktor a špičkový copywriter pre prestížny AI & Tech magazín AIWai na Slovensku.
Dostaneš materiály z NIEKOĽKÝCH RÔZNYCH ZDROJOV. Tvojou úlohou je vykonať ich hĺbkovú syntézu do jedného prémiového článku.

ZÁVÄZNÉ PRAVIDLÁ:
1. Žiadny strojový preklad. Text musí znieť ako od špičkového slovenského technologického novinára.
2. ŠTRUKTÚRA AKO Z JEDNÉHO ZDROJA: Plynulý dej, logické podnadpisy (<h2>, <h3>), bohaté odseky.
3. TRUTH EXTRACTION: Ak zdroje hovoria o tom istom, zjednoť to. Ak sa rozchádzajú, vysvetli oba pohľady.
4. POUŽÍVAJ HTML: <p>, <h2>, <h3>, <strong>. Žiadne <img> tagy — obrázky vygenerujeme samostatne.
5. CLICKBAIT STRATÉGIA: Nadpis musí byť extrémne pútavý v štýle moderných virálnych médií, no čestne odkazovať na tému.
6. STRIKTNÁ SLOVENČINA: Žiadne bohemizmy, žiadne anglicizmy.
7. KATEGÓRIA: Vyber PRESNE jednu z: AI | Tech | Návody & Tipy

Výstup VÝHRADNE ako čistý JSON (bez markdown, bez \`\`\` blokov):
{
    "title": "Virálny nadpis v dokonalej slovenčine",
    "slug": "url-friendly-nazov-bez-diakritiky",
    "excerpt": "Perex — 1 až 2 pútavé odseky.",
    "content": "Syntetizovaný článok v HTML (p, h2, h3, strong).",
    "ai_summary": "Maximálne 2 vety — výstižné zhrnutie jadra pre audio.",
    "category": "AI alebo Tech alebo Návody & Tipy",
    "selected_main_image_url": "${allImages.length > 0 ? allImages[0] : ""}"
}`;

        const userPrompt = `TU SÚ ZDROJOVÉ MATERIÁLY PRE SYNTÉZU:\n\n${combinedContent}\n\nDOSTUPNÉ OBRÁZKY ZO ZDROJOV (vyber jeden ako hlavný):\n${allImages.join("\n") || "žiadne"}`;

        // 4. Generate with Gemini 2.5 Flash
        console.log(">>> [Multi] Generating synthesis article with Gemini 2.5 Flash...");
        const ai = getGeminiClient();
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `${promptSystem}\n\n${userPrompt}`,
        });

        const rawText = result.text || "";
        console.log(">>> [Multi] Gemini response length:", rawText.length);

        if (!rawText) {
            throw new Error("Gemini vrátil prázdnu odpoveď.");
        }

        // Robust JSON parsing
        const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error(">>> [Multi] Raw Gemini text:", rawText.substring(0, 500));
            throw new Error("Gemini nevrátil platný JSON. Skús znovu.");
        }
        const articleData = JSON.parse(jsonMatch[0]);

        // 5. Category validation
        let finalCategory = (articleData.category || "").trim();
        const lowerCat = finalCategory.toLowerCase();
        const found = VALID_CATEGORIES.find(c =>
            c.toLowerCase() === lowerCat || lowerCat.includes(c.toLowerCase()) || c.toLowerCase().includes(lowerCat)
        );
        finalCategory = found || "AI";

        // 6. Main image: prefer AI-selected, fallback to first scraped, then Unsplash
        let mainImage: string = articleData.selected_main_image_url || "";
        if (!mainImage || !mainImage.startsWith('http')) {
            mainImage = allImages[0] || "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200";
        }

        // 7. Generate 2 AI inline images with Gemini and inject into content
        let cleanContent: string = articleData.content || "";
        if (cleanContent) {
            console.log(">>> [Multi] Generating AI inline images...");

            const generateInlineImage = async (suffix: string): Promise<string | null> => {
                try {
                    const prompt = `Generate a photorealistic, ultra-high quality cinematic image for a technology news article. Focus: ${suffix}.
Theme: ${articleData.title}
CRITICAL: NO real public figures, NO trademarked logos. NO text, NO watermarks. Realistic editorial photography.`;

                    const imageResult = await ai.models.generateContent({
                        model: 'gemini-3.1-flash-image-preview',
                        contents: prompt,
                        config: {
                            // @ts-ignore
                            aspectRatio: "16:9",
                            personGeneration: "ALLOW_ADULT"
                        }
                    });

                    if (imageResult.candidates?.[0]?.content?.parts) {
                        for (const part of imageResult.candidates[0].content.parts) {
                            if (part.inlineData?.data) {
                                const buffer = Buffer.from(part.inlineData.data, 'base64');
                                const ext = (part.inlineData.mimeType || 'image/png').includes('png') ? 'png' : 'jpg';
                                const filename = `article-generated/${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`;

                                const adminSupabase = createClient(
                                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                                    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                                );
                                const { data: uploadData, error: uploadError } = await adminSupabase.storage
                                    .from('social-images')
                                    .upload(filename, buffer, { contentType: part.inlineData.mimeType || 'image/png', upsert: true });

                                if (!uploadError && uploadData) {
                                    const { data: urlData } = adminSupabase.storage.from('social-images').getPublicUrl(filename);
                                    return urlData.publicUrl;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error(">>> [Multi] Failed to generate inline image:", e);
                }
                return null;
            };

            const [imgUrl1, imgUrl2] = await Promise.all([
                generateInlineImage("The core subject, product or technology"),
                generateInlineImage("The broader impact, environment or global context")
            ]);

            // Inject after 1st and 4th paragraph
            let pCount = 0;
            cleanContent = cleanContent.replace(/<\/p>/gi, (match) => {
                pCount++;
                if (pCount === 1 && imgUrl1) {
                    return `</p>\n<figure class="my-8"><img src="${imgUrl1}" alt="Ilustračný obrázok" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
                }
                if (pCount === 4 && imgUrl2) {
                    return `</p>\n<figure class="my-8"><img src="${imgUrl2}" alt="Doplnkový obrázok" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
                }
                return match;
            });
            if (imgUrl2 && pCount < 4) {
                cleanContent += `\n<figure class="my-8"><img src="${imgUrl2}" alt="Doplnkový obrázok" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
            }
        }

        // 8. Save to Supabase as draft
        const dbData = {
            title: articleData.title,
            slug: (articleData.slug || 'article-' + Date.now()) + "-" + Math.random().toString(36).substring(2, 7),
            excerpt: articleData.excerpt,
            content: cleanContent || articleData.content,
            category: finalCategory,
            ai_summary: articleData.ai_summary || "",
            main_image: mainImage,
            source_url: urls.join(", "),
            status: 'draft',
            published_at: new Date().toISOString()
        };

        console.log(">>> [Multi] Saving draft to Supabase...");
        const { data: insertedData, error } = await supabase.from('articles').insert([dbData]).select().single();
        if (error) throw error;

        let data = insertedData;

        // 9. GPT quality review (keeps as draft)
        console.log(">>> [Multi] Running GPT quality review (keepAsDraft=true)...");
        try {
            await runFinalReviewAndPublish(data.id, true);
            const { data: updatedData } = await supabase.from('articles').select().eq('id', data.id).single();
            if (updatedData) data = updatedData;
        } catch (reviewErr) {
            console.warn(">>> [Multi] GPT review failed (non-fatal), article saved as-is:", reviewErr);
        }

        revalidatePath("/", "layout");

        return NextResponse.json({ success: true, article: data });

    } catch (error: unknown) {
        console.error(">>> [Multi] CRITICAL ERROR:", error);
        return NextResponse.json({ message: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
    }
}
