import { getArticlesByCategory, CATEGORY_MAP } from "@/lib/data";
import { ArticleCard } from "@/components/ArticleCard";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { PageTransition } from "@/components/PageTransition";

export const dynamic = "force-dynamic";

const BASE_URL = "https://aiwai.news";

const CATEGORY_SEO: Record<string, { description: string; keywords: string[] }> = {
    ai: {
        description: "Najnovšie správy a novinky o umelej inteligencii – ChatGPT, Claude, Gemini, AI modely, výskum a startupy. Denný prehľad AI sveta.",
        keywords: ["umelá inteligencia", "AI správy", "ChatGPT", "Claude", "Gemini", "GPT-4", "AI modely", "AI výskum", "strojové učenie", "deep learning", "AI novinky Slovensko", "artificial intelligence"],
    },
    tech: {
        description: "Najnovšie správy zo sveta technológií – smartfóny, Apple, Google, Samsung, startupy a digitálne inovácie. Tech novinky každý deň.",
        keywords: ["technologické správy", "tech novinky", "Apple", "Google", "Samsung", "smartfóny", "technológie Slovensko", "startupy", "digitálne inovácie", "tech trendy 2026"],
    },
    navody: {
        description: "Praktické návody, tipy a triky zo sveta AI a technológií. Naučte sa využívať umelú inteligenciu v každodennom živote.",
        keywords: ["AI návody", "technologické tipy", "návody umelá inteligencia", "tipy a triky", "ako na AI", "ChatGPT návod", "AI pre začiatočníkov", "digitálne zručnosti", "tutoriály technológie"],
    },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const slug = params.kategoria.toLowerCase();
    const categoryName = CATEGORY_MAP[slug] || "Kategória";
    const canonicalUrl = `${BASE_URL}/kategoria/${slug}`;
    const seo = CATEGORY_SEO[slug];
    const description = seo?.description ?? `Najnovšie správy a články z kategórie ${categoryName}. Sledujte aktuálne trendy a novinky na AIWai.`;
    const keywords = seo?.keywords ?? [categoryName, "AIWai", "správy", "novinky"];

    return {
        title: `${categoryName} – Správy & Novinky`,
        description,
        keywords,
        alternates: { canonical: canonicalUrl },
        openGraph: {
            title: `${categoryName} | AIWai – Správy a Novinky`,
            description,
            url: canonicalUrl,
            siteName: "AIWai",
            locale: "sk_SK",
            type: "website",
        },
        twitter: { card: "summary_large_image", title: `${categoryName} | AIWai`, description },
    };
}

interface Props {
    params: { kategoria: string };
}

export default async function CategoryPage({ params }: Props) {
    const slug = params.kategoria.toLowerCase();

    if (!CATEGORY_MAP[slug]) {
        notFound();
    }

    const articles = await getArticlesByCategory(slug);
    const categoryName = CATEGORY_MAP[slug];
    const canonicalUrl = `${BASE_URL}/kategoria/${slug}`;

    const jsonLdCollection = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": canonicalUrl,
        "name": `${categoryName} – AIWai`,
        "description": CATEGORY_SEO[slug]?.description,
        "url": canonicalUrl,
        "inLanguage": "sk-SK",
        "publisher": { "@id": "https://aiwai.news/#organization" },
        "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Domov", "item": BASE_URL },
                { "@type": "ListItem", "position": 2, "name": categoryName, "item": canonicalUrl },
            ]
        },
        "mainEntity": {
            "@type": "ItemList",
            "itemListElement": articles.slice(0, 10).map((article, i) => ({
                "@type": "ListItem",
                "position": i + 1,
                "url": `${BASE_URL}/article/${article.slug}`,
                "name": article.title,
            }))
        }
    };

    return (
        <PageTransition className="container mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8 md:pt-4 md:pb-12 max-w-7xl flex-grow">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdCollection) }} />

            {articles.length === 0 ? (
                <div className="text-center py-20 bg-muted/30 rounded-2xl border border-dashed">
                    <h2 className="text-2xl font-bold mb-2">Zatiaľ tu nič nie je.</h2>
                    <p className="text-muted-foreground">V tejto kategórii sme zatiaľ nevydali žiadne články.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {articles.map(article => (
                        <ArticleCard key={article.id} article={article} />
                    ))}
                </div>
            )}
        </PageTransition>
    );
}
