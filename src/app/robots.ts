import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] },
            { userAgent: 'Googlebot', allow: '/', disallow: ['/admin', '/api'] },
        ],
        host: 'https://aiwai.news',
        sitemap: 'https://aiwai.news/sitemap.xml',
    };
}
