export interface AiTool {
  slug: string;
  name: string;
  description: string;
  longDesc: string;
  icon: string;
  color: string;
  inputLabel: string;
  inputPlaceholder: string;
  outputLabel: string;
  buttonLabel: string;
  maxInputLength: number;
  options?: { key: string; label: string; values: { value: string; label: string }[] }[];
  comingSoon?: boolean;
}

export const AI_TOOLS: AiTool[] = [
  {
    slug: "sumarizator",
    name: "AI Sumarizátor",
    description: "Skráti dlhý text na kľúčové body a zhrnutie",
    longDesc: "Vlož akýkoľvek dlhý text, článok alebo dokument a AI ho skráti na prehľadné zhrnutie s kľúčovými bodmi.",
    icon: "📝",
    color: "#8b5cf6",
    inputLabel: "Text na zhrnutie",
    inputPlaceholder: "Vlož sem dlhý text, článok alebo dokument...",
    outputLabel: "Zhrnutie",
    buttonLabel: "Zhrni text",
    maxInputLength: 8000,
    options: [
      {
        key: "length",
        label: "Dĺžka zhrnutia",
        values: [
          { value: "short", label: "Krátke (3 body)" },
          { value: "medium", label: "Stredné (5 bodov)" },
          { value: "long", label: "Podrobné (8 bodov)" },
        ],
      },
    ],
  },
  {
    slug: "titulky",
    name: "Generátor Titulkov",
    description: "Vygeneruje 5 pútavých titulkov pre tvoju tému",
    longDesc: "Zadaj tému, kľúčové slovo alebo krátky popis a AI vygeneruje 5 rôznych titulkov – clickbait, odborný, otázka, číslo a storytelling.",
    icon: "📰",
    color: "#3b82f6",
    inputLabel: "Téma alebo popis článku",
    inputPlaceholder: "Napr. Nový AI model od OpenAI prekoná GPT-4 v kódovaní...",
    outputLabel: "Navrhované titulky",
    buttonLabel: "Generovať titulky",
    maxInputLength: 500,
  },
  {
    slug: "prekladac",
    name: "AI Prekladač",
    description: "Preloží text s kontextom a prirodzene",
    longDesc: "Nielen doslovný preklad – AI pochopí kontext a preloží text prirodzene, zachovajúc tón a štýl originálu.",
    icon: "🌍",
    color: "#10b981",
    inputLabel: "Text na preloženie",
    inputPlaceholder: "Vlož text, ktorý chceš preložiť...",
    outputLabel: "Preložený text",
    buttonLabel: "Preložiť",
    maxInputLength: 3000,
    options: [
      {
        key: "targetLang",
        label: "Preložiť do",
        values: [
          { value: "sk", label: "Slovenčina" },
          { value: "cs", label: "Čeština" },
          { value: "en", label: "Angličtina" },
          { value: "de", label: "Nemčina" },
          { value: "es", label: "Španielčina" },
          { value: "fr", label: "Francúzština" },
        ],
      },
    ],
  },
  {
    slug: "prompt-vylepšovač",
    name: "Prompt Vylepšovač",
    description: "Zlepší tvoj prompt pre lepšie AI výsledky",
    longDesc: "Napíš jednoduchý prompt a AI ho preformuluje do profesionálneho, detailného promptu, ktorý dostane z AI oveľa lepšie výsledky.",
    icon: "✨",
    color: "#f59e0b",
    inputLabel: "Tvoj pôvodný prompt",
    inputPlaceholder: "Napr. napíš mi email zákazníkovi o oneskorení...",
    outputLabel: "Vylepšený prompt",
    buttonLabel: "Vylepšiť prompt",
    maxInputLength: 1000,
    options: [
      {
        key: "style",
        label: "Štýl",
        values: [
          { value: "detailed", label: "Podrobný s kontextom" },
          { value: "structured", label: "Štruktúrovaný (role + task + format)" },
          { value: "concise", label: "Stručný a presný" },
        ],
      },
    ],
  },
  {
    slug: "social-posty",
    name: "Generátor Social Postov",
    description: "Vytvorí príspevky pre LinkedIn, Twitter, Facebook",
    longDesc: "Z témy alebo odkazu na článok vygeneruje pripravené príspevky na sociálne siete v správnom formáte pre každú platformu.",
    icon: "📱",
    color: "#ec4899",
    inputLabel: "Téma alebo popis príspevku",
    inputPlaceholder: "Napr. Vydali sme novú funkciu v našom produkte – AI asistent pre zákazníkov...",
    outputLabel: "Social media príspevky",
    buttonLabel: "Generovať posty",
    maxInputLength: 500,
    options: [
      {
        key: "platform",
        label: "Platforma",
        values: [
          { value: "all", label: "Všetky (LinkedIn + X + Facebook)" },
          { value: "linkedin", label: "LinkedIn" },
          { value: "twitter", label: "X / Twitter" },
          { value: "facebook", label: "Facebook" },
        ],
      },
    ],
  },
  {
    slug: "seo-popis",
    name: "SEO Meta Popis",
    description: "Generuje optimalizované meta descriptions",
    longDesc: "Z názvu a obsahu stránky alebo článku vygeneruje SEO-optimalizovaný meta popis (do 160 znakov), ktorý zlepší klikateľnosť vo vyhľadávačoch.",
    icon: "🔍",
    color: "#06b6d4",
    inputLabel: "Nadpis a krátky obsah stránky",
    inputPlaceholder: "Napr. Článok o nových AI modeloch v roku 2026, ich porovnanie a praktické využitie...",
    outputLabel: "Meta popis",
    buttonLabel: "Generovať popis",
    maxInputLength: 800,
  },
];

export function getToolBySlug(slug: string): AiTool | undefined {
  return AI_TOOLS.find((t) => t.slug === slug);
}
