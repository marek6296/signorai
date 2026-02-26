import { getArticlesByCategory, CATEGORY_MAP } from "@/lib/data";
import { ArticleCard } from "@/components/ArticleCard";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

const BASE_URL = "https://postovinky.news";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const slug = params.kategoria.toLowerCase();
    const categoryName = CATEGORY_MAP[slug] || "Kategória";
    const canonicalUrl = `${BASE_URL}/kategoria/${slug}`;
    const description = `Najnovšie správy a články z kategórie ${categoryName}. Sledujte aktuálne trendy a novinky.`;

    return {
        title: categoryName,
        description,
        alternates: { canonical: canonicalUrl },
        openGraph: {
            title: `Kategória: ${categoryName} | Postovinky`,
            description: `Všetky najnovšie správy z kategórie ${categoryName} na jednom mieste.`,
            url: canonicalUrl,
            siteName: "Postovinky",
            locale: "sk_SK",
        },
        twitter: { card: "summary_large_image", title: `${categoryName} | Postovinky`, description },
    };
}

interface Props {
    params: { kategoria: string };
}

export default async function CategoryPage({ params }: Props) {
    const slug = params.kategoria.toLowerCase();

    // Validate if it's one of our defined categories
    if (!CATEGORY_MAP[slug]) {
        notFound();
    }

    const articles = await getArticlesByCategory(slug);

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8 md:pt-4 md:pb-12 max-w-7xl flex-grow">

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
        </div>
    );
}
