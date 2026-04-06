import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey: key });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface HistoryItem {
  role: "user" | "bot";
  text: string;
}

interface Article {
  title: string;
  slug: string;
  category: string | null;
  ai_summary: string | null;
  published_at: string;
}

// Strip [ARTICLE:slug:title] and [NAVIGATE:slug] markers from bot messages
// so Gemini doesn't get confused reading its own previous output
function cleanForHistory(text: string): string {
  return text
    .replace(/\[ARTICLE:[^:]+:([^\]]+)\]/g, '"$1"')
    .replace(/\[NAVIGATE:[^\]]+\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Extract meaningful search keywords from the user message
function extractKeywords(msg: string): string[] {
  const stopWords = new Set([
    "som", "sme", "ste", "sú", "si", "je", "byť", "mať", "môcť",
    "ktorý", "ktorá", "ktoré", "ktorí", "tento", "táto", "toto", "tieto",
    "alebo", "pretože", "lebo", "teda", "však", "ale", "ako", "keď",
    "jeho", "jej", "ich", "môj", "tvoj", "naše", "vaše",
    "čo", "kto", "kde", "kedy", "prečo", "aký", "aká",
    "the", "and", "that", "this", "with", "for", "are", "was",
    "niečo", "niekde", "nejak", "nejaký", "veľmi", "ešte", "iba", "len",
    "chcem", "vediet", "viem", "povedz", "aky", "aka", "nove", "novy",
    "nová", "nové", "nový", "máš", "mas", "mam", "máme", "daj", "ukaž",
  ]);
  return msg
    .toLowerCase()
    .replace(/[?!.,;:()\[\]]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [], articleSlug } = (await req.json()) as {
      message: string;
      history: HistoryItem[];
      articleSlug?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Chýba správa." }, { status: 400 });
    }

    const supabase = getSupabase();

    // ── 1. Fetch recent articles ──────────────────────────────────────────────
    const { data: recentArticles } = await supabase
      .from("articles")
      .select("title, slug, category, ai_summary, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(15);

    // ── 2. Keyword search ─────────────────────────────────────────────────────
    const keywords = extractKeywords(message);
    let relevantArticles: Article[] = [];
    if (keywords.length > 0) {
      const orFilter = keywords
        .slice(0, 5)
        .map((k) => `title.ilike.%${k}%,ai_summary.ilike.%${k}%`)
        .join(",");
      const { data } = await supabase
        .from("articles")
        .select("title, slug, category, ai_summary, published_at")
        .eq("status", "published")
        .or(orFilter)
        .order("published_at", { ascending: false })
        .limit(10);
      relevantArticles = data || [];
    }

    // ── 3. Merge & deduplicate (relevant first) ───────────────────────────────
    const seen = new Set<string>();
    const allArticles: Article[] = [];
    for (const a of [...relevantArticles, ...(recentArticles || [])]) {
      if (!seen.has(a.slug)) {
        seen.add(a.slug);
        allArticles.push(a);
      }
    }

    // ── 4. Build article list string ──────────────────────────────────────────
    const articlesContext = allArticles
      .map((a, i) => {
        const date = new Date(a.published_at).toLocaleDateString("sk-SK", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const ai_summary = a.ai_summary ? a.ai_summary.slice(0, 120) : "";
        return `${i + 1}. SLUG="${a.slug}" | KATEGÓRIA=${a.category || "AI"} | DÁTUM=${date}
   TITULOK: ${a.title}
   POPIS: ${ai_summary}`;
      })
      .join("\n\n");

    // ── 5. Current article context (if user reads one) ────────────────────────
    let currentArticleContext = "";
    if (articleSlug) {
      const { data: art } = await supabase
        .from("articles")
        .select("title, slug, content, category, ai_summary")
        .eq("slug", articleSlug)
        .single();
      if (art) {
        currentArticleContext = `

=== ČLÁNOK KTORÝ POUŽÍVATEĽ PRÁVE ČÍTA ===
TITULOK: ${art.title}
SLUG: "${art.slug}"
KATEGÓRIA: ${art.category || "AI"}
OBSAH: ${(art.content || art.ai_summary || "").slice(0, 1000)}`;
      }
    }

    // ── 6. System prompt ──────────────────────────────────────────────────────
    const systemInstruction = `Si asistent portálu AIWai.news – slovenský AI a tech spravodajský portál.

JAZYK: Vždy odpovedaj po SLOVENSKY. Priateľský, stručný tón (2-4 vety + linky na články).

━━━ KRITICKÉ PRAVIDLÁ PRE FORMÁTOVANIE ━━━

PRAVIDLO 1 – VŽDY použi tento formát pre každý článok ktorý spomínaš:
[ARTICLE:slug:Presný titulok článku]

Príklad: [ARTICLE:gpt-5-vydany:GPT-5 bol vydaný – revolúcia v AI]

PRAVIDLO 2 – Slug musí byť PRESNE ten reťazec zo zoznamu (hodnota SLUG="...") a titulok PRESNE ten z poľa TITULOK.
PRAVIDLO 3 – NIKDY neodpovedaj bez odkazu na článok ak existuje relevantný článok v zozname.
PRAVIDLO 5 – Formát musí mať VŽDY dve časti oddelené dvojbodkou: [ARTICLE:slug:Titulok] – NIKDY len [ARTICLE:slug].
PRAVIDLO 4 – Ak si na 90%+ istý že poznáš PRESNÝ článok ktorý hľadá, pridaj NA ÚPLNÝ KONIEC:
[NAVIGATE:slug]

━━━ PRÍKLADY SPRÁVNEJ ODPOVEDE ━━━

Otázka: "Čo je nové ohľadom ChatGPT?"
Odpoveď: "Najnovšie sme písali o aktualizácii ChatGPT – tu sú relevantné články:
[ARTICLE:chatgpt-aktualizacia:ChatGPT dostáva novú aktualizáciu]
[ARTICLE:openai-novinky:OpenAI oznamuje nové funkcie]"

Otázka: "Ukáž mi ten článok o GPT-5"
Odpoveď: "Toto je článok o GPT-5 ktorý hľadáš: [ARTICLE:gpt-5-vydany:GPT-5 vydaný] [NAVIGATE:gpt-5-vydany]"

━━━ DOSTUPNÉ ČLÁNKY NA PORTÁLI ━━━

${articlesContext || "Zatiaľ žiadne publikované články."}
${currentArticleContext}

━━━ KONVERZÁCIA ━━━
- Pamätaj celú históriu rozhovoru, nadväzuj na predchádzajúce správy
- Ak hovorí "ten článok", "to" alebo odkazuje na predchádzajúcu správu – vieš o čom hovorí`;

    const ai = getGemini();

    // ── 7. Build contents with history ────────────────────────────────────────
    const contents = [
      ...history.map((h) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [
          {
            text: h.role === "bot" ? cleanForHistory(h.text) : h.text,
          },
        ],
      })),
      { role: "user", parts: [{ text: message.trim() }] },
    ];

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: 800,
        temperature: 0.5,
      },
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) throw new Error("Prázdna odpoveď od AI");

    return NextResponse.json({ result: text });
  } catch (err) {
    console.error("Chatbot error:", err);
    return NextResponse.json(
      { error: "Nastala chyba pri spracovaní. Skúste znova." },
      { status: 500 }
    );
  }
}
