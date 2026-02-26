import { supabase } from "./supabase";
import { unstable_noStore as noStore } from 'next/cache';

export interface Article {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    main_image: string;
    category: string;
    published_at: string;
    source_url: string;
    ai_summary: string;
    status: 'draft' | 'published';
}

export const CATEGORY_MAP: Record<string, string> = {
    "ai": "Umelá Inteligencia",
    "tech": "Tech",
    "biznis": "Biznis",
    "krypto": "Krypto",
    "svet": "Svet",
    "politika": "Politika",
    "veda": "Veda",
    "navody": "Návody & Tipy",
    "gaming": "Gaming",
    "novinky": "Novinky SK/CZ"
};

export async function getLatestArticle(): Promise<Article | null> {
    noStore();
    const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error("Error fetching latest article:", error);
        return null;
    }
    return data as Article;
}

export async function getRecentArticles(excludeId?: string): Promise<Article[]> {
    noStore();
    let query = supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(50);

    if (excludeId) {
        query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching recent articles:", error);
        return [];
    }
    return data as Article[];
}

export async function getArticleBySlug(slug: string, includeDrafts: boolean = false): Promise<Article | null> {
    noStore();
    let query = supabase
        .from('articles')
        .select('*')
        .eq('slug', slug);

    if (!includeDrafts) {
        query = query.eq('status', 'published');
    }

    const { data, error } = await query.single();

    if (error) {
        console.error("Error fetching article by slug:", error);
        return null;
    }
    return data as Article;
}

export async function getArticlesByCategory(slug: string): Promise<Article[]> {
    noStore();
    const dbCategoryName = CATEGORY_MAP[slug.toLowerCase()] || (slug.charAt(0).toUpperCase() + slug.slice(1).toLowerCase());

    const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .eq('category', dbCategoryName)
        .order('published_at', { ascending: false });

    if (error) {
        console.error(`Error fetching articles for category ${slug}:`, error);
        return [];
    }
    return data as Article[];
}
