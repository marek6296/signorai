"use client";

import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { sk } from "date-fns/locale";
import { type Article } from "@/lib/data";
import { Edit, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ArticleCardProps {
    article: Article;
    featured?: boolean;
    /** Pre LCP: nastav true pre prvý obrázok na stránke (napr. hlavný článok na homepage) */
    priority?: boolean;
}

export function ArticleCard({ article, featured = false, priority = false }: ArticleCardProps) {
    const publishDate = format(parseISO(article.published_at), "d. MMMM yyyy", { locale: sk });

    const [isAdmin, setIsAdmin] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setIsAdmin(localStorage.getItem("admin_logged_in") === "true");
    }, []);

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!confirm("Naozaj vymazať článok? Túto akciu nie je možné vrátiť späť.")) return;

        try {
            const { error } = await supabase.from("articles").delete().eq("id", article.id);
            if (error) throw error;

            await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
            router.refresh();
        } catch (error: unknown) {
            alert("Chyba pri mazaní: " + (error as Error).message);
        }
    };

    return (
        <div className={`group relative overflow-hidden rounded-[2rem] bg-zinc-900 shadow-2xl transition-all duration-500 hover:shadow-primary/20 border border-white/5 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${featured ? 'h-[400px] md:h-[500px]' : 'h-[350px] md:h-[400px]'
            }`}>
            <Link
                href={`/article/${article.slug}`}
                className="absolute inset-0 z-10"
                aria-label={article.title}
            />

            {isAdmin && (
                <div className="absolute top-4 right-4 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto flex flex-col gap-2">
                    <Link
                        href={`/admin/edit/${article.id}`}
                        className="p-3 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-all border border-white/20 shadow-2xl flex items-center gap-2 group/btn"
                        title="Upraviť článok"
                    >
                        <Edit className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                    </Link>
                    <button
                        onClick={handleDelete}
                        className="p-3 bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md rounded-full text-red-50 transition-all border border-red-500/20 shadow-2xl flex items-center gap-2 group/btn"
                        title="Odstrániť článok"
                    >
                        <Trash2 className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                    </button>
                </div>
            )}

            {/* Background Image */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <Image
                    src={article.main_image}
                    alt={article.title}
                    fill
                    priority={priority}
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                    sizes={featured ? "(max-width: 1280px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"}
                    unoptimized
                />
                {/* Dark Gradient Overlay for Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 pointer-events-none" />
            </div>

            {/* Category Badge - Top Left */}
            <div className="absolute top-4 left-6 z-20 pointer-events-none">
                <span className="inline-flex items-center rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xl">
                    {article.category}
                </span>
            </div>

            {/* Content Overlay - Glassmorphism at Bottom */}
            <div className="mt-auto relative z-20 w-full p-2 pointer-events-none">
                <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] p-4 md:p-5 transition-transform duration-500 group-hover:-translate-y-2 flex flex-col items-start text-left">
                    <div className="flex flex-col gap-1.5 md:gap-2 items-start">
                        <time className="text-[9px] md:text-[10px] font-bold text-white/50 uppercase tracking-widest">
                            {publishDate}
                        </time>
                        <h2 className={`font-black tracking-tight text-white leading-tight transition-all duration-300 ${featured ? 'text-xl md:text-3xl' : 'text-lg md:text-xl'
                            }`}>
                            {article.title}
                        </h2>
                        <p className="text-xs md:text-sm text-zinc-300/90 line-clamp-2 leading-relaxed font-medium">
                            {article.ai_summary || article.excerpt}
                        </p>
                    </div>
                </div>
            </div>

            {/* Subtle Inner Glow on Hover */}
            <div className="absolute inset-0 border-2 border-primary/0 rounded-[2rem] transition-all duration-500 group-hover:border-primary/20 group-hover:bg-primary/5 pointer-events-none" />
        </div>
    );
}
