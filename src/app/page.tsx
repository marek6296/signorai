import { getLatestArticle, getRecentArticles } from "@/lib/data";
import { ArticleCard } from "@/components/ArticleCard";
import { NewsletterSidebar } from "@/components/NewsletterSidebar";
import { SocialPromo } from "@/components/SocialPromo";
import { LoadMoreGrid } from "@/components/LoadMoreGrid";
import { AppPromo } from "@/components/AppPromo";
import { AdBanner } from "@/components/AdBanner";
import { AdBlock } from "@/components/AdBlock";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const BASE_URL = "https://aiwai.news";

export const metadata: Metadata = {
  title: { absolute: "AI-Tech Novinky | AIWai" },
  description: "Najnovšie správy o umelej inteligencii, technológiách a digitálnych trendoch. Denný prehľad AI noviniek, analýzy a návody pre Slovensko.",
  keywords: ["AI správy", "umelá inteligencia novinky", "technologické správy dnes", "AI novinky Slovensko", "tech správy", "ChatGPT novinky", "digitálne novinky"],
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: "AIWai – Najnovšie AI Správy & Tech Novinky",
    description: "Denný prehľad najdôležitejších správ zo sveta umelej inteligencie, technológií a digitálnych inovácií.",
    url: BASE_URL,
    siteName: "AIWai",
    locale: "sk_SK",
    type: "website",
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
  const principalArticles = recentArticles.slice(0, 5);
  const sidebarArticles = recentArticles.slice(5, 8);
  const remainingArticles = recentArticles.slice(8);

  // JSON-LD: ItemList of top articles for Google rich results
  const jsonLdItemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Najnovšie AI správy a technológie",
    "description": "Prehľad najnovších správ o umelej inteligencii a technológiách.",
    "url": BASE_URL,
    "itemListElement": [latestArticle, ...principalArticles].slice(0, 10).map((article, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": `${BASE_URL}/article/${article.slug}`,
      "name": article.title,
      "image": article.main_image,
    }))
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8 md:pt-4 md:pb-12 max-w-7xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdItemList) }} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Main large articles column */}
        <section className="col-span-1 lg:col-span-8 flex flex-col gap-3 md:gap-4">
          <div className="flex flex-col gap-3 md:gap-4">
            <ArticleCard article={latestArticle} featured={true} priority />

            {principalArticles.map((article) => (
              <div key={article.id} className="pt-3 md:pt-4 border-t border-border/30">
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

          {/* Reklama — skrytá pre prihlásených */}
          <AdBlock />

          <AppPromo />

          <SocialPromo />

          <NewsletterSidebar />
        </section>
      </div>

      {/* Adsterra Native Banner */}
      <AdBanner />

      {/* Grid feed for all remaining mixed articles */}
      {remainingArticles.length > 0 && (
        <div className="mt-6 mb-10 border-t border-white/5 pt-8 text-center">
          <div className="flex flex-col items-center mb-10">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 border border-primary/20 rounded-full px-3 py-1">
                Najnovšie
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-3 text-center">Všetky články</h2>
            <p className="text-muted-foreground/60 text-sm">Kompletný prehľad správ zoradený podľa času pridania</p>
          </div>

          <LoadMoreGrid articles={remainingArticles} />
        </div>
      )}
    </div>
  );
}
