import { notFound } from "next/navigation";
import { getToolBySlug, AI_TOOLS } from "@/lib/ai-tools-config";
import { ToolInterface } from "@/components/tools/ToolInterface";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: { tool: string };
}

export async function generateStaticParams() {
  return AI_TOOLS.filter((t) => !t.comingSoon).map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = getToolBySlug(params.tool);
  if (!tool) return { title: "AI Nástroj | AIWai" };
  return {
    title: `${tool.name} | AIWai Nástroje`,
    description: tool.longDesc,
  };
}

export default function ToolPage({ params }: Props) {
  const tool = getToolBySlug(params.tool);
  if (!tool || tool.comingSoon) notFound();

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-3xl">
      {/* Back */}
      <Link
        href="/ai-tools"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground/60 hover:text-primary transition-colors mb-8"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        AI Nástroje
      </Link>

      {/* Header */}
      <div className="flex items-start gap-5 mb-10">
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl flex-shrink-0"
          style={{ background: `${tool.color}15`, border: `1px solid ${tool.color}25` }}
        >
          {tool.icon}
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-1">{tool.name}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{tool.longDesc}</p>
        </div>
      </div>

      {/* Interactive tool */}
      <ToolInterface tool={tool} />
    </div>
  );
}
