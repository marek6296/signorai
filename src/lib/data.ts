import { supabase } from "./supabase";

export type Category = "Domov" | "Svet" | "Tech" | "Lifestyle";

export interface Article {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    main_image: string;
    category: Category;
    published_at: string;
    source_url: string;
    ai_summary: string;
    status: 'draft' | 'published';
}

export async function getLatestArticle(): Promise<Article | null> {
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

export async function getArticleBySlug(slug: string): Promise<Article | null> {
    const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .eq('slug', slug)
        .single();

    if (error) {
        console.error("Error fetching article by slug:", error);
        return null;
    }
    return data as Article;
}

export async function getArticlesByCategory(category: string): Promise<Article[]> {
    const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();

    const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .eq('category', formattedCategory)
        .order('published_at', { ascending: false });

    if (error) {
        console.error(`Error fetching articles for category ${category}:`, error);
        return [];
    }
    return data as Article[];
}
