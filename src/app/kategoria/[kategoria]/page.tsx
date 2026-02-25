import { getArticlesByCategory } from "@/lib/data";
import { ArticleCard } from "@/components/ArticleCard";
import { notFound } from "next/navigation";

interface Props {
    params: { kategoria: string };
}

export default async function CategoryPage({ params }: Props) {
    const kategoriaVstup = params.kategoria;

    // Validate if it's one of our allowed categories
    const validCategories = ['svet', 'tech', 'politika', 'biznis'];
    if (!validCategories.includes(kategoriaVstup.toLowerCase())) {
        notFound();
    }

    const articles = await getArticlesByCategory(kategoriaVstup);
    const categoryName = kategoriaVstup.charAt(0).toUpperCase() + kategoriaVstup.slice(1).toLowerCase();

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl flex-grow">
            <div className="mb-12">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                    {categoryName}
                </h1>
                <p className="text-xl text-muted-foreground mb-8 border-b pb-4">
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
