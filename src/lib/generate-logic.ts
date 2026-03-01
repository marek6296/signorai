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

export async function searchWeb(query: string) {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.warn(">>> [Search] SERPER_API_KEY is not set, skipping web search.");
        return "";
    }

    try {
        console.log(`>>> [Search] Searching Google for: "${query}"`);
        const response = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
                "X-API-KEY": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: query, gl: "sk", hl: "sk" }),
        });

        const data = await response.json();

        interface SerperResult {
            title: string;
            link: string;
            snippet: string;
        }

        // Extract relevant bits from organic results
        const snippets = (data.organic as SerperResult[] | undefined)?.map((res) =>
            `Title: ${res.title}\nSource: ${res.link}\nSnippet: ${res.snippet}`
        ).join("\n\n") || "";

        return snippets;
    } catch (error) {
        console.error(">>> [Search] Error during web search:", error);
        return "";
    }
}

export async function searchImage(query: string): Promise<string | null> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) return null;

    try {
        console.log(`>>> [Image Search] Searching Google Images for: "${query}"`);
        const response = await fetch("https://google.serper.dev/images", {
            method: "POST",
            headers: {
                "X-API-KEY": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: query, gl: "sk", hl: "sk", num: 5 }),
        });

        interface SerperImageResult {
            imageUrl: string;
            title: string;
            source: string;
        }

        const data = await response.json();
        if (data.images && data.images.length > 0) {
            // Pick the first image that looks like a real image URL
            const firstImage = (data.images as SerperImageResult[]).find((img) => img.imageUrl && img.imageUrl.startsWith('http'))?.imageUrl;
            return firstImage || null;
        }
        return null;
    } catch (error) {
        console.error(">>> [Image Search] Error during image search:", error);
        return null;
    }
}

const VALID_CATEGORIES = [
    "Novinky SK/CZ",
    "AI",
    "Tech",
    "Biznis",
    "Krypto",
    "Svet",
    "Politika",
    "Veda",
    "Gaming",
    "Návody & Tipy",
    "Newsletter",
    "Iné"
];

export async function scrapeUrl(url: string): Promise<string> {
    try {
        console.log(`>>> [Scraper] Scraping full content from: ${url}`);
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5"
            },
            signal: AbortSignal.timeout(15000) // 15s timeout per page
        });

        if (!response.ok) return "";

        const html = await response.text();
        const doc = new JSDOM(html, { url });
        const reader = new Readability(doc.window.document);
        const parsedArticle = reader.parse();

        return parsedArticle?.textContent?.substring(0, 10000) || ""; // Limit to 10k chars per source
    } catch (e) {
        console.warn(`>>> [Scraper] Failed to scrape ${url}:`, e);
        return "";
    }
}

