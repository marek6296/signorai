import { MetadataRoute } from 'next';
import { getAllArticlesForSitemap, CATEGORY_MAP } from '@/lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://aiwai.news';
    const now = new Date();

    // Threshold: articles newer than 7 days get higher priority
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const staticRoutes: { route: string; priority: number; changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' }[] = [
        { route: '', priority: 1.0, changeFrequency: 'hourly' },
        { route: '/newsletter', priority: 0.7, changeFrequency: 'monthly' },
        { route: '/o-nas', priority: 0.5, changeFrequency: 'monthly' },
        { route: '/kontakt', priority: 0.5, changeFrequency: 'monthly' },
        { route: '/ochrana-sukromia', priority: 0.3, changeFrequency: 'yearly' },
    ];

    const staticPages: MetadataRoute.Sitemap = staticRoutes.map(({ route, priority, changeFrequency }) => ({
        url: `${baseUrl}${route}`,
        lastModified: now,
        changeFrequency,
        priority,
    }));

    // Category pages get high priority — these are key landing pages for SEO
    const categoryPages: MetadataRoute.Sitemap = Object.keys(CATEGORY_MAP).map((slug) => ({
        url: `${baseUrl}/kategoria/${slug}`,
        lastModified: now,
        changeFrequency: 'hourly' as const,
        priority: 0.9,
    }));

    let articlePages: MetadataRoute.Sitemap = [];
    try {
        const articles = await getAllArticlesForSitemap();
        articlePages = (articles ?? []).map((article: { slug: string; published_at: string }) => {
            const pubDate = new Date(article.published_at);
            const isRecent = pubDate > sevenDaysAgo;
            return {
                url: `${baseUrl}/article/${article.slug}`,
                lastModified: pubDate,
                changeFrequency: isRecent ? 'daily' as const : 'weekly' as const,
                priority: isRecent ? 0.9 : 0.7,
            };
        });
    } catch {
        // Pri chybe (napr. chýbajúce Supabase env) vráť aspoň statické stránky
    }

    return [...staticPages, ...categoryPages, ...articlePages];
}
