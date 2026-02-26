import { MetadataRoute } from 'next';
import { getAllArticlesForSitemap, CATEGORY_MAP } from '@/lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://postovinky.news';

    const staticRoutes: { route: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly' }[] = [
        { route: '', priority: 1, changeFrequency: 'daily' },
        { route: '/o-nas', priority: 0.6, changeFrequency: 'monthly' },
        { route: '/kontakt', priority: 0.6, changeFrequency: 'monthly' },
        { route: '/ochrana-sukromia', priority: 0.4, changeFrequency: 'yearly' },
        { route: '/newsletter', priority: 0.7, changeFrequency: 'monthly' },
    ];

    const staticPages: MetadataRoute.Sitemap = staticRoutes.map(({ route, priority, changeFrequency }) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency,
        priority,
    }));

    const categoryPages: MetadataRoute.Sitemap = Object.keys(CATEGORY_MAP).map((slug) => ({
        url: `${baseUrl}/kategoria/${slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
    }));

    const articles = await getAllArticlesForSitemap();
    const articlePages: MetadataRoute.Sitemap = articles.map((article) => ({
        url: `${baseUrl}/article/${article.slug}`,
        lastModified: new Date(article.published_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
    }));

    return [...staticPages, ...categoryPages, ...articlePages];
}
