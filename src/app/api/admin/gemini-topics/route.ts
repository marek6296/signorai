import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase";
import { CATEGORY_MAP } from "@/lib/data";
import { getRawRssArticles } from "@/lib/discovery-logic";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_CATEGORIES = Object.values(CATEGORY_MAP);
const ADMIN_SECRET = process.env.ADMIN_SECRET || "make-com-webhook-secret";

async function executeGeminiDiscovery(categories: string[], query: string, secret: string | null, count: number = 8, useRss: boolean = false) {
    if (secret !== ADMIN_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        console.error(">>> [Gemini Topics] GEMINI_API_KEY nie je nastavený!");
        return NextResponse.json({
            error: "GEMINI_API_KEY nie je nakonfigurovaný v .env.local.",
            message: "Skús namiesto toho 'Hľadať cez RSS' (OpenAI variant) alebo pridaj kľúč do .env.local.",
            code: "MISSING_API_KEY"
        }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const targetCategories = categories.length > 0
        ? categories.filter((c: string) => ALLOWED_CATEGORIES.includes(c))
        : ALLOWED_CATEGORIES;

    let rssContext = "";
    if (useRss) {
        console.log(">>> [Gemini Topics] Using RSS Sources...");
        const rawRss = await getRawRssArticles(3, targetCategories);
        if (rawRss.length > 0) {
            const rssList = rawRss.slice(0, 60).map(i => `- Titulok: ${i.title}\n  Zdroj: ${i.source}\n  Obsah: ${i.contentSnippet.substring(0, 150)}\n  URL: ${i.url}\n  Kategória: ${i.groupHint}`).join("\n\n");
            rssContext = `TU SÚ NAJNOVŠIE ČLÁNKY Z NAŠICH RSS ZDROJOV:\n${rssList}\n\n`;
        } else {
            console.log(">>> [Gemini Topics] No RSS articles found, falling back to Google Search.");
            useRss = false; // Fallback ak nenašlo nič
        }
    }

    // Deduplicate: fetch already published articles + all suggestions (any status)
    const [{ data: existingArticles }, { data: existingSuggestions }] = await Promise.all([
        supabase.from('articles').select('title').order('created_at', { ascending: false }).limit(60),
        supabase.from('suggested_news').select('title').order('created_at', { ascending: false }).limit(40)
    ]);
    const usedTitles = [
        ...(existingArticles || []).map((a: { title: string }) => a.title),
        ...(existingSuggestions || []).map((s: { title: string }) => s.title)
    ].filter(Boolean);
    const dedupeBlock = usedTitles.length > 0
        ? `\nTIETO TÉMY UŽ MÁME — NAVRHNI VÝHRADNE ODLIŠNÉ TÉMY (žiadne podobné ani variácie):\n${usedTitles.map(t => `- ${t}`).join('\n')}\n`
        : "";

    const today = new Date().toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
    const customQueryPart = query ? `\nPrioritu daj témam súvisiacim s: "${query}".\n` : "";

    const categoryDescriptions: Record<string, string> = {
        "AI": "umelá inteligencia, nové AI modely (GPT, Claude, Gemini, Grok, Llama), AI výskum, AI agenti, multimodálne modely, AI bezpečnosť",
        "Tech": "technológie, spotrebná elektronika, smartfóny, softvér, startupy, Apple, Google, Microsoft, Meta",
        "Návody & Tipy": "návody ako používať AI nástroje, ChatGPT tipy, Midjourney, Copilot tutoriály, produktivita s AI"
    };

    const catDescList = targetCategories
        .map(c => `- ${c}: ${categoryDescriptions[c] || c}`)
        .join("\n");

    const prompt = `Dnes je ${today}. Si expert na technologické správy.${customQueryPart}
${useRss ? rssContext : ""}${dedupeBlock}
Tvojou úlohou je vybrať presne ${count} najnovších, najtrendovejších a najzaujímavejších správ striktne LEN pre tieto kategórie:
${catDescList}

POŽIADAVKY:
${useRss ? "- TÉMY MUSÍŠ VYBRAŤ EXKLUZÍVNE IBA Z POSKYTNUTÉHO ZOZNAMU RSS ČLÁNKOV VYŠŠIE!" : "- Pomocou Google Search nájdi najaktuálnejšie správy."}
- Správy musia byť zo dneška alebo včera (maximálne 48 hodín staré)
- Uprednostni správy s vysokým dopadom a viralitou
- Každá téma musí byť unikátna a zaujímavá pre slovenských čitateľov
- Nájdené témy MUSIA patriť LEN do vyššie spomenutých povolených kategórií! Z iných oblastí správy vôbec nehľadaj a nevracaj.
- NIKDY nepridaj tému, ktorá je rovnaká alebo veľmi podobná ako niektorá z už spracovaných tém uvedených vyššie.

Pre každú vybranú správu vráť JSON objekt s poliami:
- "title": Slovenský titulok (preloží z angličtiny, max 80 znakov)
- "summary": Slovenské zhrnutie v 2-3 vetách, výstižné a informatívne
- "category": PRESNE jedna z: ${targetCategories.join(" | ")} (musí stopercentne sedieť na túto kategóriu)
- "url": Priamy odkaz na originálny článok
- "source": Názov portálu (napr. "TechCrunch", "The Verge", "Wired")

Odpoveď vráť AKO ČISTÉ JSON POLE - bez markdown, bez \`\`\` blokov, iba [{"title":...}, ...].`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ],
            config: {
                ...(useRss ? {} : { tools: [{ googleSearch: {} }] })
            }
        });

        const text = response.text || "";
        console.log(">>> [Gemini Topics] Raw response length:", text.length);

        // Parse JSON from response - try multiple strategies
        let topics: Array<Record<string, string>> = [];

        // Strategy 1: Direct JSON array match
        const jsonArrayMatch = text.match(/\[[\s\S]*\]/);
        if (jsonArrayMatch) {
            try {
                topics = JSON.parse(jsonArrayMatch[0]);
            } catch (e) {
                console.error("Strategy 1 failed:", e);
            }
        }

        // Strategy 2: Find JSON-like objects and reconstruct
        if (topics.length === 0) {
            try {
                const cleanText = text
                    .replace(/```json/gi, '')
                    .replace(/```/g, '')
                    .trim();
                const fallbackMatch = cleanText.match(/\[[\s\S]*\]/);
                if (fallbackMatch) {
                    topics = JSON.parse(fallbackMatch[0]);
                }
            } catch (e) {
                console.error("Strategy 2 failed:", e);
            }
        }

        if (topics.length === 0) {
            console.error(">>> [Gemini Topics] Could not parse response:", text.substring(0, 500));
            return NextResponse.json({
                error: "Gemini nevrátil platný JSON. Skús znovu.",
                detail: text.substring(0, 300)
            }, { status: 500 });
        }

        // Validate and clean topics
        const cleaned = topics
            .filter(t => t.title && t.summary)
            .map(t => {
                const assignedCategory = ALLOWED_CATEGORIES.find(c =>
                    c.toLowerCase() === (t.category || "").toLowerCase() ||
                    (t.category || "").toLowerCase().includes(c.toLowerCase())
                ) || "AI";

                return {
                    url: t.url && t.url.startsWith("http")
                        ? t.url
                        : `https://www.google.com/search?q=${encodeURIComponent(t.title)}`,
                    title: t.title,
                    source: t.source || "Gemini Live Search",
                    summary: t.summary,
                    category: assignedCategory,
                    status: 'pending'
                };
            });

        if (cleaned.length === 0) {
            return NextResponse.json({ message: "Gemini nenašiel žiadne témy.", count: 0 }, { status: 404 });
        }

        console.log(`>>> [Gemini Topics] Saving ${cleaned.length} topics to DB...`);

        const { error: insertError } = await supabase
            .from('suggested_news')
            .insert(cleaned);

        if (insertError && !insertError.message.includes('unique')) {
            throw insertError;
        }

        return NextResponse.json({
            success: true,
            message: `Gemini našiel ${cleaned.length} nových tém z live Google Search.`,
            items: cleaned,
            suggestions: cleaned,
            count: cleaned.length
        });

    } catch (error: unknown) {
        console.error(">>> [Gemini Topics] ERROR:", error);

        // Check if this is an auth error (leaked key, permission denied, etc.)
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isAuthError = errorMessage.includes("403") ||
                           errorMessage.includes("PERMISSION_DENIED") ||
                           errorMessage.includes("leaked") ||
                           errorMessage.includes("Unauthorized");

        return NextResponse.json({
            error: "Chyba pri hľadaní tém cez Gemini",
            detail: error instanceof Error ? error.message : String(error),
            code: isAuthError ? "AUTH_ERROR" : "API_ERROR",
            message: isAuthError
                ? "Gemini API kľúč je neplatný alebo zablokovaný. Vygeneruj si nový kľúč z Google Cloud Console."
                : "Gemini API chyba. Skús namiesto toho OpenAI + RSS metódu."
        }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { secret, categories = [], query = "", count = 8, useRss = false } = body;
        return executeGeminiDiscovery(categories, query, secret, count, useRss);
    } catch (e: unknown) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const categoriesRaw = url.searchParams.get("categories");
    const query = url.searchParams.get("query") || "";
    const count = parseInt(url.searchParams.get("count") || "8");
    const useRss = url.searchParams.get("useRss") === "true";
    const categories = categoriesRaw ? categoriesRaw.split(",").filter(Boolean) : [];
    return executeGeminiDiscovery(categories, query, secret, count, useRss);
}
