"use client";

import { useState } from "react";
import { ArticleCard } from "@/components/ArticleCard";
import { type Article } from "@/lib/data";
import { ChevronDown, Loader2 } from "lucide-react";

const PAGE_SIZE = 9;

interface LoadMoreGridProps {
    articles: Article[];
}

export function LoadMoreGrid({ articles }: LoadMoreGridProps) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [loading, setLoading] = useState(false);

    const visible = articles.slice(0, visibleCount);
    const hasMore = visibleCount < articles.length;

    const handleLoadMore = () => {
        setLoading(true);
        setTimeout(() => {
            setVisibleCount((prev) => prev + PAGE_SIZE);
            setLoading(false);
        }, 400);
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 text-left">
                {visible.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                ))}
            </div>

            {hasMore && (
                <div className="flex justify-center mt-12">
                    <button
                        onClick={handleLoadMore}
                        disabled={loading}
                        className="group flex items-center gap-3 px-8 py-4 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-primary/40 transition-all duration-300 text-[11px] font-black uppercase tracking-widest text-white/60 hover:text-white disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                Načítavam...
                            </>
                        ) : (
                            <>
                                <ChevronDown size={14} className="transition-transform duration-300 group-hover:translate-y-0.5" />
                                Zobraziť viac článkov
                                <span className="text-white/30">({articles.length - visibleCount} zostatok)</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </>
    );
}
