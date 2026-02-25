import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { url, secret } = await request.json();

        // 1. Authorization
        if (secret !== process.env.ADMIN_SECRET) {
            return NextResponse.json({ message: "Invalid token" }, { status: 401 });
        }

        if (!url) {
            return NextResponse.json({ message: "URL is required" }, { status: 400 });
        }

        // 2. Scrape the content
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5"
            },
        });

        if (!response.ok) {
            return NextResponse.json({ message: `Failed to fetch URL, status: ${response.status}` }, { status: response.status });
        }

        const html = await response.text();
        const doc = new JSDOM(html, { url });
        const reader = new Readability(doc.window.document);
        const parsedArticle = reader.parse();

        if (!parsedArticle || !parsedArticle.textContent) {
            return NextResponse.json({ message: "Could not parse article from the provided URL" }, { status: 422 });
        }

        // 3. Generate article with OpenAI
        const promptSystem = `Si šéfredaktor a špičkový copywriter pre prestížny magazín o umelej inteligencii SignorAI na Slovensku. Bude ti zadaný zdrojový text z nejakého webu.
Tvojou úlohou je napísať z neho prémiový, pútavý a odborne presný článok v STOPERCENTNEJ a PRIRODZENEJ SLOVENČINE.

ZÁVÄZNÉ PRAVIDLÁ PRE KVALITU TEXTU:
1. Žiadny strojový preklad. Text musí znieť tak, akoby ho napísal rodený Slovák, ktorý je expertom na technológie.
2. Používaj plynulý, žurnalistický štýl s prirodzenými vetnými konštrukciami. Vyhni sa anglicizmom a krkolomným doslovným prekladom (napríklad nepoužívaj "na konci dňa", "robí zmysel", prekladaj do pekných slovenských fráz).
3. Bezchybná slovenská gramatika a štylistika je úplnou samozrejmosťou a podmienkou.
4. Rozčleň text na menšie, ľahko čitateľné odseky, udrž dobre štruktúrovaný rytmus textu.
5. Vytvor logickú štruktúru s podnadpismi (<h2> alebo <h3>). 
6. PONECHAJ VŠETKY OBRÁZKY! Ak sa v zdrojom HTML nachádzajú značky <img>, nevyrezávaj ich, ale vlož ich do svojho preloženého HTML presne na to miesto, kam patria (nemeň ich src parametre).

Tvoj výstup musí byť VŽDY EXAKTNE VO FORMÁTE JSON, ktorý obsahuje nasledovné kľúče:
{
    "title": "Úderný, presný a pútavý nadpis v dokonalej slovenčine (vyhni sa clickbaitu)",
    "slug": "url-friendly-nazov-bez-diakritiky-a-medzier",
    "excerpt": "Perex: 1 až 2 veľmi pútavé odseky, ktoré čitateľa vtiahnu do deja alebo vysvetlia podstatu článku (v slovenčine).",
    "content": "Samotný dlhý článok v dokonalej slovenčine naformátovaný v HTML. Používaj <p> pre odseky, <strong> pre dôležité výrazy, a <h2> / <h3> pre podnadpisy. OBZVLÁŠŤ DÔLEŽITÉ: Musíš zachovať všetky <img> tagy z pôvodu!",
    "ai_summary": "Extrémne stručné a super-moderné zhrnutie článku (max. 2 vety). Musí byť vecné, inteligentné a štavnaté. V čistej slovenčine.",
    "category": "Musí byť výhradne jedna z: Najnovšie, Umelá Inteligencia, Tech, Biznis, Krypto, Svet & Politika, Veda, Návody & Tipy, Newsletter"
}
Nikdy nevracaj slovné omáčky okolo, vždy len vráť čistý json. Nepoužívaj ani formátovacie značky markdownu (napr. \`\`\`json).`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: promptSystem },
                { role: "user", content: `Spracuj tento článok: ${parsedArticle.title}\n\nZdrojové HTML:\n${parsedArticle.content}` }
            ],
            response_format: { type: "json_object" }
        });

        const gptResponse = completion.choices[0].message.content;
        if (!gptResponse) throw new Error("Empty response from OpenAI");

        const articleData = JSON.parse(gptResponse);

        // For main image, try to extract the open graph image from the scraped page.
        // Fallback to unstructured tags, or a placeholder keyword based image.
        let mainImage = `https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200`; // Fallback image for MVP

        try {
            const document = doc.window.document;
            const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
            const twitterImage = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
            const firstImg = document.querySelector('article img')?.getAttribute('src') || document.querySelector('img')?.getAttribute('src');

            const foundImage = ogImage || twitterImage || firstImg;

            if (foundImage) {
                if (foundImage.startsWith('http')) {
                    mainImage = foundImage;
                } else if (foundImage.startsWith('/')) {
                    const urlObj = new URL(url);
                    mainImage = `${urlObj.origin}${foundImage}`;
                }
            }
        } catch (e) {
            console.error("Failed to extract image, using fallback", e);
        }

        // Fix for sometimes failing category mapping from LLM
        const validCategories = [
            "Najnovšie",
            "Umelá Inteligencia",
            "Tech",
            "Biznis",
            "Krypto",
            "Svet & Politika",
            "Veda",
            "Návody & Tipy",
            "Newsletter"
        ];

        let finalCategory = articleData.category;

        if (typeof finalCategory === 'string') {
            finalCategory = finalCategory.trim();
            const matchingCategory = validCategories.find(c => c.toLowerCase() === finalCategory.toLowerCase());
            finalCategory = matchingCategory || "Umelá Inteligencia";
        } else {
            finalCategory = "Umelá Inteligencia"; // Ultimate fallback
        }

        // 4. Save to Supabase
        const dbData = {
            title: articleData.title,
            slug: articleData.slug,
            excerpt: articleData.excerpt,
            content: articleData.content,
            category: finalCategory,
            ai_summary: articleData.ai_summary,
            main_image: mainImage,
            source_url: url,
            status: 'draft'
        };

        const { data, error } = await supabase.from('articles').insert([dbData]).select().single();

        if (error) {
            console.error(error);
            return NextResponse.json({ message: "Error saving to database: " + error.message }, { status: 500 });
        }

        // 5. Revalidate
        revalidatePath("/", "layout");

        return NextResponse.json({ success: true, article: data });

    } catch (error: any) {
        console.error("Generate article error:", error);
        return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
    }
}
