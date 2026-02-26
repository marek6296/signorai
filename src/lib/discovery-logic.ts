import Parser from "rss-parser";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

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
    "Svet & Politika": [
        { name: "The Guardian World", url: "https://www.theguardian.com/world/rss" },
        { name: "BBC News World", url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
        { name: "Reuters World", url: "https://www.reutersagency.com/feed/?best-topics=world-news" },
        { name: "The NY Times World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
        { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" }
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

    // 1. Fetch articles from grouped RSS feeds
    for (const [groupName, feeds] of Object.entries(FEED_GROUPS)) {
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

                    // Date Filtering
                    if (item.isoDate || item.pubDate) {
                        const pubDate = new Date(item.isoDate || item.pubDate || "");
                        if (now.getTime() - pubDate.getTime() > maxAgeMs) continue;
                    }

                    newsByGroup[groupName].push({
                        url: item.link,
                        title: item.title || "",
                        source: feed.name,
                        contentSnippet: item.contentSnippet || item.content || "",
                        groupHint: groupName
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
        const shuffled = items.sort(() => Math.random() - 0.5);
        candidatesByGroup[groupName] = shuffled.slice(0, 10); // get more candidates to allow for filtered ones
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
        } catch (e) {
            console.warn(`[Discovery] URL unreachable (network error): ${url}`);
            return false;
        }
    };

    const finalSelection: DiscoveryItem[] = [];
    for (const [groupName, candidates] of Object.entries(candidatesByGroup)) {
        const accessible: DiscoveryItem[] = [];
        for (const item of candidates) {
            if (accessible.length >= 5) break; // keep up to 5 verified per category

            const isOk = await checkUrlAccessible(item.url);
            if (isOk) {
                accessible.push(item);
            }
        }
        if (accessible.length > 0) {
            finalSelection.push(...accessible);
        }
    }

    if (finalSelection.length === 0) return [];

    // 3. AI Categorization & Polishing
    const suggestionsWithAI = [];
    const pool = finalSelection.sort(() => Math.random() - 0.5).slice(0, 40);

    for (const item of pool) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `Si profesionálny slovenský redaktor portálu POSTOVINKY. Tvojou ÚLOHOU je pripraviť tému na spracovanie.
                        
KATEGORIZÁCIA (Urči podľa hlavnej témy článku):
- Novinky SK/CZ: Akýkoľvek článok týkajúci sa Slovenska alebo Česka (domáce správy, SK/CZ politici, udalosti v regiónoch, lokálne firmy). TOTO MÁ PRIORITU.
- Gaming: Všetko o videohrách, konzolách (PlayStation, Xbox, Nintendo), herných službách (PS Plus, Game Pass), e-športe a hernom hardvéri.
- Umelá Inteligencia: Novinky o LLM (ChatGPT, Claude, Gemini), AI čipoch, AI nástrojoch, automatizácii a etike AI.
- Krypto: Bitcoin, Ethereum, blockchain technológie, burzy, NFT a regulácie digitálnych aktív.
- Tech: Spotrebná elektronika (mobily, PC), softvér, internetové služby, sociálne siete a gadgety.
- Biznis: Akcie, fúzie firiem, ekonomické analýzy, startupy a správy z trhu (ak to nie je primárne o Tech/AI).
- Svet & Politika: Globálne udalosti, vojnové konflikty, zahraničná politika a svetoví lídri (mimo SR/ČR).
- Veda: Vesmír, astronómia, medicínske objavy, biológia, fyzika a nové technológie vo výskume.
- Návody & Tipy: Praktické príručky, ako niečo nastaviť, tutoriály k softvéru alebo tipy na zvýšenie produktivity.
- Newsletter: Len ak ide o zhrnutie viacerých správ alebo pravidelný týždenný prehľad.

DÔLEŽITÉ: Kategóriu vyberaj podľa obsahu, nie podľa zdroja. Napríklad článok o "PS Plus" musí ísť do Gaming, aj keď ho publikoval Tech server.

ZADANIE:
1. TITULOK: Prelož do údernej slovenčiny.
2. ZHRNUTIE: Jedna pútavá veta v slovenčine.

Vráť EXAKTNE JSON: {"title": "Slovenský titulok", "summary": "Slovenské zhrnutie...", "category": "Novinky SK/CZ | Umelá Inteligencia | Tech | Biznis | Krypto | Svet & Politika | Veda | Gaming | Návody & Tipy | Newsletter"}`
                    },
                    { role: "user", content: `Pôvodný titulok: ${item.title}\nUkážka: ${item.contentSnippet.substring(0, 500)}\nOdporúčaná kategória podľa zdroja: ${item.groupHint}` }
                ],
                response_format: { type: "json_object" }
            });

            const aiData = JSON.parse(completion.choices[0].message.content || "{}");

            // Final Category Match Validation
            const validCategories = ["Novinky SK/CZ", "Umelá Inteligencia", "Tech", "Biznis", "Krypto", "Svet & Politika", "Veda", "Gaming", "Návody & Tipy", "Newsletter"];
            let assignedCategory = aiData.category || item.groupHint || "Tech";

            const lowerAssigned = assignedCategory.toLowerCase();
            const matchedCat = validCategories.find(c => {
                const lowC = c.toLowerCase();
                return lowerAssigned.includes(lowC) || lowC.includes(lowerAssigned) ||
                    (lowerAssigned.includes('svet') && lowC.includes('svet')) ||
                    (lowerAssigned.includes('politika') && lowC.includes('politika'));
            });

            assignedCategory = matchedCat || item.groupHint || "Tech";

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

    return suggestionsWithAI;
}
