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
  const secondMainArticle = recentArticles[0];
  const sidebarArticles = recentArticles.slice(1, 4);
  const recommendedArticles = recentArticles.slice(4);

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
        {/* Main large articles column */}
        <section className="col-span-1 lg:col-span-8 flex flex-col gap-12">
          <div className="flex flex-col gap-12">
            <ArticleCard article={latestArticle} featured={true} />

            {secondMainArticle && (
              <div className="pt-12 border-t border-border/50">
                <ArticleCard article={secondMainArticle} featured={true} />
              </div>
            )}
          </div>
        </section>

        {/* Sidebar / Recent articles */}
        <section className="col-span-1 lg:col-span-4 flex flex-col gap-6">
          <div className="flex items-center gap-2 pb-2 border-b-2 border-primary/20">
            <h2 className="font-bold text-lg uppercase tracking-wider">Ďalšie dôležité</h2>
          </div>
          <div className="flex flex-col gap-6">
            {sidebarArticles.map((article) => (
              <div key={article.id}>
                <ArticleCard article={article} />
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 bg-muted/30 rounded-2xl border border-dashed border-border flex flex-col items-center text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">AI Weekly Newsletter</span>
            <p className="text-sm font-medium mb-4">Získajte najdôležitejšie AI novinky každú nedeľu do emailu.</p>
            <div className="w-full flex gap-2">
              <input type="email" placeholder="Váš email" className="flex-grow bg-background border rounded-lg px-3 py-2 text-xs" />
              <button className="bg-primary text-primary-foreground text-[10px] font-bold px-3 py-2 rounded-lg uppercase tracking-tight">Odoberať</button>
            </div>
          </div>
        </section>
      </div>

      {recommendedArticles.length > 0 && (
        <div className="my-16 border-t pt-16">
          <h2 className="text-3xl font-bold tracking-tight mb-8">Odporúčané čítanie</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recommendedArticles.slice(0, 3).map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}

      {/* Infinite-like feed for all mixed articles */}
      {recommendedArticles.length > 3 && (
        <div className="my-24 border-t pt-24">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tight mb-2">Najnovšie príspevky</h2>
              <p className="text-muted-foreground">Kompletný prehľad správ zoradený podľa času pridania.</p>
            </div>
            <div className="h-1 flex-grow mx-8 bg-gradient-to-r from-primary/20 to-transparent rounded-full hidden md:block"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
            {recommendedArticles.slice(3).map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
