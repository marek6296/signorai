"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Article } from "@/lib/data";
import { ArticleCard } from "@/components/ArticleCard";
import { Search, Loader2 } from "lucide-react";

function SearchResults() {
    const searchParams = useSearchParams();
    const query = searchParams.get("q") || "";
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchResults = async () => {
            if (!query) {
                setArticles([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from("articles")
                    .select("*")
                    .eq("status", "published")
                    .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%,content.ilike.%${query}%`)
                    .order("published_at", { ascending: false });

                if (error) throw error;
                setArticles(data || []);
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [query]);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col mb-12">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <Search className="w-6 h-6 text-primary" />
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic">
                        Výsledky hľadania
                    </h1>
                </div>
                <p className="text-muted-foreground text-lg italic">
                    {loading
                        ? "Hľadám..."
                        : query
                            ? `Nájdené výsledky pre "${query}" (${articles.length})`
                            : "Zadajte hľadaný výraz..."
                    }
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
            ) : articles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {articles.map((article) => (
                        <ArticleCard key={article.id} article={article} />
                    ))}
                </div>
            ) : query ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                        <Search className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-2xl font-black uppercase mb-2">Žiadne výsledky</h3>
                    <p className="text-muted-foreground max-w-md italic">
                        Pre dopyt &quot;{query}&quot; sme nenašli žiadne články. Skúste iné kľúčové slovo.
                    </p>
                </div>
            ) : null}
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="container mx-auto px-4 py-20 flex justify-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
        }>
            <SearchResults />
        </Suspense>
    );
}
