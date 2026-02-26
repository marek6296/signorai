import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

let openaiClient: OpenAI | null = null;
function getOpenAIClient() {
    if (openaiClient) return openaiClient;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    openaiClient = new OpenAI({ apiKey });
    return openaiClient;
}

const VALID_CATEGORIES = [
    "Novinky SK/CZ",
    "Umelá Inteligencia",
    "Tech",
    "Biznis",
    "Krypto",
    "Svet",
    "Politika",
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
        console.log(`Scraped ${html.length} characters from ${url}`);

        const doc = new JSDOM(html, { url });
        const reader = new Readability(doc.window.document);
        const parsedArticle = reader.parse();

        if (!parsedArticle || !parsedArticle.textContent) {
            console.error("Readability failed to parse:", url);
            throw new Error("Could not parse article from the provided URL");
        }

        console.log("Readability success, title:", parsedArticle.title);

        // 2. Generate article with OpenAI
        const promptSystem = `Si šéfredaktor a špičkový copywriter pre prestížny magazín Postovinky na Slovensku. Bude ti zadaný zdrojový text z nejakého webu.
Tvojou úlohou je napísať z neho prémiový, pútavý a odborne presný článok v STOPERCENTNEJ, ČISTEJ a PRIRODZENEJ SLOVENČINE.

ZÁVÄZNÉ PRAVIDLÁ PRE KVALITU TEXTU:
1. STRIKTNÁ SLOVENČINA: Text musí byť písaný výhradne v slovenčine. Je PRÍSNE ZAKÁZANÉ používať české slová, české konštrukcie alebo "bohemizmy" (napr. NIKDY nepoužívaj slová ako "taky", "prodej", "řada", "včetně" v českom význame, "doporučit", "stávající", "vzhledem k", ak existuje slovenské "odporučiť", "existujúci", "vzhľadom na").
2. ŽIADNY STROJOVÝ PREKLAD: Text musí znieť tak, akoby ho napísal rodený Slovák, ktorý je expertom na technológie.
3. KRITICKÁ GRAMATIKA: Dávaj si extrémny pozor na ZHODU RODOV (napr. NIKDY nepíš "jedno nastavenia", ale "jedno nastavenie" alebo "jednej položky"). Gramatické pády a rody musia byť 100% správne.
4. Plynulý žurnalistický štýl s prirodzenými vetnými konštrukciami. Vyhni sa anglicizmom a krkolomným doslovným prekladom.
5. Bezchybná slovenská štylistika je podmienkou. Ak je zdroj v češtine, musíš ho dôkladne PRELOŽIŤ, nie len "poslovenčiť".
6. Rozčleň text na menšie, ľahko čitateľné odseky.
7. Vytvor logickú štruktúru s podnadpismi (<h2> alebo <h3>). 
8. PONECHAJ VŠETKY OBRÁZKY! Ak sa v zdrojom HTML nachádzajú značky <img>, nevyrezávaj ich, ale vlož ich do svojho preloženého HTML presne na to miesto, kam patria.

PRAVIDLÁ PRE KATEGORIZÁCIU (Buď veľmi prísny a presný!):
- Novinky SK/CZ: Akýkoľvek článok týkajúci sa Slovenska alebo Česka (domáce správy, SK/CZ politici, udalosti v regiónoch, lokálne firmy). TOTO MÁ ABSOLÚTNU PRIORITU. Ak sa v článku spomína SR alebo ČR, ide to SEM.
- Gaming: Všetko o videohrách (PS5, Xbox, PC hry), herných službách a hardvéri. Ak ide o hru, patrí sem, aj keď ju poháňa AI.
- Krypto: Bitcoin, Ethereum, blockchain, burzy, regulácie kryptomien.
- Umelá Inteligencia: LEN články, ktoré sú o VÝVOJI AI (nové modely GPT, Claude, Gemini), hlbokej technológii AI, čipoch (Nvidia H100) alebo budúcnosti AI. Ak je AI len funkcia v aplikácii, daj to do Tech.
- Tech: Spotrebná elektronika (nové mobily, laptopy), sociálne siete (Meta, X, TikTok, Instagram), internetové služby a gadgety.
- Biznis: Akcie, ekonomika, fúzie firiem, startupy a správy zo sveta korporácií.
- Politika: Vládne rozhodnutia, parlament, politické kampane, medzinárodná diplomacia a štátne záležitosti (ak to nie je primárne SK/CZ).
- Svet: Zaujímavosti zo sveta, prírodné úkazy, globálne trendy a udalosti, ktoré nemajú primárne politický charakter.
- Veda: Vesmír, medicína, kvantová fyzika a akademický výskum.
- Návody & Tipy: "Ako urobiť...", tutoriály, praktické rady.
- Newsletter: Len pre súhrnné týždenné novinky.

DÔLEŽITÉ: Ak ide o biznis tech firmy (napr. rast akcií Microsoftu), je to Biznis. Ak ide o politické regulácie AI v USA, je to Politika. Ak ide o slovenského politika, sú to Novinky SK/CZ.

Tvoj výstup musí byť VŽDY EXAKTNE VO FORMÁTE JSON:
{
    "title": "Úderný, presný a pútavý nadpis v dokonalej a gramaticky správnej slovenčine",
    "slug": "url-friendly-nazov-bez-diakritiky-a-medzier",
    "excerpt": "Perex: 1 až 2 veľmi pútavé odseky.",
    "content": "Samotný dlhý článok v HTML s <p>, <strong>, <h2>, <h3> a pôvodnými <img>.",
    "ai_summary": "Pútavé, podrobné a komplexné zhrnutie článku (približne 10 až 15 viet, rozdelených do 2 až 3 prehľadných odsekov), ktoré slúži ako plnohodnotná audio verzia kľúčových informácií z článku pre poslucháča. Zhrnutie musí pokryť všetky dôležité body článku, nie len úvod.",
    "category": "JEDNA Z TÝCHTO: Novinky SK/CZ, Umelá Inteligencia, Tech, Biznis, Krypto, Svet, Politika, Veda, Gaming, Návody & Tipy, Newsletter"
}
Nikdy nevracaj žiadnu inú kategóriu. AI dávaj len ak je to jadro správy. Pred odoslaním si v duchu skontroluj, či sa v nadpise zhoduje podstatné meno s prídavným menom v správnom rode a páde.`;

        const completion = await getOpenAIClient().chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: promptSystem },
                { role: "user", content: `Spracuj tento článok: ${parsedArticle.title}\n\nZdrojové HTML:\n${parsedArticle.content}` }
            ],
            response_format: { type: "json_object" }
        });

        const gptResponse = completion.choices[0].message.content;
        if (!gptResponse) throw new Error("Empty response from OpenAI");

        console.log("OpenAI raw response received");
        const articleData = JSON.parse(gptResponse);
        console.log("OpenAI JSON parsed successfully, article title:", articleData.title);

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

        console.log("Saving to Supabase...");
        const { data, error } = await supabase.from('articles').insert([dbData]).select().single();

        if (error) {
            console.error("Supabase insert error:", error);
            throw error;
        }

        console.log("Supabase save success, ID:", data.id);

        // 4. Revalidate
        revalidatePath("/", "layout");

        return data;

    } catch (error) {
        console.error("Process article error:", error);
        throw error;
    }
}
