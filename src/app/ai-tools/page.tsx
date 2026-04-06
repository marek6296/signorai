import Link from "next/link";
import { AI_TOOLS } from "@/lib/ai-tools-config";
import { Sparkles, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Nástroje | AIWai",
  description: "Praktické AI nástroje zadarmo – sumarizátor, generátor titulkov, prekladač, prompt vylepšovač a ďalšie.",
};

export default function AiToolsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-5xl">
      {/* Hero */}
      <div className="flex flex-col items-center text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.25em] mb-4">
          <Sparkles className="w-3 h-3" />
          Zadarmo
        </div>
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight mb-4">
          AI Nástroje
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl font-medium">
          Praktické nástroje poháňané umelou inteligenciou. Žiadna registrácia, žiadna platba — stačí otvoriť a použiť.
        </p>
      </div>

      {/* Tools grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AI_TOOLS.map((tool) => (
          <Link
            key={tool.slug}
            href={tool.comingSoon ? "#" : `/ai-tools/${tool.slug}`}
            className={`group relative flex flex-col gap-4 p-6 rounded-3xl border transition-all duration-300 ${
              tool.comingSoon
                ? "opacity-60 cursor-not-allowed border-border/20 bg-secondary/5"
                : "hover:scale-[1.02] hover:shadow-xl border-border/20 bg-secondary/5 hover:border-border/40"
            }`}
            style={tool.comingSoon ? {} : {
              borderColor: `${tool.color}20`,
              background: `${tool.color}06`,
            }}
            onClick={tool.comingSoon ? (e) => e.preventDefault() : undefined}
          >
            {/* Coming soon badge */}
            {tool.comingSoon && (
              <div className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-secondary/40 text-muted-foreground/50">
                Čoskoro
              </div>
            )}

            {/* Icon */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
              style={{ background: `${tool.color}15`, border: `1px solid ${tool.color}25` }}
            >
              {tool.icon}
            </div>

            {/* Info */}
            <div className="flex flex-col gap-1.5 flex-1">
              <h2 className="font-black text-base text-foreground/90 group-hover:text-foreground transition-colors">
                {tool.name}
              </h2>
              <p className="text-sm text-muted-foreground/70 leading-relaxed">
                {tool.description}
              </p>
            </div>

            {/* Arrow */}
            {!tool.comingSoon && (
              <div
                className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-colors mt-1"
                style={{ color: tool.color }}
              >
                Otvoriť nástroj
                <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Bottom note */}
      <p className="text-center text-xs text-muted-foreground/40 font-semibold mt-12">
        Všetky nástroje využívajú Gemini AI. Výsledky môžu byť nepresné — vždy skontroluj výstup.
      </p>
    </div>
  );
}
