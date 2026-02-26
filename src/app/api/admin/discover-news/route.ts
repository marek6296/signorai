import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const parser = new Parser();

interface DiscoveryItem {
    url: string;
    title: string;
    source: string;
    contentSnippet: string;
    groupHint: string;
}

// Comprehensive feeds organized by internal categories
const FEED_GROUPS: Record<string, { name: string, url: string }[]> = {
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
        { name: "BBC World", url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
        { name: "Reuters World", url: "https://www.reutersagency.com/feed/?best-topics=world-news" },
        { name: "Denník N", url: "https://dennikn.sk/feed/" },
        { name: "Aktuality.sk", url: "https://www.aktuality.sk/rss/" },
        { name: "SME Svet", url: "https://rss.sme.sk/rss/sme-sekcia-svet.xml" },
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

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        const secret = request.nextUrl.searchParams.get("secret");

        // New filters
        const maxDays = parseInt(request.nextUrl.searchParams.get("days") || "3");
        const targetCategories = request.nextUrl.searchParams.get("categories")?.split(",") || [];

        if (secret !== process.env.ADMIN_SECRET && authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
            return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
        }

        const newsByGroup: Record<string, DiscoveryItem[]> = {};
        const now = new Date();
        const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;

        // 1. Fetch articles from grouped RSS feeds
        for (const [groupName, feeds] of Object.entries(FEED_GROUPS)) {
            // Filter by target categories if provided
            if (targetCategories.length > 0 && !targetCategories.includes(groupName)) {
                continue;
            }

            newsByGroup[groupName] = [];

            for (const feed of feeds) {
                try {
                    const response = await fetch(feed.url);
                    const contentType = response.headers.get("content-type") || "";
                    const buffer = await response.arrayBuffer();

                    let charset = "utf-8";
                    if (contentType.toLowerCase().includes("charset=")) {
                        charset = contentType.toLowerCase().split("charset=")[1].split(";")[0].trim();
                    } else if (feed.url.includes("sector.sk") || feed.url.includes("zive.sk")) {
                        charset = "windows-1250";
                    }

                    const decoder = new TextDecoder(charset);
                    const xmlText = decoder.decode(buffer);
                    const feedData = await parser.parseString(xmlText);

                    for (const item of feedData.items.slice(0, 15)) {
                        if (!item.link) continue;

                        // Date Filtering
                        if (item.isoDate || item.pubDate) {
                            const pubDate = new Date(item.isoDate || item.pubDate || "");
                            if (now.getTime() - pubDate.getTime() > maxAgeMs) {
                                continue; // Too old
                            }
                        }

                        const { data: existingArticle } = await supabase
                            .from('articles')
                            .select('id')
                            .eq('source_url', item.link)
                            .maybeSingle();

                        const { data: existingSuggestion } = await supabase
                            .from('suggested_news')
                            .select('id')
                            .eq('url', item.link)
                            .maybeSingle();

                        if (!existingArticle && !existingSuggestion) {
                            newsByGroup[groupName].push({
                                url: item.link,
                                title: item.title || "",
                                source: feed.name,
                                contentSnippet: item.contentSnippet || item.content || "",
                                groupHint: groupName // Pass the group to AI
                            });
                        }
                    }
                } catch (err) {
                    console.error(`Error parsing feed ${feed.name}:`, err);
                }
            }
        }

        // 2. Select a balanced mix (Targeting ~3 per category, max 30 total)
        const finalSelection: DiscoveryItem[] = [];
        for (const [_, items] of Object.entries(newsByGroup)) {
            const shuffled = items.sort(() => Math.random() - 0.5);
            finalSelection.push(...shuffled.slice(0, 4));
        }

        if (finalSelection.length === 0) {
            return NextResponse.json({ message: "Všetky novinky sú už spracované.", count: 0 });
        }

        // 3. Categorize and Summarize with OpenAI
        const suggestionsWithAI = [];
        // Limit to 25 to stay within reasonable time/limits
        const limitedPool = finalSelection.sort(() => Math.random() - 0.5).slice(0, 25);

        for (const item of limitedPool) {
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: `Si profesionálny slovenský redaktor portálu POSTOVINKY. Tvojou ÚLOHOU je kompletne poslovenčiť zahraničný článok.
    1. TITULOK: Musíš preložiť pôvodný anglický titulok do údernej, slovenskej verzie. Nikdy nenechávaj titulok v angličtine!
    2. ZHRNUTIE: Zhrň obsah do jednej krátkej, elegantnej vety v slovenčine. 
    3. KATEGÓRIA: Priraď mu jednu kategóriu (Umelá Inteligencia, Tech, Biznis, Krypto, Svet & Politika, Veda, Gaming, Návody & Tipy).
    
    DÔLEŽITÉ: Ak v pôvodnom texte uvidíš pokazené znaky, oprav ich. Všetky výstupné polia MUSIA byť v slovenčine.
    Vráť EXAKTNE JSON: {"title": "Slovenský titulok", "summary": "Slovenské zhrnutie...", "category": "..."}`
                        },
                        { role: "user", content: `Pôvodný titulok: ${item.title}\nUkážka: ${item.contentSnippet.substring(0, 500)}\nOdporúčaná kategória: ${item.groupHint}` }
                    ],
                    response_format: { type: "json_object" }
                });

                const aiData = JSON.parse(completion.choices[0].message.content || "{}");

                // Double check if AI provided values, otherwise fallback more safely
                const translatedTitle = aiData.title && aiData.title.length > 5 ? aiData.title : item.title;

                suggestionsWithAI.push({
                    url: item.url,
                    title: translatedTitle,
                    source: item.source,
                    summary: aiData.summary || "Nová téma na spracovanie v slovenčine.",
                    category: aiData.category || item.groupHint || "Tech",
                    status: 'pending'
                });
            } catch (e) {
                console.error("AI processing error for item:", item.title, e);
            }
        }

        if (suggestionsWithAI.length === 0) {
            return NextResponse.json({ message: "Nepodarilo sa spracovať žiadne návrhy.", count: 0 });
        }

        // 4. Batch insert into database
        const { error: insertError } = await supabase
            .from('suggested_news')
            .insert(suggestionsWithAI);

        if (insertError && !insertError.message.includes('unique')) {
            throw insertError;
        }

        return NextResponse.json({
            success: true,
            message: `Úspešne som našiel ${suggestionsWithAI.length} rôznorodých návrhov naprieč kategóriami.`,
            suggestions: suggestionsWithAI
        });

    } catch (error: unknown) {
        console.error("News discovery error detail:", error);
        return NextResponse.json({
            message: "Chyba pri objavovaní správ.",
            detail: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
