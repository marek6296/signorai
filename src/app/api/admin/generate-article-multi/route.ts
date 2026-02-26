import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function scrapeUrl(url: string) {
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
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
            content: parsedArticle?.content || "", // Use HTML content instead of textContent
            images: Array.from(new Set(images)).slice(0, 5), // Unique top 5 images
            url
        };
    } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        return null;
    }
}

export async function POST(request: NextRequest) {
    try {
        const { urls, secret } = await request.json();

        // 1. Authorization
        if (secret !== process.env.ADMIN_SECRET) {
            return NextResponse.json({ message: "Invalid token" }, { status: 401 });
        }

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ message: "At least one URL is required" }, { status: 400 });
        }

        // 2. Scrape all URLs in parallel
        const scrapeResults = await Promise.all(urls.map(url => scrapeUrl(url)));
        const validResults = scrapeResults.filter(r => r !== null);

        if (validResults.length === 0) {
            return NextResponse.json({ message: "Could not parse content from any of the provided URLs" }, { status: 422 });
        }

        // 3. Prepare synthesis prompt
        const combinedContent = validResults.map((res, i) =>
            `ZDROJ č. ${i + 1} (${res.url}):\nTITULOK: ${res.title}\nOBSAH: ${res.content.substring(0, 5000)}`
        ).join("\n\n---\n\n");

        const allImages = validResults.flatMap(r => r.images || []);

        const promptSystem = `Si šéfredaktor a špičkový copywriter pre prestížny magazín o umelej inteligencii POSTOVINKY na Slovensku. 
Dostaneš materiály z NIEKOĽKÝCH RÔZNYCH ZDROJOV. Tvojou úlohou je vykonať ich hĺbkovú syntézu do jedného prémiového článku.

ZÁVÄZNÉ PRAVIDLÁ PRE KVALITU A ŠTRUKTÚRU:
1. Žiadny strojový preklad. Text musí znieť ako od špičkového slovenského technologického novinára.
2. ŠTRUKTÚRA AKO Z JEDNÉHO ZDROJA: Článok nesmie pôsobiť ako zoznam zhrnutí. Musí mať plynulý dej, logické podnadpisy (<h2>, <h3>) a bohaté odseky.
3. VIZUÁLNA BOHATOSŤ (OBRÁZKY): Toto je kritické. Dostaneš zoznam URL adries obrázkov z pôvodných zdrojov. MUSÍŠ ich vložiť priamo do kľúča "content" pomocou značky <img src="URL">. Rozmiestni ich rovnomerne a logicky medzi odseky (aspoň jeden obrázok každých 2-3 odseky, ak sú dostupné). Používaj len URL zo zoznamu.
4. TRUTH EXTRACTION: Ak zdroje hovoria o tom istom, zjednoť to. Ak sa rozchádzajú, vysvetli oba pohľady.
5. POUŽÍVAJ HTML: Pre formátovanie používaj výhradne <p>, <h2>, <h3>, <strong> a <img>.

VÝSTUP MUSÍ BYŤ EXAKTNE VO FORMÁTE JSON:
{
    "title": "Úderný nadpis v dokonalej slovenčine",
    "slug": "url-friendly-nazov",
    "excerpt": "Perex v slovenčine (1-2 pútavé odseky).",
    "content": "Samotný syntetizovaný článok v HTML. Obsahuje text aj <img> značky s obrázkami zo zoznamu!",
    "ai_summary": "Extrémne stručné a inteligentné zhrnutie (max 2 vety).",
    "category": "Najnovšie, Umelá Inteligencia, Tech, Biznis, Krypto, Svet & Politika, Veda, Gaming, Návody & Tipy, Newsletter",
    "selected_main_image_url": "URL kľúčového obrázka pre miniatúru článku",
    "research_insights": "Krátky postreh o syntéze."
}
Vráť len čistý JSON.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: promptSystem },
                { role: "user", content: `TU SÚ ZDROJOVÉ MATERIÁLY PRE SYNTÉZU:\n\n${combinedContent}\n\nZOZNAM DOSTUPNÝCH OBRÁZKOV:\n${allImages.join("\n")}` }
            ],
            response_format: { type: "json_object" }
        });

        const gptResponse = completion.choices[0].message.content;
        if (!gptResponse) throw new Error("Empty response from OpenAI");

        const articleData = JSON.parse(gptResponse);

        // Smart image selection: Use AI selection if valid, otherwise fallback
        let mainImage = articleData.selected_main_image_url;
        if (!mainImage || !mainImage.startsWith('http')) {
            mainImage = allImages[0] || `https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200`;
        }

        // Validate category
        const validCategories = ["Najnovšie", "Umelá Inteligencia", "Tech", "Biznis", "Krypto", "Svet & Politika", "Veda", "Gaming", "Návody & Tipy", "Newsletter"];
        let finalCategory = articleData.category;
        if (typeof finalCategory === 'string') {
            finalCategory = finalCategory.trim();
            const matchingCategory = validCategories.find(c => c.toLowerCase() === finalCategory.toLowerCase());
            finalCategory = matchingCategory || "Umelá Inteligencia";
        } else {
            finalCategory = "Umelá Inteligencia";
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
            source_url: urls.join(", "),
            status: 'draft'
        };

        const { data, error } = await supabase.from('articles').insert([dbData]).select().single();

        if (error) throw error;

        revalidatePath("/", "layout");

        return NextResponse.json({ success: true, article: data });

    } catch (error: unknown) {
        console.error("Multi-generate article error:", error);
        return NextResponse.json({ message: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
    }
}