export async function processArticleFromUrl(url: string, targetStatus: 'draft' | 'published' = 'draft', forcedCategory?: string) {
    try {
        // 1. Scraping
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
8. ZÁKAZ DOSLOVNÉHO KOPÍROVANIA: Článok nesmie byť doslovným prekladom alebo kópiou zdrojového textu. Tvojou úlohou je informácie pochopiť, SYNTETIZOVAŤ a napísať ÚPLNE NOVÝ, ORIGINÁLNY TEXT pri zachovaní faktov. Meň poradie informácií, pridávaj kontext a používaj vlastnú slovnú zásobu. Vyhni sa kopírovaniu celých viet zo zdroja.
9. PONECHAJ VŠETKY OBRÁZKY! Ak sa v zdrojom HTML nachádzajú značky <img>, nevyrezávaj ich, ale vlož ich do svojho preloženého HTML presne na to miesto, kam patria.
10. CLICKBAIT STRATÉGIA: Nadpis musí byť extrémne pútavý, v štýle moderných virálnych médií, aby maximalizoval mieru prekliku (click-through rate). Musí však čestne odkazovať na tému článku – nezavádzaj, ale vyvolaj silnú zvedavosť alebo emóciu. Používaj silné slovesá, prekvapivé fakty alebo otázky.

PRAVIDLÁ PRE KATEGORIZÁCIU (Buď veľmi prísny a presný!):
- Novinky SK/CZ: Lokálne správy, udalosti v SR a ČR, slovenskí/českí politici a domáce firmy.
- AI: Vývoj AI, nové modely (GPT, Claude), čipy, hlboké technológie a budúcnosť AI.
- Tech: Spotrebná elektronika (mobily, laptopy), sociálne siete, internetové služby a gadgety.
- Biznis: Ekonomika, akcie, fúzie firiem, startupy a správy zo sveta financií.
- Krypto: Bitcoin, blockchain, burzy a regulácia kryptomien.
- Svet: Významné udalosti zo zahraničia, globálne trendy a zaujímavosti bez silného politického podtextu.
- Politika: Vlády, voľby, medzinárodné vzťahy a diplomacia (mimo SR/ČR).
- Veda: Vesmír, medicína, technológie, ktoré menia svet a akademický výskum.
- Gaming: Videohry, herný hardvér, herný priemysel a herné e-športy.
- Návody & Tipy: Praktické tutoriály, "ako na to", rady a triky.
- Iné: Len ak téma ČESTNE A ABSOLÚTNE NESADÁ do žiadnej z vyššie uvedených kategórií.

DÔLEŽITÉ: Ak ide o biznis tech firmy (napr. rast akcií Microsoftu), je to Biznis. Ak ide o politické regulácie AI v USA, je to Politika. Ak ide o slovenského politika, sú to Novinky SK/CZ.

Tvoj výstup musí byť VŽDY EXAKTNE VO FORMÁTE JSON:
{
    "title": "Virálny, extrémne pútavý clickbait nadpis, ktorý však presne odráža tému v dokonalej slovenčine",
    "slug": "url-friendly-nazov-bez-diakritiky-a-medzier",
    "excerpt": "Perex: 1 až 2 veľmi pútavé odseky.",
    "content": "Samotný dlhý článok v HTML s <p>, <strong>, <h2>, <h3> a pôvodnými <img>.",
    "ai_summary": "Pútavé, podrobné a komplexné zhrnutie článku (približne 10 až 15 viet, rozdelených do 2 až 3 prehľadných odsekov), ktoré slúži ako plnohodnotná audio verzia kľúčových informácií z článku pre poslucháča. Zhrnutie musí pokryť všetky dôležité body článku, nie len úvod.",
    "category": "JEDNA Z TÝCHTO: Novinky SK/CZ, AI, Tech, Biznis, Krypto, Svet, Politika, Veda, Gaming, Návody & Tipy, Newsletter, Iné"
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

            finalCategory = found || "Iné";
        } else {
            finalCategory = "Iné";
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
            status: targetStatus,
            published_at: new Date().toISOString()
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

export async function processArticleFromTopic(userPrompt: string, targetStatus: 'draft' | 'published' = 'draft') {
    try {
        console.log(`>>> [Logic] Deep research started for: ${userPrompt}`);

        // 1. PHASE: Generate multiple optimized search queries
        const queryCompletion = await getOpenAIClient().chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "Si expert na vyhľadávanie. Na základe témy vytvor 3 výstižné a rôznorodé vyhľadávacie dopyty v slovenčine alebo angličtine, ktoré pokryjú tému z rôznych uhlov. Vráť LEN JSON pole reťazcov."
                },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" }
        });

        const queryData = JSON.parse(queryCompletion.choices[0].message.content || '{"queries":[]}');
        const searchQueries: string[] = queryData.queries || [userPrompt];

        // 2. PHASE: Perform multi-search and collect URLs
        console.log(`>>> [Logic] Executing searches for: ${searchQueries.join(", ")}`);
        const allOrganicResults: { title: string, link: string, snippet: string }[] = [];

        for (const q of searchQueries) {
            try {
                const res = await fetch("https://google.serper.dev/search", {
                    method: "POST",
                    headers: {
                        "X-API-KEY": process.env.SERPER_API_KEY || "",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ q: q, gl: "sk", hl: "sk", num: 5 }),
                });
                const data = await res.json();
                if (data.organic) allOrganicResults.push(...data.organic);
            } catch {
                console.error("Search failed for query:", q);
            }
        }

        // 2.5 Filter out links that are already in the database
        const { data: existingArticles } = await supabase.from('articles').select('source_url').not('source_url', 'is', null);
        const processedUrls = new Set((existingArticles || []).map(a => a.source_url));

        const freshResults = allOrganicResults.filter(r => !processedUrls.has(r.link));

        if (freshResults.length < allOrganicResults.length) {
            console.log(`>>> [Logic] Filtered out ${allOrganicResults.length - freshResults.length} already processed links.`);
        }

        // Deduplicate and pick top 4 unique links from fresh results
        const uniqueLinks = Array.from(new Set(freshResults.map(r => r.link))).slice(0, 4);

        if (uniqueLinks.length === 0 && allOrganicResults.length > 0) {
            console.log(">>> [Logic] All top search results were already processed. Forcing use of top results to avoid empty article.");
            uniqueLinks.push(...Array.from(new Set(allOrganicResults.map(r => r.link))).slice(0, 2));
        }

        // 3. PHASE: Scrape top sources
        console.log(`>>> [Logic] Scraping top ${uniqueLinks.length} sources...`);
        const scrapedContents = await Promise.all(uniqueLinks.map(link => scrapeUrl(link)));
        const combinedScrapedText = scrapedContents.filter(Boolean).join("\n\n--- ZDROJ ---\n\n");

        // 4. PHASE: Prepare context
        const contextDataSnippet = `
TU SÚ KOMPLETNÉ TEXTY Z TOP ZDROJOV:
${combinedScrapedText}

TU SÚ ÚRYVKY Z OSTATNÝCH VÝSLEDKOV:
${allOrganicResults.slice(0, 10).map(r => `Title: ${r.title}\nSnippet: ${r.snippet}`).join("\n\n")}
`;

        const finalUserPrompt = `
Pôvodné zadanie: ${userPrompt}

${contextDataSnippet}

Inštrukcia: Na základe týchto hĺbkových faktov napíš komplexný, originálny a pútavý článok v dokonalej slovenčine.
`;

        const promptSystem = `Si šéfredaktor a špičkový copywriter pre prestížny magazín Postovinky na Slovensku. Tvojou úlohou je na základe priložených hĺbkových faktov napísať prémiový, pútavý a odborne presný článok.
Máš prístup k reálnym dátam z viacerých špičkových webov. Tvojou úlohou je informácie SYNTETIZOVAŤ a napísať ÚPLNE NOVÝ a unikátny text.

ZÁVÄZNÉ PRAVIDLÁ PRE KVALITU TEXTU:
1. STRIKTNÁ A BEZCHYBNÁ SLOVENČINA: Text musí znieť 100% prirodzene, akoby ho napísal vzdelaný rodený Slovák. Dávaj obrovský pozor na logický slovosled vo vetách, pádové väzby a zhodu prídavných mien s podstatnými menami.
2. ZÁKAZ BOHEMIZMOV: Je PRÍSNE ZAKÁZANÉ používať anglicizmy, české výrazy (napr. stávajúci, rada vecí) alebo krkolomné strojové preklady.
3. PROFESIONÁLNY A PÚTAVÝ ŠTÝL: Používaj bohatú slovnú zásobu, žurnalistický štýl a dynamické slovesá. Vyhni sa ťažkopádnym súvetiam a opakujúcim sa frázam.
4. CLICKBAIT STRATÉGIA: Nadpis musí byť extrémne pútavý, v štýle moderných virálnych médií, aby maximalizoval mieru prekliku (CTR). Musí však čestne odkazovať na tému článku a byť gramaticky bezchybný (správny rod a pád).
5. ŠTRUKTÚRA HTML: "content" musí obsahovať odseky <p>, zvýraznenia <strong> pre dôležité fakty a podnadpisy <h2> alebo <h3> na plynulé čítanie dlhého textu.

Výstup VŽDY EXAKTNE VO FORMÁTE JSON:
{
    "title": "Virálny, extrémne pútavý clickbait nadpis v dokonalej a gramaticky správnej slovenčine",
    "slug": "url-friendly-nazov-bez-diakritiky-a-medzier",
    "excerpt": "Perex: 1 až 2 veľmi pútavé odseky.",
    "content": "Samotný dlhý článok v HTML s <p>, <strong>, <h2>...",
    "ai_summary": "Pútavé a komplexné zhrnutie (10 až 15 viet) pre audio verziu. Kľúčový je dynamický prednes a 100% bezchybný slovosled.",
    "category": "JEDNA Z TÝCHTO: Novinky SK/CZ, AI, Tech, Biznis, Krypto, Svet, Politika, Veda, Gaming, Návody & Tipy, Newsletter, Iné"
}`;

        // 5. PHASE: Generate the final article
        console.log(`>>> [Logic] Synthesizing final article with Deep Context...`);
        const finalCompletion = await getOpenAIClient().chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: promptSystem },
                { role: "user", content: finalUserPrompt }
            ],
            response_format: { type: "json_object" }
        });

        const gptResponse = finalCompletion.choices[0].message.content;
        if (!gptResponse) throw new Error("Empty response from OpenAI");

        const articleData = JSON.parse(gptResponse);
        // Category validation
        let finalCategory = articleData.category;
        if (typeof finalCategory === 'string') {
            finalCategory = finalCategory.trim();
            const lowerCat = finalCategory.toLowerCase();
            const found = VALID_CATEGORIES.find(c => {
                const lowerC = c.toLowerCase();
                return lowerC === lowerCat ||
                    lowerCat.includes(lowerC) ||
                    lowerC.includes(lowerCat);
            });
            finalCategory = found || "Iné";
        } else {
            finalCategory = "Iné";
        }

        // 6. PHASE: Find a relevant image
        console.log(`>>> [Logic] Searching for a relevant image for "${articleData.title}"...`);
        let mainImage = await searchImage(articleData.title);
        if (!mainImage) {
            console.log(">>> [Logic] Relevant image not found, using generic placeholder.");
            mainImage = getPlaceholderImage(finalCategory);
        }

        const dbData = {
            title: articleData.title,
            slug: articleData.slug + "-" + Math.random().toString(36).substring(2, 7),
            excerpt: articleData.excerpt,
            content: articleData.content,
            category: finalCategory,
            ai_summary: articleData.ai_summary,
            main_image: mainImage,
            source_url: `manual-agent-v2-${articleData.slug}-${Math.random().toString(36).substring(2, 7)}`,
            status: targetStatus,
            published_at: new Date().toISOString()
        };

        console.log(`>>> [Logic] Saving article to DB with status: ${targetStatus}`);
        const { data, error } = await supabase.from('articles').insert([dbData]).select().single();
        if (error) {
            console.error(">>> [Logic] Supabase insert failed:", error);
            throw error;
        }

        revalidatePath("/", "layout");
        return data;

    } catch (error) {
        console.error("Process custom prompt error:", error);
        throw error;
    }
}

function getPlaceholderImage(category: string): string {
    const images: Record<string, string> = {
        "Novinky SK/CZ": "https://images.unsplash.com/photo-1588694424679-7f7092d04239?auto=format&fit=crop&q=80&w=1200",
        "AI": "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200",
        "Tech": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1200",
        "Biznis": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=1200",
        "Krypto": "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&q=80&w=1200",
        "Svet": "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&q=80&w=1200",
        "Politika": "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&q=80&w=1200",
        "Veda": "https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80&w=1200",
        "Gaming": "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=1200",
        "Návody & Tipy": "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&q=80&w=1200"
    };
    return images[category] || "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1200";
}
