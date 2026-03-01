"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { sk } from "date-fns/locale";
import { type Article } from "@/lib/data";
import Image from "next/image";

interface SidebarProps {
    articles: Article[];
    title?: string;
}

export function Sidebar({ articles, title = "Najnovšie správy" }: SidebarProps) {
    return (
        <aside className="w-full flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2 pb-4 border-b-2 border-primary/20 text-center opacity-70">
                <h3 className="font-black text-xl uppercase tracking-[0.2em]">{title}</h3>
            </div>

            <div className="flex flex-col gap-6">
                {articles.map((article) => {
                    const publishDate = format(parseISO(article.published_at), "d. MMMM yyyy", { locale: sk });

                    return (
                        <div
                            key={article.id}
                            className="group relative h-[180px] overflow-hidden rounded-2xl bg-zinc-900 shadow-xl transition-all duration-500 hover:shadow-primary/20 border border-white/5"
                        >
                            <Link
                                href={`/article/${article.slug}`}
                                className="absolute inset-0 z-20"
                                aria-label={article.title}
                            />

                            {/* Background Image with Grayscale Effect */}
                            <div className="absolute inset-0 z-0">
                                <Image
                                    src={article.main_image}
                                    alt={article.title}
                                    fill
                                    className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700 ease-out group-hover:scale-105"
                                    sizes="(max-width: 1024px) 100vw, 25vw"
                                    unoptimized
                                />
                                {/* Overlay for Readability */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80" />
                            </div>

                            {/* Category Badge */}
                            <div className="absolute top-3 left-4 z-10 pointer-events-none">
                                <span className="inline-flex items-center rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-white">
                                    {article.category}
                                </span>
                            </div>

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 w-full p-4 z-10 pointer-events-none">
                                <div className="flex flex-col gap-1">
                                    <time className="text-[8px] font-bold text-white/50 uppercase tracking-widest">
                                        {publishDate}
                                    </time>
                                    <h4 className="font-black text-xs md:text-sm text-white leading-tight line-clamp-2 transition-colors group-hover:text-primary">
                                        {article.title}
                                    </h4>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Newsletter Block */}
            <div className="mt-4 bg-card/40 backdrop-blur-xl p-6 rounded-2xl border border-border/50 relative overflow-hidden group shadow-lg">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
                <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-primary mb-2">Newsletter</h4>
                <p className="text-sm font-bold text-foreground mb-4">
                    Týždenné AI novinky priamo do vášho emailu.
                </p>
                <form className="flex flex-col gap-2 relative z-10" onSubmit={(e) => e.preventDefault()}>
                    <input
                        type="email"
                        placeholder="Váš email"
                        className="bg-background/50 border border-border/50 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        required
                    />
                    <button className="bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest py-3 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary/20">
                        Odoberať
                    </button>
                </form>
            </div>
        </aside>
    );
}
