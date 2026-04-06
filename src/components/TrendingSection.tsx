"use client";

import { useState, useEffect } from "react";
import { Eye, Flame, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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
      .then((data) => setArticles(data.articles ?? []))
      .catch((err) => console.error("TrendingSection fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (articles.length === 0) return null;

  const [top, ...rest] = articles;

  return (
    <div className="flex flex-col gap-3 mb-2">
      {/* Section header */}
      <div className="flex items-center gap-2 pb-1">
        <Flame className="w-4 h-4 text-primary" />
        <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/60">
          Trending tento týždeň
        </h2>
      </div>

      {/* Featured #1 — full card */}
      <Link
        href={`/article/${top.slug}`}
        className="group relative h-[200px] overflow-hidden rounded-2xl bg-zinc-900 shadow-xl transition-all duration-500 hover:shadow-amber-500/10 border border-white/5"
      >
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <Image
            src={top.main_image}
            alt={top.title}
            fill
            className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 25vw"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90" />
        </div>

        {/* Rank badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl text-base font-black leading-none shadow-lg bg-primary/20 border border-primary/40 backdrop-blur-md text-primary">
            1
          </span>
        </div>

        {/* Category */}
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-white">
            {top.category}
          </span>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 w-full p-4 z-10">
          <h3 className="font-black text-sm text-white leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-2">
            {top.title}
          </h3>
          {top.views > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-white/50 font-semibold">
              <Eye className="w-3 h-3" />
              {top.views.toLocaleString("sk")} zobrazení
            </span>
          )}
        </div>
      </Link>

      {/* Ranks 2–5 — compact rows with thumbnail */}
      <div className="flex flex-col gap-2">
        {rest.map((article) => (
          <Link
            key={article.id}
            href={`/article/${article.slug}`}
            className="group flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06]"
          >
            {/* Thumbnail with rank overlay */}
            <div className="relative flex-shrink-0 w-[72px] h-[52px] rounded-xl overflow-hidden bg-zinc-900">
              <Image
                src={article.main_image}
                alt={article.title}
                fill
                className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
                sizes="72px"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/20" />
              {/* Rank number */}
              <div className="absolute bottom-1 left-1">
                <span className="flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-black leading-none shadow bg-primary/20 border border-primary/30 backdrop-blur-sm text-primary">
                  {article.rank}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground/80 leading-snug group-hover:text-foreground transition-colors line-clamp-2">
                {article.title}
              </p>
              {article.views > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/40 font-semibold">
                  <Eye className="w-2.5 h-2.5" />
                  {article.views.toLocaleString("sk")}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
