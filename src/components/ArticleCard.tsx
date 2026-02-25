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

    if (featured) {
        return (
            <Link href={`/article/${article.slug}`} className="group relative overflow-hidden rounded-xl bg-card text-card-foreground shadow-sm transition-all hover:shadow-md border focus-visible:outline-none flex flex-col focus-visible:ring-2 focus-visible:ring-ring">
                <article className="flex flex-col">
                    <div className="relative w-full h-[250px] sm:h-[350px] md:h-[400px] overflow-hidden shrink-0">
                        <Image
                            src={article.main_image}
                            alt={article.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, 66vw"
                            priority
                            unoptimized
                        />
                        <div className="absolute top-4 left-4 z-10">
                            <span className="inline-flex items-center rounded-full bg-primary/95 backdrop-blur-md border border-primary/20 px-4 py-1.5 text-xs md:text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-lg">
                                {article.category}
                            </span>
                        </div>
                    </div>
                    <div className="p-6 flex flex-col flex-grow">
                        <time className="text-sm text-muted-foreground mb-3">{publishDate}</time>
                        <h2 className="text-2xl font-bold tracking-tight mb-3 group-hover:text-primary transition-colors">
                            {article.title}
                        </h2>
                        <p className="text-muted-foreground line-clamp-3">
                            {article.ai_summary || article.excerpt}
                        </p>
                    </div>
                </article>
            </Link>
        );
    }

    return (
        <Link href={`/article/${article.slug}`} className="group relative overflow-hidden rounded-xl bg-card text-card-foreground shadow-sm transition-all hover:shadow-md border flex flex-col h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <article className="flex flex-col h-full">
                <div className="relative aspect-[16/9] w-full overflow-hidden shrink-0">
                    <Image
                        src={article.main_image}
                        alt={article.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, 50vw"
                        unoptimized
                    />
                    <div className="absolute top-4 left-4 z-10">
                        <span className="inline-flex items-center rounded-full bg-primary/95 backdrop-blur-md border border-primary/20 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-md">
                            {article.category}
                        </span>
                    </div>
                </div>
                <div className="p-5 md:p-6 flex flex-col flex-grow">
                    <time className="text-sm text-muted-foreground mb-3">{publishDate}</time>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-3 group-hover:text-primary transition-colors line-clamp-2">
                        {article.title}
                    </h3>
                    <p className="text-muted-foreground line-clamp-3">
                        {article.ai_summary || article.excerpt}
                    </p>
                </div>
            </article>
        </Link>
    );
}
