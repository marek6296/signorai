import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase";
import { CATEGORY_MAP } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_CATEGORIES = Object.values(CATEGORY_MAP);
const ADMIN_SECRET = process.env.ADMIN_SECRET || "make-com-webhook-secret";

async function executeGeminiDiscovery(categories: string[], query: string, secret: string | null) {
    if (secret !== ADMIN_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        console.error(">>> [Gemini Topics] GEMINI_API_KEY nie je nastavený!");
        return NextResponse.json({
            error: "GEMINI_API_KEY nie je nakonfigurovaný na serveri.",
            message: "Skús namiesto toho 'Hľadať cez RSS' (OpenAI variant).",
            code: "MISSING_API_KEY"
        }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const targetCategories = categories.length > 0
        ? categories.filter((c: string) => ALLOWED_CATEGORIES.includes(c))
        : ALLOWED_CATEGORIES;

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

    const prompt = `Dnes je ${today}. Si expert na AI a technologické správy.${customQueryPart}
Pomocou Google Search nájdi 8-12 najnovších, najtrendovejších a najzaujímavejších správ z oblasti:
${catDescList}

POŽIADAVKY:
- Správy musia byť zo dneška alebo včera (maximálne 48 hodín staré)
- Uprednostni správy s vysokým dopadom a viralitou
- Každá téma musí byť unikátna a zaujímavá pre slovenských čitateľov

Pre každú nájdenú správu vráť JSON objekt s poliami:
- "title": Slovenský titulok (preloži z angličtiny, max 80 znakov)
- "summary": Slovenské zhrnutie v 2-3 vetách, výstižné a informatívne
- "category": PRESNE jedna z: ${ALLOWED_CATEGORIES.join(" | ")}
- "url": Priamy odkaz na originálny článok
- "source": Názov portálu (napr. "TechCrunch", "The Verge", "Wired")

Odpoveď vráť AKO ČISTÉ JSON POLE - bez markdown, bez \`\`\` blokov, iba [{"title":...}, ...].`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
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
        const { secret, categories = [], query = "" } = body;
        return executeGeminiDiscovery(categories, query, secret);
    } catch (e: unknown) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const categoriesRaw = url.searchParams.get("categories");
    const query = url.searchParams.get("query") || "";
    const categories = categoriesRaw ? categoriesRaw.split(",").filter(Boolean) : [];
    return executeGeminiDiscovery(categories, query, secret);
}
