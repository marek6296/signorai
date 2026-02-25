import { getArticleBySlug, getRecentArticles } from "@/lib/data";
import { Sidebar } from "@/components/Sidebar";
import Image from "next/image";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { sk } from "date-fns/locale";
import { Sparkles, Calendar, Tag } from "lucide-react";
import type { Metadata } from "next";

interface Props {
    params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const article = await getArticleBySlug(params.slug);
    if (!article) return { title: "Nenájdené" };

    return {
        title: `${article.title} | SignorAI`,
        description: article.excerpt,
        openGraph: {
            title: article.title,
            description: article.excerpt,
            type: "article",
            publishedTime: article.published_at,
            authors: ["SignorAI Redakcia"],
            images: [
                {
                    url: article.main_image,
                    width: 1200,
                    height: 630,
                    alt: article.title,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: article.title,
            description: article.excerpt,
            images: [article.main_image],
        },
    };
}

export default async function ArticlePage({ params }: Props) {
    const article = await getArticleBySlug(params.slug);

    if (!article) {
        notFound();
    }

    const recentArticles = await getRecentArticles(article.id);
    const publishDate = format(parseISO(article.published_at), "d. MMMM yyyy, HH:mm", { locale: sk });

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">

                {/* Main Content */}
                <article className="col-span-1 lg:col-span-8">
                    <header className="mb-8">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                                <Tag className="w-4 h-4" />
                                {article.category}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Calendar className="w-4 h-4" />
                                <time>{publishDate}</time>
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 leading-[1.1]">
                            {article.title}
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground font-medium leading-relaxed mb-8">
                            {article.excerpt}
                        </p>
                    </header>

                    <figure className="relative aspect-video w-full rounded-2xl overflow-hidden mb-12 border bg-muted">
                        <Image
                            src={article.main_image}
                            alt={article.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 100vw, 66vw"
                            priority
                            unoptimized
                        />
                    </figure>

                    {article.ai_summary && (
                        <div className="mb-12 p-8 bg-zinc-950 border border-white/5 rounded-3xl relative overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.02] rotate-12">
                                <Sparkles className="w-48 h-48" />
                            </div>
                            <div className="relative z-10 flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/80">AI SUMMARY</span>
                                </div>
                                <p className="text-lg md:text-xl font-medium italic leading-relaxed text-zinc-200">
                                    "{article.ai_summary}"
                                </p>
                            </div>
                        </div>
                    )}

                    <div
                        className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                        dangerouslySetInnerHTML={{ __html: article.content }}
                    />

                    <div className="mt-12 pt-8 border-t flex items-center justify-between">
                        <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4">
                            Pôvodný zdroj
                        </a>
                    </div>
                </article>

                {/* Sidebar */}
                <div className="col-span-1 lg:col-span-4">
                    <div className="sticky top-24">
                        <Sidebar articles={recentArticles} />
                    </div>
                </div>
            </div>
        </div>
    );
}
