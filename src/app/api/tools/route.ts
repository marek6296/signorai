import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey: key });
}

function buildPrompt(tool: string, input: string, options: Record<string, string>): string {
  switch (tool) {
    case "sumarizator": {
      const counts: Record<string, string> = { short: "3", medium: "5", long: "8" };
      const n = counts[options.length] ?? "5";
      return `Zhrni nasledujúci text do ${n} kľúčových bodov v slovenčine. Každý bod začni pomlčkou (–). Na konci pridaj 1-2 vetové zhrnutie celého textu pod nadpisom "Zhrnutie:". Buď vecný a stručný.

TEXT:
${input}`;
    }

    case "titulky": {
      return `Vygeneruj presne 5 rôznych titulkov v slovenčine pre tému: "${input}".

Každý titulok musí byť iného typu:
1. Číslo/zoznam (napr. "5 dôvodov prečo...")
2. Otázka (napr. "Prečo je...?")
3. Clickbait/dramatický
4. Odborný/faktický
5. Príbeh/ľudský uhol

Formát: každý titulok na novom riadku, s číslom a bodkou. Bez ďalšieho vysvetlovania.`;
    }

    case "prekladac": {
      const langs: Record<string, string> = {
        sk: "slovenčinu",
        cs: "češtinu",
        en: "angličtinu",
        de: "nemčinu",
        es: "španielčinu",
        fr: "francúzštinu",
      };
      const lang = langs[options.targetLang] ?? "slovenčinu";
      return `Preloži nasledujúci text do ${lang}. Zachovaj prirodzený tón, štýl a formátovanie originálu. Vráť iba preložený text bez komentárov.

TEXT:
${input}`;
    }

    case "prompt-vylepšovač":
    case "prompt-vylepsovac": {
      const styleMap: Record<string, string> = {
        detailed: "Vytvor podrobný prompt s kontextom, rolou AI, konkrétnou úlohou a požadovaným formátom výstupu.",
        structured: "Použi štruktúru: ROLA: [kto je AI], ÚLOHA: [čo má urobiť], KONTEXT: [dôležité info], FORMÁT: [ako má vyzerať výstup].",
        concise: "Vytvor stručný, presný prompt bez zbytočností – maximum 3 vety.",
      };
      const style = styleMap[options.style] ?? styleMap.detailed;
      return `Si expert na AI promptovanie. Použi nasledujúci jednoduchý prompt od používateľa a prepíš ho na profesionálny, efektívny prompt. ${style}

Vráť iba vylepšený prompt, bez vysvetlenia alebo komentárov.

PÔVODNÝ PROMPT:
${input}`;
    }

    case "social-posty": {
      const platformMap: Record<string, string> = {
        linkedin: "LinkedIn (profesionálny tón, 150-300 slov, pridaj 3-5 hashtagov)",
        twitter: "X/Twitter (max 280 znakov, stručné, pridaj 2-3 hashtagy)",
        facebook: "Facebook (neformálny tón, 80-150 slov, konverzačný štýl)",
        all: "LinkedIn (profesionálny, 150-300 slov), X/Twitter (max 280 znakov) a Facebook (neformálny, 80-150 slov)",
      };
      const platform = platformMap[options.platform] ?? platformMap.all;
      const prefix = options.platform === "all" ? "Vygeneruj 3 príspevky – pre " : "Vygeneruj príspevok pre ";
      return `${prefix}${platform}.

Téma: ${input}

Každý príspevok opatri názvom platformy ako nadpisom (napr. **LinkedIn:**). Použij slovenčinu. Každý príspevok musí byť ready-to-post.`;
    }

    case "seo-popis": {
      return `Vygeneruj 3 varianty SEO meta popisu v slovenčine pre nasledujúcu stránku/článok. Každý popis musí mať maximálne 160 znakov, obsahovať kľúčové slovo a motivovať k prekliku.

Formát: každý popis na novom riadku s číslom a počtom znakov v zátvorkách napr. "1. Text popisu... (142 znakov)"

OBSAH:
${input}`;
    }

    default:
      throw new Error(`Neznámy nástroj: ${tool}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tool, input, options = {} } = await req.json();

    if (!tool || !input?.trim()) {
      return NextResponse.json({ error: "Chýba nástroj alebo vstupný text." }, { status: 400 });
    }

    if (input.length > 10000) {
      return NextResponse.json({ error: "Vstupný text je príliš dlhý." }, { status: 400 });
    }

    const ai = getGemini();
    const prompt = buildPrompt(tool, input.trim(), options);

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) throw new Error("Prázdna odpoveď od AI");

    return NextResponse.json({ result: text });
  } catch (err) {
    console.error("AI Tools error:", err);
    return NextResponse.json({ error: "Nastala chyba pri generovaní. Skúste znova." }, { status: 500 });
  }
}
