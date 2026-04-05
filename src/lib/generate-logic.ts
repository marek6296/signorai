import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

let openaiClient: OpenAI | null = null;
export function getOpenAIClient() {
    if (openaiClient) return openaiClient;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    openaiClient = new OpenAI({ apiKey });
    return openaiClient;
}

export async function runFinalReviewAndPublish(articleId: string) {
    const { data: article, error: fetchError } = await supabase
        .from('articles')
        .select('*')
        .eq('id', articleId)
        .single();

    if (fetchError || !article) {
        throw new Error(`Nepodarilo sa načítať článok: ${articleId}`);
    }

    console.log(`>>> [Final Review] Checking article: ${article.title}`);

    const openai = getOpenAIClient();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
            role: "system",
            content: `Si nekompromisný Šéfredaktor spravodajského portálu. Toto je tvoja finálna kontrola pred publikovaním.
Tvoje úlohy:
1. Skontrolovať gramatiku, štylistiku a odstrániť z 'excerpt' a 'ai_summary' akékoľvek HTML značky (napr. <p>). Ponechaj text čistý.
2. Skontrolovať zhodu textu, preklepy. 
3. Vybrať najvhodnejšiu kategóriu (povolené: AI, Tech, Návody & Tipy).
4. Zhodnotiť poskytnutú fotografiu (ak je k dispozícii). Ak je fotka kvalitná a súvisí s témou, ponechaj "image_needs_replacement": false. Ak obrázok nedáva zmysel, je nekvalitný, chýba alebo ide o nejaké divné logo/miniatúru, nastav true a poskytni presný ANGLICKÝ 2-4 slovný vyhľadávací dotaz do Googlu pre získanie novej fotky.

Zároveň vrátiš upravené texty podľa bodu 1 a 2.
Vráť LEN JSON objekt v tvare:
{
  "title": "upravený nadpis",
  "excerpt": "čistý úryvok bez HTML",
  "ai_summary": "čisté zhrnutie bez HTML",
  "content": "upravený HTML obsah",
  "category": "Vybraná Kategória",
  "image_needs_replacement": boolean,
  "new_image_search_query": "anglický dotaz alebo prázdny string"
}`
        }
    ];

    const userContentArr: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
        {
            type: "text",
            text: `Aktuálne dáta článku:
NADPIS: ${article.title}
KATEGÓRIA: ${article.category}
ÚRYVOK: ${article.excerpt}
ZHRNUTIE: ${article.ai_summary || ""}
OBSAH: ${article.content}`
        }
    ];

    if (article.main_image && article.main_image.startsWith('http')) {
        userContentArr.push({
            type: "image_url",
            image_url: {
                url: article.main_image,
                detail: "low"
            }
        });
    }

    messages.push({
        role: "user",
        content: userContentArr
    });

    let res;
    try {
        res = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.2
        });
    } catch (openAiError: unknown) {
        const errorMsg = openAiError instanceof Error ? openAiError.message : String(openAiError);
        console.warn(`>>> [Final Review] OpenAI failed (possibly inaccessible image url): ${errorMsg}`);
        console.log(`>>> [Final Review] Retrying without the image URL...`);
        // Remove the image_url part and retry
        const textOnlyContentArr = userContentArr.filter(part => part.type === 'text');
        messages.pop(); // Remove the last user message with image
        messages.push({
            role: "user",
            content: textOnlyContentArr
        });

        res = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.2
        });
    }

    const reply = res.choices[0]?.message?.content || "{}";
    const reviewedData = JSON.parse(reply);

    console.log(`>>> [Final Review] AI decision:`, reviewedData);

    let finalImageUrl = article.main_image;
    if (reviewedData.image_needs_replacement && reviewedData.new_image_search_query) {
        console.log(`>>> [Final Review] Finding new image with query: ${reviewedData.new_image_search_query}`);
        const newImg = await searchImage(reviewedData.new_image_search_query);
        if (newImg) {
            finalImageUrl = newImg;
        }
    }

    const { error: updateError } = await supabase
        .from('articles')
        .update({
            title: reviewedData.title || article.title,
            excerpt: reviewedData.excerpt || article.excerpt,
            ai_summary: reviewedData.ai_summary || article.ai_summary,
            content: reviewedData.content || article.content,
            category: reviewedData.category || article.category,
            main_image: finalImageUrl,
            status: 'published',
            published_at: article.published_at || new Date().toISOString()
        })
        .eq('id', articleId);

    if (updateError) throw updateError;

    if (article.slug) {
        revalidatePath(`/article/${article.slug}`, 'page');
    }
    revalidatePath('/', 'layout');
    revalidatePath('/kategoria/[kategoria]', 'page');

    return { success: true, articleId };
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
            body: JSON.stringify({ q: query, gl: "us", hl: "en", num: 15 }),
        });

        interface SerperImageResult {
            imageUrl: string;
            title: string;
            source: string;
            imageWidth?: number;
            imageHeight?: number;
        }

        const data = await response.json();
        if (data.images && data.images.length > 0) {
            // Sort images by width (descending) to prefer high-res images and filter out small or suspicious ones
            const sortedImages = (data.images as SerperImageResult[])
                .filter(img => img.imageUrl && img.imageUrl.startsWith('http') && !img.imageUrl.includes('fbsbx') && !img.imageUrl.includes('licdn') && !img.imageUrl.includes('lookaside'))
                .sort((a, b) => {
                    const widthA = a.imageWidth || 0;
                    const widthB = b.imageWidth || 0;
                    return widthB - widthA;
                });

            // Pick a large enough image (width >= 800) or just fallback to the largest available.
            const bestImage = sortedImages.find(img => (img.imageWidth || 0) >= 800) || sortedImages[0];
            return bestImage?.imageUrl || null;
        }
        return null;
    } catch (error) {
        console.error(">>> [Image Search] Error during image search:", error);
        return null;
    }
}

