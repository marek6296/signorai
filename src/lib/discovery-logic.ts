import Parser from "rss-parser";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { CATEGORY_MAP } from "@/lib/data";

/** Iba tieto kategórie berieme – témy mimo tohto zoznamu sa vôbec nespracúvajú. */
const ALLOWED_CATEGORIES = Object.values(CATEGORY_MAP);

let openaiClient: OpenAI | null = null;
function getOpenAIClient() {
    if (openaiClient) return openaiClient;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    openaiClient = new OpenAI({ apiKey });
    return openaiClient;
}

const parser = new Parser();

export interface DiscoveryItem {
    url: string;
    title: string;
    source: string;
    contentSnippet: string;
    groupHint: string;
    publishedAt?: string;
}

export const FEED_GROUPS: Record<string, { name: string, url: string }[]> = {
    "AI": [
        { name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml" },
        { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
        { name: "Wired AI", url: "https://www.wired.com/feed/category/ai/latest/rss" },
        { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/" },
        { name: "AI News", url: "https://www.artificialintelligence-news.com/feed/" },
        { name: "MIT Tech Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/" },
        { name: "Futurism AI", url: "https://futurism.com/feed" },
        { name: "Import AI", url: "https://jack-clark.net/feed/" },
        { name: "The Batch (DeepLearning.AI)", url: "https://www.deeplearning.ai/the-batch/feed/" },
        { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml" },
        { name: "Google DeepMind", url: "https://deepmind.google/blog/rss/" },
        { name: "Ars Technica AI", url: "https://arstechnica.com/ai/feed/" },
        { name: "TLDR AI", url: "https://tldr.tech/ai/rss" },
        { name: "The Rundown AI", url: "https://www.therundown.ai/rss" },
    ],
    "Tech": [
        { name: "Engadget", url: "https://www.engadget.com/rss.xml" },
        { name: "Ars Technica", url: "https://feeds.feedburner.com/arstechnica/index" },
        { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
        { name: "The Next Web", url: "https://thenextweb.com/feed" },
        { name: "Gizmodo", url: "https://gizmodo.com/rss" },
        { name: "9to5Mac", url: "https://9to5mac.com/feed" },
        { name: "9to5Google", url: "https://9to5google.com/feed" },
        { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
    ],
    "Návody & Tipy": [
        { name: "How-To Geek AI", url: "https://www.howtogeek.com/feed/" },
        { name: "MakeUseOf AI", url: "https://www.makeuseof.com/category/artificial-intelligence/feed/" },
        { name: "Zapier Blog", url: "https://zapier.com/blog/feeds/latest/" },
    ],
};

export const normalizeUrl = (u: string) => u.split('?')[0].toLowerCase().trim().replace(/\/$/, "");

export async function discoverNewNews(maxDays: number, targetCategories: string[] = []) {
    const newsByGroup: Record<string, DiscoveryItem[]> = {};
    const now = new Date();
    const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;

    // 0. Fetch Sources from DB vs Defaults
    let allFeeds: { name: string, url: string, category: string }[] = [];
    const { data: dbSources } = await supabase
        .from('discovery_sources')
        .select('*')
        .eq('active', true);

    if (dbSources && dbSources.length > 0) {
        allFeeds = dbSources.map(s => ({ name: s.name, url: s.url, category: s.category }));
    } else {
        // Fallback to hardcoded groups from before
        for (const [group, feeds] of Object.entries(FEED_GROUPS)) {
            feeds.forEach(f => {
                allFeeds.push({ ...f, category: group });
            });
        }
    }

    // Filter only those that match categories to fetch
    const categoriesToFetch = targetCategories.length > 0
        ? targetCategories.filter(c => ALLOWED_CATEGORIES.includes(c))
        : [...ALLOWED_CATEGORIES];

    const currentFeeds = allFeeds.filter(f => categoriesToFetch.includes(f.category));

    // Pre-fetch all known URLs to avoid thousands of DB queries
    const { data: seenArticles } = await supabase.from('articles').select('source_url');
    const { data: seenSuggestions } = await supabase.from('suggested_news').select('url');

    const seenUrls = new Set([
        ...(seenArticles?.map(a => normalizeUrl(a.source_url || "")) || []),
        ...(seenSuggestions?.map(s => normalizeUrl(s.url || "")) || [])
    ]);

    // Processing using currentFeeds instead of FEED_GROUPS
    for (const feed of currentFeeds) {
        const groupName = feed.category;
        if (!newsByGroup[groupName]) newsByGroup[groupName] = [];
        
        try {
            const response = await fetch(feed.url);
            const buffer = await response.arrayBuffer();
            const contentType = response.headers.get("content-type") || "";

            let charset = "utf-8";
            if (contentType.toLowerCase().includes("charset=")) {
                charset = contentType.toLowerCase().split("charset=")[1].split(";")[0].trim();
            }

            const decoder = new TextDecoder(charset);
            const xmlText = decoder.decode(buffer);
            const feedData = await parser.parseString(xmlText);

            for (const item of feedData.items.slice(0, 20)) {
                if (!item.link) continue;

                const normalized = normalizeUrl(item.link);
                if (seenUrls.has(normalized)) continue;

                const pubDateObj = new Date(item.isoDate || item.pubDate || "");
                const pubDateStr = pubDateObj.toISOString();

                if (now.getTime() - pubDateObj.getTime() > maxAgeMs) continue;

                newsByGroup[groupName].push({
                    url: item.link,
                    title: item.title || "",
                    source: feed.name,
                    contentSnippet: item.contentSnippet || item.content || "",
                    groupHint: groupName,
                    publishedAt: pubDateStr
                });

                seenUrls.add(normalized);
            }
        } catch (err) {
            console.error(`Error parsing feed ${feed.name}:`, err);
        }
    }

    // Rest of the discovery-logic.ts remains the same but correctly using processed newsByGroup.


    // 2. Initial Selection & URL Accessibility Check
    const candidatesByGroup: Record<string, DiscoveryItem[]> = {};
    for (const [groupName, items] of Object.entries(newsByGroup)) {
        if (items.length === 0) continue;
        const sorted = items.sort((a, b) => {
            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return dateB - dateA;
        });
        candidatesByGroup[groupName] = sorted.slice(0, 15);
    }

    const checkUrlAccessible = async (url: string): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Range": "bytes=0-2048"
                }
            });
            clearTimeout(timeoutId);

            if (res.status >= 400 && res.status !== 416) {
                console.warn(`[Discovery] URL blocked (status: ${res.status}): ${url}`);
                return false;
            }
            return true;
        } catch {
            console.warn(`[Discovery] URL unreachable (network error): ${url}`);
            return false;
        }
    };

    const accessibleByGroup: Record<string, DiscoveryItem[]> = {};
    const MIN_PER_CATEGORY = 3;
    const MAX_ACCESSIBLE_PER_GROUP = 10;

    for (const [groupName, candidates] of Object.entries(candidatesByGroup)) {
        const accessible: DiscoveryItem[] = [];
        for (const item of candidates) {
            if (accessible.length >= MAX_ACCESSIBLE_PER_GROUP) break;

            const isOk = await checkUrlAccessible(item.url);
            if (isOk) accessible.push(item);
        }
        if (accessible.length > 0) {
            accessibleByGroup[groupName] = accessible;
        }
    }

    const allAccessible = Object.values(accessibleByGroup).flat();
    if (allAccessible.length === 0) return [];

    const pool: DiscoveryItem[] = [];
    const groupNames = Object.keys(accessibleByGroup);
    const wantPerCategory = Math.max(MIN_PER_CATEGORY, Math.min(8, Math.floor(100 / groupNames.length)));

    for (const groupName of groupNames) {
        const items = accessibleByGroup[groupName].slice(0, wantPerCategory);
        pool.push(...items);
    }
    pool.sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA;
    });
    const cappedPool = pool.slice(0, 120);

    const suggestionsWithAI: { url: string; title: string; source: string; summary: string; category: string; status: string }[] = [];
    const processedUrls = new Set<string>();

    for (const item of cappedPool) {
        try {
            const completion = await getOpenAIClient().chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `Si profesionálny slovenský redaktor portálu zameraného VÝLUČNE na umelú inteligenciu a technológie. Tvojou ÚLOHOU je pripraviť tému na spracovanie.

KATEGORIZÁCIA (Buď veľmi prísny a presný!):
- AI: Vývoj AI, nové modely (GPT, Claude, Gemini, Grok), výskum AI, GPU čipy pre AI, agenty, multimodálne modely, AI bezpečnosť, regulácia AI.
- Tech: Spotrebná elektronika, softvér, smartfóny, počítače, sociálne siete, internetové služby, gadgety – ALE NIE AI (to patrí do AI).
- Návody & Tipy: Ako používať AI nástroje (ChatGPT, Midjourney, Copilot), praktické tutoriály, tipy na produktivitu s AI.

Kategória MUSÍ byť presne jedna z: ${ALLOWED_CATEGORIES.join(" | ")}.
Vráť EXAKTNE JSON: {"title": "Slovenský titulok", "summary": "Slovenské zhrnutie...", "category": "jedna z uvedených kategórií"}`
                    },
                    { role: "user", content: `Pôvodný titulok: ${item.title}\nUkážka: ${item.contentSnippet.substring(0, 500)}\nOdporúčaná kategória podľa zdroja: ${item.groupHint}` }
                ],
                response_format: { type: "json_object" }
            });

            const aiData = JSON.parse(completion.choices[0].message.content || "{}");

            const aiCategory = (aiData.category || item.groupHint || "").trim();
            const lowerAssigned = aiCategory.toLowerCase();
            const matchedCat = ALLOWED_CATEGORIES.find(c =>
                c.toLowerCase() === lowerAssigned || lowerAssigned.includes(c.toLowerCase()) || c.toLowerCase().includes(lowerAssigned)
            );

            const assignedCategory = matchedCat || "AI";
            processedUrls.add(normalizeUrl(item.url));

            suggestionsWithAI.push({
                url: item.url,
                title: aiData.title || item.title,
                source: item.source,
                summary: aiData.summary || "Zaujímavá AI téma na spracovanie.",
                category: assignedCategory,
                status: 'pending'
            });
        } catch (e) {
            console.error("AI discovery error:", item.title, e);
        }
    }

    // Doplnenie
    const byCategory = new Map<string, typeof suggestionsWithAI>();
    for (const s of suggestionsWithAI) {
        const list = byCategory.get(s.category) || [];
        list.push(s);
        byCategory.set(s.category, list);
    }

    const targetCats = categoriesToFetch.length > 0 ? categoriesToFetch : groupNames;
    for (const cat of targetCats) {
        const count = byCategory.get(cat)?.length ?? 0;
        if (count >= MIN_PER_CATEGORY) continue;

        const candidates = accessibleByGroup[cat] ?? [];
        const toProcess = candidates.filter(c => !processedUrls.has(normalizeUrl(c.url))).slice(0, Math.max(0, MIN_PER_CATEGORY - count + 2));

        for (const item of toProcess) {
            try {
                const completion = await getOpenAIClient().chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: `Si profesionálny redaktor AI & Tech portálu. Priraď tému do PRESNE JEDNEJ kategórie.
Kategória MUSÍ byť presne jedna z: ${ALLOWED_CATEGORIES.join(" | ")}.
Vráť EXAKTNE JSON: {"title": "Slovenský titulok", "summary": "Slovenské zhrnutie...", "category": "jedna z uvedených kategórií"}`
                        },
                        { role: "user", content: `Pôvodný titulok: ${item.title}\nUkážka: ${item.contentSnippet.substring(0, 500)}\nOdporúčaná kategória: ${item.groupHint}` }
                    ],
                    response_format: { type: "json_object" }
                });

                const aiData = JSON.parse(completion.choices[0].message.content || "{}");
                const aiCategory = (aiData.category || "").trim();
                const lowerAssigned = aiCategory.toLowerCase();
                const matchedCat = ALLOWED_CATEGORIES.find(c =>
                    c.toLowerCase() === lowerAssigned || lowerAssigned.includes(c.toLowerCase()) || c.toLowerCase().includes(lowerAssigned)
                );

                const assignedCategory = matchedCat || "AI";
                processedUrls.add(normalizeUrl(item.url));
                suggestionsWithAI.push({
                    url: item.url,
                    title: aiData.title || item.title,
                    source: item.source,
                    summary: aiData.summary || "Zaujímavá AI téma na spracovanie.",
                    category: assignedCategory,
                    status: 'pending'
                });
                if (suggestionsWithAI.filter(s => s.category === cat).length >= MIN_PER_CATEGORY) break;
            } catch (e) {
                console.error("AI discovery top-up error:", item.title, e);
            }
        }
    }

    return suggestionsWithAI;
}
