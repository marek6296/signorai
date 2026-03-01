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
        <div className="my-12 p-1 bg-gradient-to-r from-primary/20 via-primary/5 to-transparent rounded-[2rem] overflow-hidden group">
            <div className="bg-zinc-950/90 backdrop-blur-xl border border-white/5 rounded-[1.9rem] p-6 md:p-8 relative overflow-hidden">
                {/* Decorative Background Icon */}
                <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500 rotate-12">
                    <BookOpen size={200} />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                    {/* Image Thumbnail */}
                    <div className="relative w-full md:w-1/3 aspect-[16/10] rounded-2xl overflow-hidden border border-white/10 shadow-2xl shrink-0">
                        <Image
                            src={article.main_image}
                            alt={article.title}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-3 left-4">
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary-foreground bg-primary px-2 py-1 rounded">
                                {article.category}
                            </span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-col flex-1 items-start text-left">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">PREČÍTAJTE SI TIEŽ</span>
                        </div>

                        <h3 className="text-xl md:text-2xl font-black tracking-tight text-white mb-4 leading-tight group-hover:text-primary transition-colors">
                            {article.title}
                        </h3>

                        <p className="text-sm text-zinc-400 line-clamp-2 mb-6 font-medium leading-relaxed">
                            {article.ai_summary || article.excerpt}
                        </p>

                        <Link
                            href={`/article/${article.slug}`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-primary hover:text-white transition-all hover:scale-105 active:scale-95"
                        >
                            Chcem čítať viac
                            <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
