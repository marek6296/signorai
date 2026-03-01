"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen } from "lucide-react";
import { type Article } from "@/lib/data";

interface InContentAdProps {
    articles: Article[];
}

export function InContentAd({ articles }: InContentAdProps) {
    if (!articles || articles.length === 0) return null;

    // We typically show only one primary recommendation for in-content ads, 
    // or a small grid if requested. Let's do a single, high-impact card.
    const article = articles[0];

    return (
        <div className="my-8 p-[1px] bg-gradient-to-r from-primary/20 via-primary/5 to-transparent rounded-3xl overflow-hidden group">
            <div className="bg-zinc-950/90 backdrop-blur-xl border border-white/5 rounded-[1.45rem] p-4 md:p-6 relative overflow-hidden">
                {/* Decorative Background Icon */}
                <div className="absolute -right-8 -bottom-8 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-500 rotate-12">
                    <BookOpen size={160} />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row gap-5 items-center">
                    {/* Image Thumbnail (Smaller) */}
                    <div className="relative w-full md:w-40 aspect-square md:aspect-square rounded-xl overflow-hidden border border-white/10 shadow-xl shrink-0">
                        <Image
                            src={article.main_image}
                            alt={article.title}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>

                    {/* Content (Compressed) */}
                    <div className="flex flex-col flex-1 items-start text-left min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/80">PREČÍTAJTE SI TIEŽ</span>
                        </div>

                        <h3 className="text-lg md:text-xl font-black tracking-tight text-white mb-2 leading-tight group-hover:text-primary transition-colors line-clamp-2">
                            {article.title}
                        </h3>

                        <p className="text-[11px] text-zinc-400 line-clamp-1 mb-4 font-medium leading-relaxed italic">
                            {article.category} • {article.ai_summary || article.excerpt}
                        </p>

                        <Link
                            href={`/article/${article.slug}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[9px] rounded-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
                        >
                            Otvoriť článok
                            <ArrowRight size={12} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
