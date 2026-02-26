import Parser from "rss-parser";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { CATEGORY_MAP } from "@/lib/data";

/** Iba tieto kategórie berieme – témy mimo tohto zoznamu sa vôbec nesprácavajú. */
const ALLOWED_CATEGORIES = Object.values(CATEGORY_MAP);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
    "Novinky SK/CZ": [
        { name: "SME Domov", url: "https://rss.sme.sk/rss/sme-sekcia-slovensko.xml" },
        { name: "Aktuality Domov", url: "https://www.aktuality.sk/rss/?category=domace" },
        { name: "Denno N Domov", url: "https://dennikn.sk/sekcia/slovensko/feed/" },
        { name: "HNonline", url: "https://hnonline.sk/rss/slovensko" },
        { name: "iDNES.cz Domácí", url: "https://servis.idnes.cz/rss.aspx?c=zpravodaj" },
        { name: "Novinky.cz", url: "https://www.novinky.cz/rss" }
    ],
    "Umelá Inteligencia": [
        { name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml" },
        { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
        { name: "Wired AI", url: "https://www.wired.com/feed/category/ai/latest/rss" },
        { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/" },
        { name: "AI News", url: "https://www.artificialintelligence-news.com/feed/" },
        { name: "MIT Tech Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/" },
        { name: "Futurism AI", url: "https://futurism.com/feed" }
    ],
    "Tech": [
        { name: "Engadget", url: "https://www.engadget.com/rss.xml" },
        { name: "Ars Technica", url: "https://feeds.feedburner.com/arstechnica/index" },
        { name: "Zive.sk", url: "https://zive.aktuality.sk/rss/" },
        { name: "Zive.cz", url: "https://www.zive.cz/rss/sc-47/" },
        { name: "The Next Web", url: "https://thenextweb.com/feed" },
        { name: "Mashable", url: "https://mashable.com/feeds/rss/all" },
        { name: "Gizmodo", url: "https://gizmodo.com/rss" }
    ],
    "Biznis": [
        { name: "CNBC Business", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069" },
        { name: "Reuters Biz", url: "https://www.reutersagency.com/feed/?best-topics=business" },
        { name: "CzechCrunch", url: "https://cc.cz/feed/" },
        { name: "Forbes Business", url: "https://www.forbes.com/business/feed/" },
        { name: "SME Ekonomika", url: "https://rss.sme.sk/rss/sme-sekcia-ekonomika.xml" },
        { name: "Business Insider", url: "http://feeds.feedburner.com/businessinsider" }
    ],
    "Krypto": [
        { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
        { name: "CoinTelegraph", url: "https://cointelegraph.com/rss" },
        { name: "Decrypt", url: "https://decrypt.co/feed" },
        { name: "CryptoSlate", url: "https://cryptoslate.com/feed/" }
    ],
    "Svet": [
        { name: "The Guardian World", url: "https://www.theguardian.com/world/rss" },
        { name: "BBC News World", url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
        { name: "Reuters World", url: "https://www.reutersagency.com/feed/?best-topics=world-news" },
        { name: "The NY Times World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
        { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" }
    ],
    "Politika": [
        { name: "Denno N Politika", url: "https://dennikn.sk/sekcia/politika/feed/" },
        { name: "Aktuality Politika", url: "https://www.aktuality.sk/rss/?category=politika" }
    ],
    "Gaming": [
        { name: "IGN", url: "https://feeds.feedburner.com/ign/all" },
        { name: "Sector.sk", url: "https://www.sector.sk/rss/" },
        { name: "Games.cz", url: "https://games.tiscali.cz/rss" },
        { name: "Kotaku", url: "https://kotaku.com/rss" },
        { name: "Eurogamer", url: "https://www.eurogamer.net/feed/news" },
        { name: "PC Gamer", url: "https://www.pcgamer.com/rss/" },
        { name: "Polygon", url: "https://www.polygon.com/rss/index.xml" }
    ],
    "Veda": [
        { name: "Phys.org", url: "https://phys.org/rss-feed/" },
        { name: "SciTechDaily", url: "https://scitechdaily.com/feed/" },
        { name: "Nature News", url: "https://www.nature.com/nature.rss" },
        { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/all.xml" },
        { name: "New Scientist", url: "https://www.newscientist.com/feed/home/" }
    ],
    "Návody & Tipy": [
        { name: "How-To Geek", url: "https://www.howtogeek.com/feed/" },
        { name: "MakeUseOf", url: "https://www.makeuseof.com/feed/" },
        { name: "Lifehacker", url: "https://lifehacker.com/rss" }
    ]
};

export const normalizeUrl = (u: string) => u.split('?')[0].toLowerCase().trim().replace(/\/$/, "");

export async function discoverNewNews(maxDays: number, targetCategories: string[] = []) {
    const newsByGroup: Record<string, DiscoveryItem[]> = {};
    const now = new Date();
    const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;

    // Pre-fetch all known URLs to avoid thousands of DB queries
    const { data: seenArticles } = await supabase.from('articles').select('source_url');
    const { data: seenSuggestions } = await supabase.from('suggested_news').select('url');

    const seenUrls = new Set([
        ...(seenArticles?.map(a => normalizeUrl(a.source_url || "")) || []),
        ...(seenSuggestions?.map(s => normalizeUrl(s.url || "")) || [])
    ]);

    // 1. Fetch articles len zo skupín, ktoré sú v našich kategóriách (iné vôbec neberieme)
    const categoriesToFetch = targetCategories.length > 0
        ? targetCategories.filter(c => ALLOWED_CATEGORIES.includes(c))
        : [...ALLOWED_CATEGORIES];

    for (const [groupName, feeds] of Object.entries(FEED_GROUPS)) {
        if (!ALLOWED_CATEGORIES.includes(groupName)) continue; // skupina nie je naša kategória – preskočiť
        if (targetCategories.length > 0 && !targetCategories.includes(groupName)) continue;

        newsByGroup[groupName] = [];

        for (const feed of feeds) {
            try {
                const response = await fetch(feed.url);
                const buffer = await response.arrayBuffer();
                const contentType = response.headers.get("content-type") || "";

                let charset = "utf-8";
                if (contentType.toLowerCase().includes("charset=")) {
                    charset = contentType.toLowerCase().split("charset=")[1].split(";")[0].trim();
                } else if (feed.url.includes("sector.sk") || feed.url.includes("zive.sk")) {
                    charset = "windows-1250";
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

                    // Date Filtering
                    if (now.getTime() - pubDateObj.getTime() > maxAgeMs) continue;

                    newsByGroup[groupName].push({
                        url: item.link,
                        title: item.title || "",
                        source: feed.name,
                        contentSnippet: item.contentSnippet || item.content || "",
                        groupHint: groupName,
                        publishedAt: pubDateStr
                    });

                    // Add to current session to avoid duplicates from other feeds in same run
                    seenUrls.add(normalized);
                }
            } catch (err) {
                console.error(`Error parsing feed ${feed.name}:`, err);
            }
        }
    }

    // 2. Initial Selection & URL Accessibility Check
    const candidatesByGroup: Record<string, DiscoveryItem[]> = {};
    for (const [groupName, items] of Object.entries(newsByGroup)) {
        if (items.length === 0) continue;
        // Sort by date DESC (newest first)
        const sorted = items.sort((a, b) => {
            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return dateB - dateA;
        });
        candidatesByGroup[groupName] = sorted.slice(0, 15); // get many candidates to verify accessibility
    }

    const checkUrlAccessible = async (url: string): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            // Fetch to ensure we don't hit a 403 / 401 / 404 / paywall
            const res = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Range": "bytes=0-2048" // Download just a tiny chunk of HTML to verify response code
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

    // 2b. Alespoň 3 dostupné linky na kategóriu (na základe toho potom spracujeme min. 3 návrhy na kategóriu)
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

    // 3. AI – do poolu dáme aspoň 3 položky z každej kategórie, aby sme mohli vrátiť min. 3 návrhy na kategóriu
    const pool: DiscoveryItem[] = [];
    const groupNames = Object.keys(accessibleByGroup);
    const wantPerCategory = Math.max(MIN_PER_CATEGORY, Math.min(8, Math.floor(100 / groupNames.length)));

    for (const groupName of groupNames) {
        const items = accessibleByGroup[groupName].slice(0, wantPerCategory);
        pool.push(...items);
    }
    // Zoradiť podľa dátumu (najnovšie prvé), zachovať rozumný počet
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
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `Si profesionálny slovenský redaktor portálu POSTOVINKY. Tvojou ÚLOHOU je pripraviť tému na spracovanie.
                        
KATEGORIZÁCIA (Buď veľmi prísny a presný!):
- Novinky SK/CZ: Akýkoľvek článok týkajúci sa Slovenska alebo Česka (domáce správy, SK/CZ politici, udalosti v regiónoch, lokálne firmy). TOTO MÁ ABSOLÚTNU PRIORITU.
- Gaming: Všetko o videohrách, konzolách a hernom hardvéri.
- Umelá Inteligencia: LEN články o VÝVOJI AI (nové modely, výskum, AI čipy). Ak je AI len malou súčasťou iného produktu, daj Tech.
- Krypto: Bitcoin, blockchain, regulácie kryptomien.
- Tech: Spotrebná elektronika, softvér, internetové služby a gadgety.
- Biznis: Akcie, ekonomika, fúzie firiem, startupy.
- Politika: Vládne témy, voľby, medzinárodná diplomacia a štátne záležitosti (mimo SR/ČR).
- Svet: Zaujímavosti zo sveta, prírodné udalosti a témy bez politickému charakteru.
- Veda: Vesmír, medicína a akademický výskum.
- Návody & Tipy: "Ako urobiť...", tutoriály.

Kategória MUSÍ byť presne jedna z: ${ALLOWED_CATEGORIES.join(" | ")}. Ak téma do žiadnej z nich nespadá, nevkladaj ju.
Vráť EXAKTNE JSON: {"title": "Slovenský titulok", "summary": "Slovenské zhrnutie...", "category": "jedna z uvedených kategórií"}`
                    },
                    { role: "user", content: `Pôvodný titulok: ${item.title}\nUkážka: ${item.contentSnippet.substring(0, 500)}\nOdporúčaná kategória podľa zdroja: ${item.groupHint}` }
                ],
                response_format: { type: "json_object" }
            });

            const aiData = JSON.parse(completion.choices[0].message.content || "{}");

            // Iba naše kategórie – ak AI priradí niečo mimo zoznamu, položku vôbec neberieme
            let assignedCategory = (aiData.category || item.groupHint || "").trim();
            const lowerAssigned = assignedCategory.toLowerCase();
            const matchedCat = ALLOWED_CATEGORIES.find(c =>
                c.toLowerCase() === lowerAssigned || lowerAssigned.includes(c.toLowerCase()) || c.toLowerCase().includes(lowerAssigned)
            );

            if (!matchedCat) continue; // nespadá do žiadnej našej kategórie – vôbec nenavrhujeme

            assignedCategory = matchedCat;
            processedUrls.add(normalizeUrl(item.url));

            suggestionsWithAI.push({
                url: item.url,
                title: aiData.title || item.title,
                source: item.source,
                summary: aiData.summary || "Zaujímavá téma na spracovanie.",
                category: assignedCategory,
                status: 'pending'
            });
        } catch (e) {
            console.error("AI discovery error:", item.title, e);
        }
    }

    // 4. Doplnenie: v každej kategórii chceme aspoň 3 návrhy; ak je menej, skúsime spracovať ďalšie kandidáty z danej skupiny
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
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: `Si profesionálny slovenský redaktor portálu POSTOVINKY. Priraď tému do PRESNE JEDNEJ kategórie.
Kategória MUSÍ byť presne jedna z: ${ALLOWED_CATEGORIES.join(" | ")}. Ak téma do žiadnej z nich nespadá, nevkladaj ju.
Vráť EXAKTNE JSON: {"title": "Slovenský titulok", "summary": "Slovenské zhrnutie...", "category": "jedna z uvedených kategórií"}`
                        },
                        { role: "user", content: `Pôvodný titulok: ${item.title}\nUkážka: ${item.contentSnippet.substring(0, 500)}\nOdporúčaná kategória: ${item.groupHint}` }
                    ],
                    response_format: { type: "json_object" }
                });

                const aiData = JSON.parse(completion.choices[0].message.content || "{}");
                let assignedCategory = (aiData.category || "").trim();
                const lowerAssigned = assignedCategory.toLowerCase();
                const matchedCat = ALLOWED_CATEGORIES.find(c =>
                    c.toLowerCase() === lowerAssigned || lowerAssigned.includes(c.toLowerCase()) || c.toLowerCase().includes(lowerAssigned)
                );
                if (!matchedCat) continue;

                assignedCategory = matchedCat;
                processedUrls.add(normalizeUrl(item.url));
                suggestionsWithAI.push({
                    url: item.url,
                    title: aiData.title || item.title,
                    source: item.source,
                    summary: aiData.summary || "Zaujímavá téma na spracovanie.",
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
