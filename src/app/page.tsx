import { getLatestArticle, getRecentArticles } from "@/lib/data";
import { ArticleCard } from "@/components/ArticleCard";

export default async function Home() {
  const latestArticle = await getLatestArticle();

  if (!latestArticle) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl text-center">
        <h1 className="text-4xl font-black mb-4">Žiadne články.</h1>
        <p className="text-xl text-muted-foreground">Ešte neboli pridané žiadne články. Otvorte /admin a pridajte prvý!</p>
      </div>
    );
  }

  const recentArticles = await getRecentArticles(latestArticle.id);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
          Hlavné správy
        </h1>
        <p className="text-xl text-muted-foreground mb-8 border-b pb-4">
          Váš denný prehľad toho najdôležitejšieho zo sveta AI, technológií a spoločnosti.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Main large article */}
        <section className="col-span-1 lg:col-span-8">
          <ArticleCard article={latestArticle} featured={true} />
        </section>

        {/* Sidebar / Recent articles */}
        <section className="col-span-1 lg:col-span-4 flex flex-col gap-6">
          <div className="flex items-center gap-2 pb-2 border-b-2 border-primary/20">
            <h2 className="font-bold text-lg uppercase tracking-wider">Ďalšie dôležité</h2>
          </div>
          <div className="flex flex-col gap-6 flex-grow">
            {recentArticles.slice(0, 3).map((article) => (
              <div key={article.id} className="h-full">
                <ArticleCard article={article} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="my-16 border-t pt-16">
        <h2 className="text-3xl font-bold tracking-tight mb-8">Odporúčané čítanie</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {recentArticles.map(article => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </div>
    </div>
  );
}
