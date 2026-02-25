import { getLatestArticle, getRecentArticles } from "@/lib/data";
import { ArticleCard } from "@/components/ArticleCard";
import { PageHeader } from "@/components/PageHeader";

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
  // Distributed logic for a rich news portal look
  const principalArticles = recentArticles.slice(0, 5); // Up to 5 big stories in main column
  const sidebarArticles = recentArticles.slice(5, 8); // Next 3 in sidebar
  const remainingArticles = recentArticles.slice(8); // Everything else at the bottom

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl">
      <PageHeader
        title="Hlavné správy"
        description="Váš denný prehľad toho najdôležitejšieho zo sveta AI, technológií a spoločnosti."
        category="Latest Intelligence"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Main large articles column */}
        <section className="col-span-1 lg:col-span-8 flex flex-col gap-12">
          <div className="flex flex-col gap-12">
            <ArticleCard article={latestArticle} featured={true} />

            {principalArticles.map((article) => (
              <div key={article.id} className="pt-12 border-t border-border/50">
                <ArticleCard article={article} featured={true} />
              </div>
            ))}
          </div>
        </section>

        {/* Sidebar / Recent articles */}
        <section className="col-span-1 lg:col-span-4 flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 pb-4 border-b-2 border-primary/20 text-center">
            <h2 className="font-black text-xl uppercase tracking-[0.2em]">Ďalšie dôležité</h2>
          </div>

          <div className="flex flex-col gap-6">
            {sidebarArticles.length > 0 ? (
              sidebarArticles.map((article) => (
                <div key={article.id}>
                  <ArticleCard article={article} />
                </div>
              ))
            ) : (
              <div className="p-8 bg-muted/20 rounded-2xl text-center border border-dashed border-border/50">
                <p className="text-sm text-muted-foreground">Pripravujeme pre vás ďalšie aktuality.</p>
              </div>
            )}
          </div>

          <div className="mt-8 p-8 bg-muted/40 border border-border rounded-[2rem] flex flex-col items-center text-center sticky top-24 shadow-sm backdrop-blur-sm">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-2xl">
              ✉️
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">AI Weekly Newsletter</span>
            <p className="text-sm font-bold mb-6 text-foreground/80">Získajte najdôležitejšie AI novinky každú nedeľu do emailu.</p>
            <div className="w-full flex flex-col gap-3">
              <input
                type="email"
                placeholder="Váš email"
                className="w-full bg-background border border-border rounded-xl px-4 py-4 text-xs focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
              />
              <button className="w-full bg-primary text-primary-foreground text-xs font-black px-4 py-4 rounded-xl uppercase tracking-[0.1em] hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20">
                Odoberať
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Grid feed for all remaining mixed articles */}
      {remainingArticles.length > 0 && (
        <div className="my-24 border-t border-white/5 pt-24 text-center">
          <div className="flex flex-col items-center mb-16">
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight mb-4 text-center">Najnovšie príspevky</h2>
            <div className="w-20 h-1 bg-primary mb-4 rounded-full" />
            <p className="text-muted-foreground text-lg">Kompletný prehľad správ zoradený podľa času pridania.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 text-left">
            {remainingArticles.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
