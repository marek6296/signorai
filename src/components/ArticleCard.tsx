import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { sk } from "date-fns/locale";
import { type Article } from "@/lib/data";

interface ArticleCardProps {
    article: Article;
    featured?: boolean;
}

export function ArticleCard({ article, featured = false }: ArticleCardProps) {
    const publishDate = format(parseISO(article.published_at), "d. MMMM yyyy", { locale: sk });

    return (
        <Link
            href={`/article/${article.slug}`}
            className={`group relative overflow-hidden rounded-[2rem] bg-zinc-900 shadow-2xl transition-all duration-500 hover:shadow-primary/20 border border-white/5 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${featured ? 'h-[400px] md:h-[500px]' : 'h-[350px] md:h-[400px]'
                }`}
        >
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <Image
                    src={article.main_image}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                    sizes={featured ? "(max-width: 1280px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"}
                    unoptimized
                />
                {/* Dark Gradient Overlay for Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80" />
            </div>

            {/* Category Badge - Top Left */}
            <div className="absolute top-6 left-6 z-20">
                <span className="inline-flex items-center rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xl">
                    {article.category}
                </span>
            </div>

            {/* Content Overlay - Glassmorphism at Bottom */}
            <div className="mt-auto relative z-10 w-full p-2">
                <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] p-6 md:p-8 transition-transform duration-500 group-hover:-translate-y-2">
                    <div className="flex flex-col gap-3">
                        <time className="text-[10px] md:text-xs font-bold text-white/50 uppercase tracking-widest">
                            {publishDate}
                        </time>
                        <h2 className={`font-black tracking-tight text-white leading-tight group-hover:text-primary transition-colors ${featured ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'
                            }`}>
                            {article.title}
                        </h2>
                        <p className="text-sm md:text-base text-zinc-300/90 line-clamp-2 md:line-clamp-3 leading-relaxed font-medium">
                            {article.ai_summary || article.excerpt}
                        </p>
                    </div>
                </div>
            </div>

            {/* Subtle Inner Glow on Hover */}
            <div className="absolute inset-0 border-2 border-primary/0 rounded-[2rem] transition-all duration-500 group-hover:border-primary/20 group-hover:bg-primary/5 pointer-events-none" />
        </Link>
    );
}