const VALID_CATEGORIES = [
    "AI",
    "Tech",
    "Návody & Tipy",
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
        const promptSystem = `Si šéfredaktor a špičkový copywriter pre prestížny AI & Tech magazín AIWai. Bude ti zadaný zdrojový text z nejakého webu.
Tvojou úlohou je napísať z neho prémiový, pútavý a odborne presný článok o UMELEJ INTELIGENCII alebo TECHNOLÓGIÁCH v STOPERCENTNEJ, ČISTEJ a PRIRODZENEJ SLOVENČINE.

ZÁVÄZNÉ PRAVIDLÁ PRE KVALITU TEXTU:
1. STRIKTNÁ SLOVENČINA: Text musí byť písaný výhradne v slovenčine. Je PRÍSNE ZAKÁZANÉ používať české slová alebo bohemizmy.
2. ŽIADNY STROJOVÝ PREKLAD: Text musí znieť tak, akoby ho napísal rodený Slovák, ktorý je expertom na AI a technológie.
3. KRITICKÁ GRAMATIKA: Gramatické pády a rody musia byť 100% správne.
4. Plynulý žurnalistický štýl. Vyhni sa anglicizmom a krkolomným prekladom.
5. Bezchybná slovenská štylistika. Ak je zdroj v češtine, dôkladne PRELOŽ.
6. Rozčleň text na menšie odseky s podnadpismi (h2 alebo h3).
7. ZÁKAZ KOPÍROVANIA: SYNTETIZUJ a napíš ÚPLNE NOVÝ TEXT pri zachovaní faktov.
8. PONECHAJ OBRÁZKY: img tagy vlož presne na miesto.
9. CLICKBAIT: Nadpis musí byť extrémne pútavý a čestne odkazovať na tému.

PRAVIDLÁ PRE KATEGORIZÁCIU:
- AI: Vývoj AI, nové modely (GPT, Claude, Gemini, Grok), výskum AI, GPU čipy, agenty, AI bezpečnosť, regulácia AI.
- Tech: Spotrebná elektronika, smartfóny, softvér, sociálne siete, internet.
- Návody & Tipy: Praktické tutoriály na AI nástroje.

Tvoj výstup VŽDY EXAKTNE VO FORMÁTE JSON:
{
    "title": "Virálny nadpis v dokonalej slovenčine",
    "slug": "url-friendly-nazov-bez-diakritiky-a-medzier",
    "excerpt": "Perex: 1 až 2 pútavé odseky.",
    "content": "Článok v HTML s p, strong, h2, h3 a img.",
    "ai_summary": "Zhrnutie (10-15 viet) pre audio verziu.",
    "category": "JEDNA Z TÝCHTO: AI, Tech, Návody & Tipy"
}
Nikdy nevracaj inú kategóriu.`;

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

            finalCategory = found || "AI";
        } else {
            finalCategory = "AI";
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
        const { data: insertedData, error } = await supabase.from('articles').insert([dbData]).select().single();
        let data = insertedData;

        if (error) {
            console.error("Supabase insert error:", error);
            throw error;
        }

        console.log("Supabase save success, ID:", data.id);

        if (targetStatus === 'published') {
            console.log("Running final review before publishing...");
            await runFinalReviewAndPublish(data.id);
            // Fetch the updated data after review to return it
            const { data: updatedData } = await supabase.from('articles').select().eq('id', data.id).single();
            if (updatedData) data = updatedData;
        }

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

        const promptSystem = `Si šéfredaktor a špičkový copywriter pre prestížny AI & Tech magazín AIWai. Na základe priložených faktov napíš prémiový článok o umelej inteligencii alebo technológiách.
Máš prístup k reálnym dátam. Informácie SYNTETIZUJ a napíš ÚPLNE NOVÝ unikátny text.

ZÁVÄZNÉ PRAVIDLÁ:
1. STRIKTNÁ SLOVENČINA: 100% prirodzená slovenčina, žiadne bohemizmy ani anglicizmy.
2. PROFESIONÁLNY ŠTÝL: Bohatá slovná zásoba, žurnalistický štýl, dynamické slovesá.
3. CLICKBAIT NADPIS: Extrémne pútavý, gramaticky správny, čestne odkazujúci na tému.
4. HTML ŠTRUKTÚRA: p, strong, h2, h3 tagy pre prehľadnosť.

Výstup VŽDY EXAKTNE VO FORMÁTE JSON:
{
    "title": "Virálny nadpis v dokonalej slovenčine",
    "slug": "url-friendly-nazov-bez-diakritiky-a-medzier",
    "excerpt": "Perex: 1 až 2 pútavé odseky.",
    "content": "Článok v HTML s p, strong, h2...",
    "ai_summary": "Zhrnutie (10-15 viet) pre audio verziu.",
    "category": "JEDNA Z TÝCHTO: AI, Tech, Návody & Tipy",
    "image_search_query": "Short English AI tech image search query (max 4 words)."
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
            finalCategory = found || "AI";
        } else {
            finalCategory = "AI";
        }

        // 6. PHASE: Find a relevant image
        const searchQuery = articleData.image_search_query || articleData.title;
        console.log(`>>> [Logic] Searching for a relevant image using query: "${searchQuery}"...`);
        let mainImage = await searchImage(searchQuery);
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
        const { data: insertedData, error } = await supabase.from('articles').insert([dbData]).select().single();
        let data = insertedData;
        if (error) {
            console.error(">>> [Logic] Supabase insert failed:", error);
            throw error;
        }

        if (targetStatus === 'published') {
            console.log(">>> [Logic] Running final review before publishing...");
            await runFinalReviewAndPublish(data.id);
            const { data: updatedData } = await supabase.from('articles').select().eq('id', data.id).single();
            if (updatedData) data = updatedData;
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
        "AI": "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200",
        "Tech": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1200",
        "Návody & Tipy": "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&q=80&w=1200"
    };
    return images[category] || "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200";
}
