import Link from "next/link";
import { AI_TOOLS } from "@/lib/ai-tools-config";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Nástroje | AIWai",
  description: "Praktické AI nástroje zadarmo – sumarizátor, generátor titulkov, prekladač, prompt vylepšovač a ďalšie.",
};

export default function AiToolsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 max-w-3xl">
      {/* Hero */}
      <div className="flex flex-col items-center text-center mb-10">
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight mb-4">
          AI Nástroje
        </h1>
        <p className="text-base text-muted-foreground max-w-xl font-medium">
          Praktické nástroje poháňané umelou inteligenciou. Žiadna registrácia, žiadna platba.
        </p>
      </div>

      {/* Tools list */}
      <div className="flex flex-col divide-y divide-border/20">
        {AI_TOOLS.map((tool, index) => (
          <Link
            key={tool.slug}
            href={tool.comingSoon ? "#" : `/ai-tools/${tool.slug}`}
            className={`group flex items-center justify-between gap-6 py-5 transition-colors ${
              tool.comingSoon
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-secondary/10 -mx-4 px-4 rounded-2xl"
            }`}
            onClick={tool.comingSoon ? (e) => e.preventDefault() : undefined}
          >
            <div className="flex items-center gap-5 min-w-0">
              {/* Number */}
              <span className="text-[11px] font-black tabular-nums text-muted-foreground/30 w-5 flex-shrink-0 text-right">
                {String(index + 1).padStart(2, "0")}
              </span>

              {/* Info */}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-black text-sm text-foreground/85 group-hover:text-foreground transition-colors">
                  {tool.name}
                </span>
                <span className="text-xs text-muted-foreground/55 truncate">
                  {tool.description}
                </span>
              </div>
            </div>

            {/* Right side */}
            {tool.comingSoon ? (
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 flex-shrink-0">
                Čoskoro
              </span>
            ) : (
              <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
            )}
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground/30 font-semibold mt-10">
        Poháňané Gemini AI · Výsledky vždy skontroluj
      </p>
    </div>
  );
}
