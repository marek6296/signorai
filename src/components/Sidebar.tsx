"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { sk } from "date-fns/locale";
import { type Article } from "@/lib/data";

interface SidebarProps {
    articles: Article[];
    title?: string;
}

export function Sidebar({ articles, title = "Najnovšie správy" }: SidebarProps) {
    return (
        <aside className="w-full flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-primary/20">
                <h3 className="font-bold text-lg uppercase tracking-wider">{title}</h3>
            </div>
            <div className="flex flex-col gap-6">
                {articles.map((article, i) => (
                    <article key={article.id} className="group relative flex gap-4 items-start">
                        <span className="text-4xl font-black text-muted-foreground/20 leading-none tabular-nums shrink-0">
                            {i + 1}
                        </span>
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-primary mb-1">
                                {article.category}
                            </span>
                            <Link href={`/article/${article.slug}`} className="block">
                                <h4 className="font-bold text-sm leading-snug group-hover:text-primary transition-colors mb-1 line-clamp-3">
                                    {article.title}
                                </h4>
                            </Link>
                            <time className="text-xs text-muted-foreground mt-1">
                                {format(parseISO(article.published_at), "d. MMMM yyyy", { locale: sk })}
                            </time>
                        </div>
                    </article>
                ))}
            </div>

            {/* Sample Newsletter Block */}
            <div className="mt-8 bg-muted/50 p-6 rounded-xl border relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
                <h4 className="font-bold text-lg mb-2 relative z-10">AI Weekly Newsletter</h4>
                <p className="text-sm text-muted-foreground mb-4 relative z-10">
                    Získajte najdôležitejšie AI novinky každú nedeľu do emailu.
                </p>
                <form className="flex flex-col gap-2 relative z-10" onSubmit={(e) => e.preventDefault()}>
                    <input
                        type="email"
                        placeholder="Váš email"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        required
                    />
                    <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full">
                        Odoberať
                    </button>
                </form>
            </div>
        </aside>
    );
}
