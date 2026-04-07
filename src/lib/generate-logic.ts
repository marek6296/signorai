import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

let openaiClient: OpenAI | null = null;
export function getOpenAIClient() {
    if (openaiClient) return openaiClient;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    openaiClient = new OpenAI({ apiKey });
    return openaiClient;
}

let geminiClient: GoogleGenAI | null = null;
export function getGeminiClient() {
    if (geminiClient) return geminiClient;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY nie je nastavený v .env.local.");
    }
    geminiClient = new GoogleGenAI({ apiKey });
    return geminiClient;
}

export async function runFinalReviewAndPublish(articleId: string, keepAsDraft: boolean = false) {
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
3. TITLE QA — skontroluj a prípadne prepiš nadpis podľa pravidiel profesionálnej žurnalistiky:
   - Konkrétny, informatívny nadpis: obsahuje subjekt + kľúčový fakt alebo akciu.
   - Max 12 slov, prirodzená slovenčina.
   - PRÍSNY ZÁKAZ týchto slov (ak sa vyskytujú, nadpis MUSÍŠ prepísať): "Revolúcia", "Neuveriteľné", "Navždy zmení", "Prelomový", "Šokujúce", "Tajomstvo", "Revolučný", "Neuveriteľný".
   - Vzor dobrého nadpisu: "Anthropic vydáva Claude 3.7 s rozšíreným uvažovaním", "OpenAI spúšťa nový model o3 pre výskumníkov".
   - Ak je nadpis v poriadku, ponechaj ho nezmenený.
4. Vybrať najvhodnejšiu kategóriu (povolené: AI, Tech, Návody & Tipy).
5. Zhodnotiť poskytnutú úvodnú fotografiu (ak je k dispozícii). Ak je fotka kvalitná a súvisí s témou (je to skutočná novinárska fotografia alebo relevantný záber), ponechaj "image_needs_replacement": false. Ak obrázok nedáva zmysel, je nekvalitný, pixelový alebo ide len o ikonu/logo, nastav "image_needs_replacement": true.
6. Vráť LEN čistý JSON, žiadny iný text.

Vráť LEN JSON objekt v tvare:
{
  "title": "upravený nadpis",
  "excerpt": "čistý úryvok bez HTML",
  "ai_summary": "čisté zhrnutie bez HTML",
  "content": "upravený HTML obsah",
  "category": "Vybraná Kategória",
  "image_needs_replacement": boolean
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
    if (reviewedData.image_needs_replacement) {
        console.log(`>>> [Final Review] Image flagged as bad. Generating a new photorealistic replacement via Gemini...`);
        try {
            const ai = getGeminiClient();
            const prompt = `Generate a photorealistic, editorial-quality photograph for a technology news article header.
Topic: ${reviewedData.title || article.title}
Context: ${reviewedData.excerpt || article.excerpt}

STYLE — think Associated Press or Reuters editorial photograph:
- Real-world environment: corporate office, conference room, data center, product launch stage, university lab
- Natural or professional studio lighting
- People at work, engineers, product close-ups, office environments, company buildings

STRICT PROHIBITIONS (generate NONE of these):
- Glowing orbs, energy balls, plasma spheres
- Neon lights, neon glow, neon-lit rooms
- Electric lightning, sparks, electrical arcs
- Sci-fi particle systems, floating particles, light streams
- Abstract blue/purple energy waves
- Holographic overlays, holographic displays
- Futuristic fantasy environments, CGI "AI visualization" clichés

OUTPUT: 16:9 landscape, NO text, NO watermarks, NO logos, NO trademarked branding, NO real celebrities.`;

            const imageResult = await ai.models.generateContent({
                model: 'gemini-2.0-flash-preview-image-generation',
                contents: prompt,
                config: {
                    // @ts-ignore
                    aspectRatio: "16:9",
                    personGeneration: "ALLOW_ADULT"
                }
            });

            if (imageResult.candidates?.[0]?.content?.parts) {
                for (const part of imageResult.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const buffer = Buffer.from(part.inlineData.data, 'base64');
                        const ext = (part.inlineData.mimeType || 'image/png').includes('png') ? 'png' : 'jpg';
                        const filename = `article-generated/${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
                        
                        const adminSupabase = createClient(
                            process.env.NEXT_PUBLIC_SUPABASE_URL!,
                            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                        );

                        const { data: uploadData, error: uploadError } = await adminSupabase.storage
                            .from('social-images')
                            .upload(filename, buffer, { contentType: part.inlineData.mimeType || 'image/png', upsert: true });

                        if (!uploadError && uploadData) {
                            const { data: urlData } = adminSupabase.storage.from('social-images').getPublicUrl(filename);
                            finalImageUrl = urlData.publicUrl;
                            console.log(`>>> [Final Review] Successfully generated new main image: ${finalImageUrl}`);
                        }
                        break;
                    }
                }
            }
        } catch (e) {
            console.error(">>> [Final Review] Failed to generate replacement main image:", e);
        }
    }

    const updatePayload: Record<string, unknown> = {
        title: reviewedData.title || article.title,
        excerpt: reviewedData.excerpt || article.excerpt,
        ai_summary: reviewedData.ai_summary || article.ai_summary,
        content: reviewedData.content || article.content,
        category: reviewedData.category || article.category,
        main_image: finalImageUrl,
    };
    if (!keepAsDraft) {
        updatePayload.status = 'published';
        updatePayload.published_at = article.published_at || new Date().toISOString();
    }
    const { error: updateError } = await supabase
        .from('articles')
        .update(updatePayload)
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

// ── Build smart image search queries from article title ──────────────────────
// Returns 2-3 queries to try in order: specific → general
function buildImageSearchQueries(title: string): string[] {
    const queries: string[] = [title];

    const lowerTitle = title.toLowerCase();

    // Known brands/companies/products — map to a targeted photo search
    const entityMap: [string, string][] = [
        ['openai', 'OpenAI headquarters office photo'],
        ['chatgpt', 'ChatGPT OpenAI office photo'],
        ['anthropic', 'Anthropic AI company office photo'],
        ['claude', 'Anthropic Claude AI photo'],
        ['gemini', 'Google Gemini AI photo'],
        ['google', 'Google headquarters office photo'],
        ['alphabet', 'Google Alphabet headquarters photo'],
        ['meta', 'Meta headquarters Menlo Park photo'],
        ['facebook', 'Facebook Meta office photo'],
        ['instagram', 'Instagram Meta office photo'],
        ['microsoft', 'Microsoft headquarters Redmond photo'],
        ['copilot', 'Microsoft Copilot AI photo'],
        ['nvidia', 'NVIDIA headquarters Jensen Huang photo'],
        ['apple', 'Apple Park headquarters photo'],
        ['amazon', 'Amazon AWS headquarters photo'],
        ['tesla', 'Tesla factory Elon Musk photo'],
        ['spacex', 'SpaceX rocket launch photo'],
        ['samsung', 'Samsung headquarters Seoul photo'],
        ['deepmind', 'Google DeepMind office photo'],
        ['mistral', 'Mistral AI startup office photo'],
        ['llama', 'Meta Llama AI model photo'],
        ['grok', 'xAI Grok Elon Musk photo'],
        ['elon musk', 'Elon Musk official photo'],
        ['sam altman', 'Sam Altman OpenAI photo'],
        ['sundar pichai', 'Sundar Pichai Google photo'],
        ['mark zuckerberg', 'Mark Zuckerberg Meta photo'],
        ['tim cook', 'Tim Cook Apple photo'],
        ['satya nadella', 'Satya Nadella Microsoft photo'],
    ];

    for (const [keyword, specificQuery] of entityMap) {
        if (lowerTitle.includes(keyword)) {
            if (specificQuery !== title) queries.push(specificQuery);
            break;
        }
    }

    // Also try first 3 words + "photo" as a shorter fallback query
    const shortQuery = title.split(/\s+/).slice(0, 3).join(' ') + ' photo editorial';
    if (shortQuery !== title && !queries.includes(shortQuery)) {
        queries.push(shortQuery);
    }

    return queries;
}

// ── Image suitability check via GPT-4o mini vision ───────────────────────────
// Returns false when the image is not a real photograph, is irrelevant to the
// article topic, or is a UI screenshot / CGI / abstract visualization.
async function isPhotoSuitable(imageUrl: string, articleTitle?: string): Promise<boolean> {
    if (!imageUrl || !imageUrl.startsWith('http')) return false;
    try {
        const topicClause = articleTitle
            ? `\n\nThe article is about: "${articleTitle}"\nAlso answer NO if the image is clearly unrelated to this topic (e.g. a newspaper from a different country, random street sign, completely off-topic scene).`
            : "";

        const res = await getOpenAIClient().chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 5,
            messages: [{
                role: "user",
                content: [
                    { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
                    {
                        type: "text",
                        text: `Is this image a real-world photograph suitable as a news article header image? Answer only YES or NO.

Answer NO if it is ANY of these:
- UI screenshot, app mockup, screen recording
- Presentation slide, marketing slide, infographic, diagram, chart
- 3D render, CGI image, computer-generated art
- Digital illustration, digital painting, vector art
- Abstract concept visualization (glowing orbs, neon lights, energy waves, particle effects, sci-fi environments)
- Stock illustration or clip art
- Newspaper/magazine front page or printed text close-up
- Any image dominated by large text, headlines or logos unrelated to the topic
- Any image that is clearly NOT a real photograph of the real world${topicClause}

Answer YES only if this is a genuine real-world photograph relevant to the topic: people, buildings, offices, products, events, etc.`
                    }
                ]
            }]
        });
        const answer = (res.choices[0]?.message?.content || "").trim().toUpperCase();
        const ok = answer.startsWith("YES");
        console.log(`>>> [ImgCheck] ${ok ? "✅ suitable" : "❌ rejected"}: ${imageUrl.substring(0, 70)}... (AI: ${answer})`);
        return ok;
    } catch (e) {
        console.warn(">>> [ImgCheck] Vision check failed (non-fatal, assuming suitable):", e);
        return true;
    }
}

// ── Generate a hero image with Gemini when no suitable photo found ────────────
async function generateHeroImage(title: string, excerpt: string, category: string): Promise<string | null> {
    console.log(`>>> [ImgCheck] Generating AI hero image for: "${title}"`);
    try {
        const ai = getGeminiClient();
        const prompt = `Generate a photorealistic, editorial-quality photograph for a technology news article header.
Topic: ${title}
Context: ${excerpt || title}
Category: ${category}

STYLE — think Associated Press or Reuters news photograph:
- Real-world environment: corporate office, conference room, data center, product launch stage, university lab, city skyline
- Natural or professional studio lighting, NOT dramatic neon
- People using technology, engineers at work, product close-ups, office environments, or landmark buildings

STRICT PROHIBITIONS (generate NONE of these):
- Glowing orbs, energy balls, plasma spheres
- Neon lights, neon glow, neon-lit rooms
- Electric lightning, sparks, electrical arcs
- Sci-fi particle systems, floating particles, light streams
- Abstract blue/purple energy waves
- Holographic overlays, holographic displays
- Futuristic fantasy environments
- Any CGI-looking "AI visualization" clichés

OUTPUT: 16:9 landscape, NO text, NO watermarks, NO logos, NO UI elements.`;

        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash-preview-image-generation",
            contents: prompt,
            config: { responseModalities: ["IMAGE", "TEXT"] }
        });

        const parts = result.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            const inlineData = (part as any).inlineData;
            if (inlineData?.mimeType?.startsWith('image/') && inlineData.data) {
                const buffer = Buffer.from(inlineData.data, 'base64');
                const adminSupabase = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                );
                const filename = `hero-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.jpg`;
                const { data: uploadData, error: uploadError } = await adminSupabase.storage
                    .from('social-images')
                    .upload(filename, buffer, { contentType: 'image/jpeg', upsert: false });
                if (!uploadError && uploadData) {
                    const { data: urlData } = adminSupabase.storage.from('social-images').getPublicUrl(filename);
                    console.log(`>>> [ImgCheck] ✅ AI hero image generated: ${urlData.publicUrl}`);
                    return urlData.publicUrl;
                }
            }
        }
        console.warn(">>> [ImgCheck] Gemini returned no image parts");
    } catch (e) {
        console.error(">>> [ImgCheck] Hero image generation failed:", e);
    }
    return null;
}

// ── Pick the best suitable main image: scraped → search → generate → fallback ─
async function resolveSuitableMainImage(
    candidates: string[],            // already-extracted URLs to try first
    title: string,
    excerpt: string,
    category: string,
    fallbackUrl: string
): Promise<string> {
    // 1. Check each scraped candidate
    for (const candidate of candidates) {
        if (!candidate || !candidate.startsWith('http')) continue;
        if (await isPhotoSuitable(candidate, title)) return candidate;
    }

    // 2. Try image search — multiple smart queries before giving up
    console.log(">>> [ImgCheck] No suitable scraped image — searching Google Images...");
    const searchQueries = buildImageSearchQueries(title);
    for (const q of searchQueries) {
        console.log(`>>> [ImgCheck] Trying image search query: "${q}"`);
        const searched = await searchImage(q);
        if (searched && await isPhotoSuitable(searched, title)) return searched;
    }

    // 3. Generate with Gemini — last resort only
    console.log(">>> [ImgCheck] Search yielded no suitable photo — generating with Gemini...");
    const generated = await generateHeroImage(title, excerpt, category);
    if (generated) return generated;

    // 4. Ultimate fallback
    console.log(">>> [ImgCheck] All options exhausted — using fallback placeholder");
    return fallbackUrl;
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

export async function processArticleFromUrl(url: string, targetStatus: 'draft' | 'published' = 'draft', forcedCategory?: string, model: 'gpt-4o' | 'gemini' = 'gpt-4o', fallbackTitle?: string, fallbackContent?: string) {
    try {
        // 0. Validate URL — reject known unscrapable URL patterns (unless fallback provided)
        const BLOCKED_URL_PATTERNS = [
            'vertexaisearch.cloud.google.com',
            'grounding-api-redirect',
        ];
        for (const pattern of BLOCKED_URL_PATTERNS) {
            if (url.includes(pattern) && !fallbackTitle && !fallbackContent) {
                throw new Error(`Táto URL je Google interný presmerovací odkaz a nedá sa priamo spracovať. Otvorte odkaz v prehliadači, skopírujte skutočnú URL článku a skúste znova.`);
            }
        }

        // 1. Scraping — non-fatal when fallback content is available
        console.log(`>>> [Logic] Scraping URL with timeout: ${url}`);
        let doc: InstanceType<typeof JSDOM> | null = null;
        let parsedArticle: { title?: string | null; textContent?: string | null; content?: string | null } | null = null;

        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5"
                },
                signal: AbortSignal.timeout(15000) // 15s timeout
            });

            if (response.ok) {
                const html = await response.text();
                doc = new JSDOM(html, { url });
                const reader = new Readability(doc.window.document);
                parsedArticle = reader.parse();
            } else {
                console.warn(`>>> [Logic] URL returned status ${response.status}. Using fallback content.`);
            }
        } catch (fetchErr) {
            console.warn(`>>> [Logic] URL fetch failed: ${fetchErr}. Using fallback content.`);
        }

        // If scraping yielded nothing and there's no fallback, fail clearly
        const hasScrapedContent = !!(parsedArticle?.textContent?.trim());
        const hasFallback = !!(fallbackTitle || fallbackContent);
        if (!hasScrapedContent && !hasFallback) {
            throw new Error(`Nepodarilo sa načítať obsah stránky. Web môže blokovať botov. Skúste iný zdroj.`);
        }

        // Effective source content (scraped wins, fallback is secondary)
        const effectiveTitle = parsedArticle?.title || fallbackTitle || url;
        const effectiveText = parsedArticle?.textContent || fallbackContent || fallbackTitle || "";
        const effectiveHtmlContent = parsedArticle?.content || fallbackContent || "";

        // 2. Define the instructions
        const promptSystem = `Si šéfredaktor a novinár pre prestížny AI & Tech portál AIWai. Píšeš v štýle The Verge, MIT Technology Review a Wired — presne, odborne a bez senzacionalizmu.
Bude ti zadaný zdrojový text. Napíš z neho profesionálny článok v STOPERCENTNEJ ČISTEJ SLOVENČINE.

ZÁVÄZNÉ PRAVIDLÁ:
1. STRIKTNÁ SLOVENČINA: Žiadne české slová, žiadne bohemizmy.
2. ŽIADNY STROJOVÝ PREKLAD: Text ako od slovenského technologického novinára.
3. Plynulý žurnalistický štýl. Odborné pojmy vysvetľuj v kontexte.
4. Rozčleň text na odseky s h2/h3 podnadpismi.
5. NADPIS — profesionálny novinársky štýl:
   - Konkrétny, informatívny, obsahuje subjekt + kľúčový fakt alebo akciu
   - Max 12 slov, prirodzená slovenčina
   - PRÍSNY ZÁKAZ: "Revolúcia", "Neuveriteľné", "Navždy zmení", "Prelomový", "Šokujúce", "Tajomstvo"
   - Vzor dobrého nadpisu: "Anthropic vydáva Claude 3.7 s rozšíreným uvažovaním" alebo "Google testuje AI agentov pre automatizáciu pracovných procesov"

PRAVIDLÁ PRE KATEGORIZÁCIU:
- AI: Vývoj AI, nové modely (GPT, Claude, Gemini, Grok), výskum AI, GPU čipy, agenty, AI bezpečnosť, regulácia AI.
- Tech: Spotrebná elektronika, smartfóny, softvér, sociálne siete, internet.
- Návody & Tipy: Praktické tutoriály na AI nástroje.

Tvoj výstup VŽDY EXAKTNE VO FORMÁTE JSON (žiadny markdown okolo JSON):
{
    "title": "Profesionálny novinársky nadpis v slovenčine",
    "slug": "url-friendly-nazov-bez-diakritiky-a-medzier",
    "excerpt": "Perex: 1 až 2 informatívne vety ktoré zhŕňajú jadro správy.",
    "content": "Článok v HTML s p, strong, h2, h3.",
    "ai_summary": "PRESNE 1-2 krátke vety. Výstižné zhrnutie jadra správy pre audio. Nie viac.",
    "category": "JEDNA Z TÝCHTO: AI, Tech, Návody & Tipy"
}
Nikdy nevracaj inú kategóriu. Nikdy nevracaj markdown bloky okolo JSON.`;


        // 3. Generate article content with chosen AI
        let articleData: any = null;

        if (model === 'gemini') {
            console.log(">>> [Logic] Generating article with Gemini 2.5 Flash...");
            const client = getGeminiClient();
            
            // Build the full prompt in one string per official docs pattern
            const finalPrompt = `${promptSystem}

Spracuj tento článok zo zdroja:
TITULOK: ${effectiveTitle}
OBSAH: ${effectiveText.substring(0, 8000)}

DÔLEŽITÉ: Odpovedaj VÝHRADNE v čistom JSON formáte. Žiadny markdown, žiadny text pred ani po JSON.`;

            try {
                const result = await client.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: finalPrompt,
                });

                const text = result.text || "";
                console.log(">>> [Logic] Gemini response received, length:", text.length);
                
                if (!text) {
                    const reason = result.candidates?.[0]?.finishReason;
                    throw new Error(`Gemini vrátil prázdnu odpoveď (finishReason: ${reason || 'unknown'}).`);
                }

                // Robust JSON parsing - strip any markdown wrappers
                const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    console.error(">>> [Logic] Raw Gemini text:", text.substring(0, 500));
                    throw new Error("Gemini nevrátil platný JSON.");
                }
                articleData = JSON.parse(jsonMatch[0]);
                console.log(">>> [Logic] Gemini Article parsed successfully:", articleData.title);
            } catch (geminiError: any) {
                console.error(">>> [Logic] Gemini Error:", geminiError.message || geminiError);
                throw new Error(`Gemini chyba: ${geminiError.message || "API error"}`);
            }
        } else {
            console.log(">>> [Logic] Generating with OpenAI (GPT-4o)...");
            const completion = await getOpenAIClient().chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: promptSystem },
                    { role: "user", content: `Spracuj tento článok: ${effectiveTitle}\n\nZdrojové HTML:\n${effectiveHtmlContent || effectiveText}` }
                ],
                response_format: { type: "json_object" }
            });

            const gptResponse = completion.choices[0].message.content;
            if (!gptResponse) throw new Error("Empty response from OpenAI");
            articleData = JSON.parse(gptResponse);
            console.log("OpenAI JSON parsed successfully, article title:", articleData.title);
        }

        // ── Image extraction & suitability check ──────────────────────────────
        const AI_FALLBACK_IMAGE = `https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200`;

        // Collect raw candidate URLs from the scraped page
        const rawImageCandidates: string[] = [];
        try {
            const document = doc?.window.document;
            if (document) {
                const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
                const twitterImage = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
                const firstImg = document.querySelector('article img')?.getAttribute('src') || document.querySelector('img')?.getAttribute('src');
                const origin = (() => { try { return new URL(url).origin; } catch { return ''; } })();
                for (const src of [ogImage, twitterImage, firstImg]) {
                    if (!src) continue;
                    const absolute = src.startsWith('http') ? src : src.startsWith('/') ? `${origin}${src}` : null;
                    if (absolute) rawImageCandidates.push(absolute);
                }
            }
        } catch (e) {
            console.warn(">>> [Logic] Image candidate extraction failed:", e);
        }

        // Pick best suitable image: scraped candidates → search → generate → fallback
        const mainImage = await resolveSuitableMainImage(
            rawImageCandidates,
            articleData.title || effectiveTitle,
            articleData.excerpt || "",
            forcedCategory || "AI",
            AI_FALLBACK_IMAGE
        );

        // ── Strip all original inline images unconditionally ────────────────────
        let cleanContent: string = articleData.content || '';
        if (cleanContent) {
            // Remove completely all original <img> tags
            cleanContent = cleanContent.replace(/<img[^>]*>/gi, '');

            console.log(">>> [Logic] Generating TWO fresh AI inline images...");
            
            const generateInlineImage = async (suffix: string) => {
                try {
                    const ai = getGeminiClient();
                    const prompt = `Generate a photorealistic, editorial-quality photograph for a technology news article.
Topic: ${articleData.title}
Visual focus: ${suffix}
Context: ${articleData.excerpt || ''}

STYLE — think Associated Press or Reuters editorial photograph:
- Real-world environment: corporate office, conference room, data center, product launch, university lab, city
- Natural or professional studio lighting
- People at work, engineers, product close-ups, office environments, company buildings

STRICT PROHIBITIONS (generate NONE of these):
- Glowing orbs, energy balls, plasma spheres
- Neon lights, neon glow, neon-lit rooms
- Electric lightning, sparks, electrical arcs
- Sci-fi particle systems, floating particles, light streams
- Abstract blue/purple energy waves
- Holographic overlays, holographic displays
- 3D renders, CGI, digital art, illustrations
- Futuristic fantasy environments, any "AI visualization" clichés
- 3D letters or text as the main subject

OUTPUT: 16:9 landscape, NO text overlays, NO watermarks, NO trademarked logos, NO real celebrities.`;

                    const imageResult = await ai.models.generateContent({
                        model: 'gemini-2.0-flash-preview-image-generation',
                        contents: prompt,
                        config: {
                            // @ts-ignore
                            aspectRatio: "16:9",
                            personGeneration: "ALLOW_ADULT"
                        }
                    });

                    if (imageResult.candidates?.[0]?.content?.parts) {
                        for (const part of imageResult.candidates[0].content.parts) {
                            if (part.inlineData && part.inlineData.data) {
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
                    console.error(">>> [Logic] Failed to generate inline image:", e);
                }
                return null;
            };

            // Generate two images in parallel to avoid linear timeouts
            const [url1, url2] = await Promise.all([
                generateInlineImage("The innovative hardware, product, or core subject"),
                generateInlineImage("The futuristic impact, environment, or global context")
            ]);

            // Inject the generated images gracefully after the 1st and 4th paragraphs
            let pCount = 0;
            let successCount = 0;
            cleanContent = cleanContent.replace(/<\/p>/gi, (match) => {
                pCount++;
                if (pCount === 1 && url1) {
                    successCount++;
                    return `</p>\n<figure class="my-8"><img src="${url1}" alt="Ilustračný obrázok k článku" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
                }
                if (pCount === 4 && url2) {
                    successCount++;
                    return `</p>\n<figure class="my-8"><img src="${url2}" alt="Doplnkový obrázok k článku" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
                }
                return match;
            });
            
            // If article was too short for the 4th paragraph but we generated url2, append it at the end
            if (url2 && pCount < 4) {
                successCount++;
                cleanContent += `\n<figure class="my-8"><img src="${url2}" alt="Doplnkový obrázok k článku" class="rounded-2xl w-full object-cover aspect-video shadow-md"/></figure>\n`;
            }

            console.log(`>>> [Logic] Successfully added ${successCount} AI-generated inline images.`);

            articleData.content = cleanContent;
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
        // 3. Save to Supabase (Upsert approach for slug, insert for unique source_url)
        const dbData = {
            title: articleData.title || parsedArticle.title || "Bez názvu",
            slug: (articleData.slug || 'article-' + Date.now()) + "-" + Math.random().toString(36).substring(2, 7),
            excerpt: articleData.excerpt || "Spracovaný obsah cez AI.",
            content: articleData.content || parsedArticle.content || "Obsah sa nepodarilo vygenerovať správne.",
            category: finalCategory,
            ai_summary: articleData.ai_summary || "",
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

        // Always run GPT quality review — for drafts keepAsDraft=true (no publish), for published keepAsDraft=false
        console.log(`>>> [Logic] Running GPT quality review (keepAsDraft=${targetStatus !== 'published'})...`);
        try {
            await runFinalReviewAndPublish(data.id, targetStatus !== 'published');
        } catch (reviewErr) {
            console.warn(">>> [Logic] GPT review failed (non-fatal), article saved as-is:", reviewErr);
        }
        const { data: updatedData } = await supabase.from('articles').select().eq('id', data.id).single();
        if (updatedData) data = updatedData;

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
3. NADPIS — profesionálny novinársky štýl:
   - Konkrétny, informatívny, obsahuje subjekt + kľúčový fakt alebo akciu
   - Max 12 slov, prirodzená slovenčina
   - PRÍSNY ZÁKAZ: "Revolúcia", "Neuveriteľné", "Navždy zmení", "Prelomový", "Šokujúce", "Tajomstvo"
   - Vzor dobrého nadpisu: "Anthropic vydáva Claude 3.7 s rozšíreným uvažovaním"
4. HTML ŠTRUKTÚRA: p, strong, h2, h3 tagy pre prehľadnosť.

Výstup VŽDY EXAKTNE VO FORMÁTE JSON:
{
    "title": "Profesionálny novinársky nadpis v slovenčine",
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

        // 6. PHASE: Find a relevant image (with suitability check)
        const searchQuery = articleData.image_search_query || articleData.title;
        console.log(`>>> [Logic] Searching for a relevant image using query: "${searchQuery}"...`);
        const mainImage = await resolveSuitableMainImage(
            [], // no scraped candidates for topic-based articles
            searchQuery,
            articleData.excerpt || "",
            finalCategory,
            getPlaceholderImage(finalCategory)
        );

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

        // Always run GPT quality review — for drafts keepAsDraft=true (no publish), for published keepAsDraft=false
        console.log(`>>> [Logic] Running GPT quality review (keepAsDraft=${targetStatus !== 'published'})...`);
        try {
            await runFinalReviewAndPublish(data.id, targetStatus !== 'published');
            const { data: updatedData } = await supabase.from('articles').select().eq('id', data.id).single();
            if (updatedData) data = updatedData;
        } catch (reviewErr) {
            console.warn(">>> [Logic] GPT review failed (non-fatal), article saved as-is:", reviewErr);
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
