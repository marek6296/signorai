import { MetadataRoute } from 'next';
import { getAllArticlesForSitemap, CATEGORY_MAP } from '@/lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://postovinky.news';

    // Static pages
    const staticPages = [
        '',
        '/o-nas',
        '/kontakt',
        '/ochrana-sukromia',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Array().includes(route) ? new Date() : new Date('2026-02-26'),
    }));

    // Category pages
    const categoryPages = Object.keys(CATEGORY_MAP).map((slug) => ({
        url: `${baseUrl}/kategoria/${slug}`,
        lastModified: new Date(),
    }));

    // Article pages
    const articles = await getAllArticlesForSitemap();
    const articlePages = articles.map((article) => ({
        url: `${baseUrl}/article/${article.slug}`,
        lastModified: new Date(article.published_at),
    }));

    return [...staticPages, ...categoryPages, ...articlePages];
}
