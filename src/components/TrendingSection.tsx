"use client";

import { useState, useEffect } from "react";
import { Eye, Loader2 } from "lucide-react";
import Link from "next/link";

interface TrendingArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  main_image: string;
  views: number;
  rank: number;
}

export function TrendingSection() {
  const [articles, setArticles] = useState<TrendingArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trending")
      .then((res) => res.json())
      .then((data) => {
        setArticles(data.articles ?? []);
      })
      .catch((err) => {
        console.error("TrendingSection fetch error:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="rounded-2xl overflow-hidden mb-6"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/30">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70 flex items-center gap-2">
          🔥 Trending tento týždeň
        </h2>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
        </div>
      ) : articles.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground/40">
          Žiadne trending články
        </div>
      ) : (
        <div className="flex flex-col">
          {articles.map((article, index) => (
            <Link
              key={article.id}
              href={`/article/${article.slug}`}
              className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]"
              style={{
                borderBottom:
                  index < articles.length - 1
                    ? "1px solid rgba(255,255,255,0.05)"
                    : "none",
              }}
            >
              {/* Rank number */}
              <span
                className="flex-shrink-0 text-4xl font-black leading-none tabular-nums select-none"
                style={{
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  minWidth: "2.25rem",
                  textAlign: "center",
                }}
              >
                {article.rank}
              </span>

              {/* Info */}
              <div className="flex flex-col gap-1.5 min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-bold text-foreground/85 leading-snug group-hover:text-primary transition-colors line-clamp-2">
                  {article.title}
                </p>
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block text-[10px] font-black uppercase tracking-widest rounded-full px-2 py-0.5"
                    style={{
                      background: "rgba(139,92,246,0.12)",
                      border: "1px solid rgba(139,92,246,0.2)",
                      color: "#a78bfa",
                    }}
                  >
                    {article.category}
                  </span>
                  {article.views > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40 font-semibold">
                      <Eye className="w-3 h-3" />
                      {article.views.toLocaleString("sk")}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
