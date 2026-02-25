import { getArticlesByCategory, CATEGORY_MAP } from "@/lib/data";
import { ArticleCard } from "@/components/ArticleCard";
import { notFound } from "next/navigation";

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
    const categoryName = CATEGORY_MAP[slug];

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl flex-grow">
            <div className="mb-16 text-center">
                <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 uppercase">
                    {categoryName}
                </h1>
                <div className="w-24 h-1.5 bg-primary mx-auto mb-6 rounded-full" />
                <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
                    Najnovšie články z kategórie {categoryName}.
                </p>
            </div>

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
