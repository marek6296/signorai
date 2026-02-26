import { getLatestArticle, getRecentArticles } from "@/lib/data";
import { ArticleCard } from "@/components/ArticleCard";
import { NewsletterSidebar } from "@/components/NewsletterSidebar";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const BASE_URL = "https://postovinky.news";

export const metadata: Metadata = {
  title: "Hlavné správy",
  description: "Váš denný prehľad toho najdôležitejšieho zo sveta technológií, AI, biznisu a svetových udalostí. Najnovšie články a analýzy na jednom mieste.",
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: "Hlavné správy | Postovinky",
    description: "Denný prehľad najdôležitejších správ – tech, AI, biznis, svet.",
    url: BASE_URL,
    siteName: "Postovinky",
    locale: "sk_SK",
  },
};

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
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8 md:pt-4 md:pb-12 max-w-7xl">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Main large articles column */}
        <section className="col-span-1 lg:col-span-8 flex flex-col gap-6 md:gap-12">
          <div className="flex flex-col gap-6 md:gap-12">
            <ArticleCard article={latestArticle} featured={true} priority />

            {principalArticles.map((article) => (
              <div key={article.id} className="pt-6 md:pt-12 border-t border-border/50">
                <ArticleCard article={article} featured={true} />
              </div>
            ))}
          </div>
        </section>

        {/* Sidebar / Recent articles */}
        <section className="col-span-1 lg:col-span-4 flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 pb-4 border-b-2 border-primary/20 text-center opacity-70">
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
              <div className="p-8 bg-muted/20 rounded-2xl text-center border border-dashed border-border/50 text-muted-foreground/60">
                <p className="text-sm">Pripravujeme pre vás ďalšie aktuality.</p>
              </div>
            )}
          </div>

          <NewsletterSidebar />
        </section>
      </div>

      {/* Grid feed for all remaining mixed articles */}
      {remainingArticles.length > 0 && (
        <div className="my-16 border-t border-white/5 pt-16 text-center">
          <div className="flex flex-col items-center mb-10 opacity-70">
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-4 text-center">Najnovšie príspevky</h2>
            <div className="w-16 h-1 bg-primary mb-4 rounded-full" />
            <p className="text-muted-foreground text-base">Kompletný prehľad správ zoradený podľa času pridania.</p>
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
