import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/admin', '/api', '/_next', '/search?'],
            },
            {
                userAgent: 'Googlebot',
                allow: '/',
                disallow: ['/admin', '/api'],
            },
            {
                userAgent: 'Bingbot',
                allow: '/',
                disallow: ['/admin', '/api'],
            },
        ],
        host: 'https://aiwai.news',
        sitemap: 'https://aiwai.news/sitemap.xml',
    };
}
