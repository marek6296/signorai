import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const VALID_CATEGORIES = [
    "Novinky SK/CZ",
    "Umelá Inteligencia",
    "Tech",
    "Biznis",
    "Krypto",
    "Svet & Politika",
    "Veda",
    "Gaming",
    "Návody & Tipy",
    "Newsletter"
];

export async function processArticleFromUrl(url: string, targetStatus: 'draft' | 'published' = 'draft', forcedCategory?: string) {
    try {
        // ... scraping code remains the same ...
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5"
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL, status: ${response.status}`);
        }

        const html = await response.text();
        const doc = new JSDOM(html, { url });
        const reader = new Readability(doc.window.document);
        const parsedArticle = reader.parse();

        if (!parsedArticle || !parsedArticle.textContent) {
            throw new Error("Could not parse article from the provided URL");
        }

        // 2. Generate article with OpenAI
        const promptSystem = `Si šéfredaktor a špičkový copywriter pre prestížny magazín o umelej inteligencii Postovinky na Slovensku. Bude ti zadaný zdrojový text z nejakého webu.
Tvojou úlohou je napísať z neho prémiový, pútavý a odborne presný článok v STOPERCENTNEJ a PRIRODZENEJ SLOVENČINE.

ZÁVÄZNÉ PRAVIDLÁ PRE KVALITU TEXTU:
1. Žiadny strojový preklad. Text musí znieť tak, akoby ho napísal rodený Slovák, ktorý je expertom na technológie.
2. Používaj plynulý, žurnalistický štýl s prirodzenými vetnými konštrukciami. Vyhni sa anglicizmom a krkolomným doslovným prekladom.
3. Bezchybná slovenská gramatika a štylistika je úplnou samozrejmosťou a podmienkou.
4. Rozčleň text na menšie, ľahko čitateľné odseky.
5. Vytvor logickú štruktúru s podnadpismi (<h2> alebo <h3>). 
6. PONECHAJ VŠETKY OBRÁZKY! Ak sa v zdrojom HTML nachádzajú značky <img>, nevyrezávaj ich, ale vlož ich do svojho preloženého HTML presne na to miesto, kam patria.

PRAVIDLÁ PRE KATEGORIZÁCIU (Buď veľmi prísny a presný!):
- Novinky SK/CZ: Akýkoľvek článok týkajúci sa Slovenska alebo Česka (domáce správy, SK/CZ politici, udalosti v regiónoch, lokálne firmy). TOTO MÁ ABSOLÚTNU PRIORITU. Ak je v článku spomenuté SK/CZ, ide sem bez ohľadu na tému.
- Gaming: Všetko o videohrách, konzolách (PlayStation, Xbox, Nintendo), herných službách (PS Plus, Game Pass), e-športe a hernom hardvéri. Ak ide o hru, patrí sem, aj keď ju poháňa AI.
- Krypto: Bitcoin, Ethereum, blockchain technológie, burzy, NFT, regulácie kryptomien a Web3.
- Umelá Inteligencia: LEN články, ktoré sú PRIMÁRNE o algoritmoch, LLM (ChatGPT, Claude, Gemini), vývoji AI, čipoch pre AI alebo hlbokej automatizácii. Ak je AI len malou súčasťou iného produktu (napr. funkcia vo Photoshope), patrí to do Tech.
- Tech: Spotrebná elektronika (nové iPhony, MacBooky, Androidy), všeobecný softvér, internetové služby, sociálne siete (Meta, X, TikTok), kyberbezpečnosť a gadgety.
- Biznis: Akcie, fúzie firiem (napr. Broadcom kúpil VMware), ekonomické analýzy, startupy a správy zo sveta veľkých korporácií.
- Svet & Politika: Globálne správy, vojny, voľby v USA/EU, zahraničná politika (mimo SR/ČR).
- Veda: Vesmír (NASA, SpaceX), medicína, biológia, kvantová fyzika, nové materiály a akademický výskum.
- Návody & Tipy: Praktické postupy typu "Ako nastaviť...", "5 tipov pre...", tutoriály k nástrojom.
- Newsletter: Len ak ide o týždenný súhrn viacerých tém.

DÔLEŽITÉ: Kategória musí sedieť presne. Ak ide o finančné výsledky Apple, je to Biznis (nie Tech). Ak ide o novú hru s AI postavami, je to Gaming (nie AI). Ak ide o slovenský startup, sú to Novinky SK/CZ.

Tvoj výstup musí byť VŽDY EXAKTNE VO FORMÁTE JSON:
{
    "title": "Úderný, presný a pútavý nadpis v dokonalej slovenčine",
    "slug": "url-friendly-nazov-bez-diakritiky-a-medzier",
    "excerpt": "Perex: 1 až 2 veľmi pútavé odseky.",
    "content": "Samotný dlhý článok v HTML s <p>, <strong>, <h2>, <h3> a pôvodnými <img>.",
    "ai_summary": "Extrémne stručné a super-moderné zhrnutie (max. 2 vety).",
    "category": "JEDNA Z TÝCHTO: Novinky SK/CZ, Umelá Inteligencia, Tech, Biznis, Krypto, Svet & Politika, Veda, Gaming, Návody & Tipy, Newsletter"
}
Nikdy nevracaj žiadnu inú kategóriu. Ak váhaš medzi AI a niečím iným, daj to druhé (AI dávaj len ak je to jadro správy).`;

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

        // Image extraction
        let mainImage = `https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200`;
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
            console.error("Failed to extract image", e);
        }

        // Category validation
        let finalCategory = forcedCategory || articleData.category;

        if (typeof finalCategory === 'string') {
            finalCategory = finalCategory.trim();

            // Fuzzy/Partial matching
            const lowerCat = finalCategory.toLowerCase();
            const found = VALID_CATEGORIES.find(c => {
                const lowerC = c.toLowerCase();
                return lowerC === lowerCat ||
                    lowerCat.includes(lowerC) ||
                    lowerC.includes(lowerCat) ||
                    (lowerCat.includes('svet') && lowerC.includes('svet'));
            });

            finalCategory = found || "Umelá Inteligencia";
        } else {
            finalCategory = "Umelá Inteligencia";
        }

        // 3. Save to Supabase
        const dbData = {
            title: articleData.title,
            slug: articleData.slug,
            excerpt: articleData.excerpt,
            content: articleData.content,
            category: finalCategory,
            ai_summary: articleData.ai_summary,
            main_image: mainImage,
            source_url: url,
            status: targetStatus
        };

        const { data, error } = await supabase.from('articles').insert([dbData]).select().single();

        if (error) throw error;

        // 4. Revalidate
        revalidatePath("/", "layout");

        return data;

    } catch (error) {
        console.error("Process article error:", error);
        throw error;
    }
}
