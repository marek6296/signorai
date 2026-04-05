import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "make-com-webhook-secret";

export async function GET(req: Request) {
    try {
        const { data: existingSources, error: fetchError } = await supabase
            .from('discovery_sources')
            .select('*')
            .order('source_name', { ascending: true });

        if (fetchError) {
            // Check if table doesn't exist
            if (fetchError.code === 'PGRST116' || fetchError.code === '42P01') {
                return NextResponse.json({ sources: [], needsMigration: true });
            }
            throw fetchError;
        }

        // If table is empty, seed it with defaults
        if (existingSources.length === 0) {
            const defaults = [
                // AI
                { source_name: "The Verge AI", feed_url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml", category: "AI" },
                { source_name: "TechCrunch AI", feed_url: "https://techcrunch.com/category/artificial-intelligence/feed/", category: "AI" },
                { source_name: "Wired AI", feed_url: "https://www.wired.com/feed/category/ai/latest/rss", category: "AI" },
                { source_name: "VentureBeat AI", feed_url: "https://venturebeat.com/category/ai/feed/", category: "AI" },
                { source_name: "AI News", feed_url: "https://www.artificialintelligence-news.com/feed/", category: "AI" },
                { source_name: "MIT Tech Review AI", feed_url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/", category: "AI" },
                { source_name: "Futurism AI", feed_url: "https://futurism.com/feed", category: "AI" },
                { source_name: "Import AI", feed_url: "https://jack-clark.net/feed/", category: "AI" },
                { source_name: "The Batch (DeepLearning.AI)", feed_url: "https://www.deeplearning.ai/the-batch/feed/", category: "AI" },
                { source_name: "Hugging Face Blog", feed_url: "https://huggingface.co/blog/feed.xml", category: "AI" },
                { source_name: "Google DeepMind", feed_url: "https://deepmind.google/blog/rss/", category: "AI" },
                { source_name: "Ars Technica AI", feed_url: "https://arstechnica.com/ai/feed/", category: "AI" },
                { source_name: "TLDR AI", feed_url: "https://tldr.tech/ai/rss", category: "AI" },
                { source_name: "The Rundown AI", feed_url: "https://www.therundown.ai/rss", category: "AI" },
                // Tech
                { source_name: "Engadget", feed_url: "https://www.engadget.com/rss.xml", category: "Tech" },
                { source_name: "Ars Technica", feed_url: "https://feeds.feedburner.com/arstechnica/index", category: "Tech" },
                { source_name: "The Verge", feed_url: "https://www.theverge.com/rss/index.xml", category: "Tech" },
                { source_name: "The Next Web", feed_url: "https://thenextweb.com/feed", category: "Tech" },
                { source_name: "Gizmodo", feed_url: "https://gizmodo.com/rss", category: "Tech" },
                { source_name: "9to5Mac", feed_url: "https://9to5mac.com/feed", category: "Tech" },
                { source_name: "9to5Google", feed_url: "https://9to5google.com/feed", category: "Tech" },
                { source_name: "TechCrunch", feed_url: "https://techcrunch.com/feed/", category: "Tech" },
                // Návody
                { source_name: "How-To Geek AI", feed_url: "https://www.howtogeek.com/feed/", category: "Návody & Tipy" },
                { source_name: "MakeUseOf AI", feed_url: "https://www.makeuseof.com/category/artificial-intelligence/feed/", category: "Návody & Tipy" },
                { source_name: "Zapier Blog", feed_url: "https://zapier.com/blog/feeds/latest/", category: "Návody & Tipy" },
            ];

            const { data: seeded, error: insertError } = await supabase
                .from('discovery_sources')
                .insert(defaults)
                .select();

            if (!insertError) return NextResponse.json({ sources: seeded || [] });
        }

        return NextResponse.json({ sources: existingSources });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { secret, source } = body;

        if (secret !== ADMIN_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('discovery_sources')
            .insert([source])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ source: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { secret, id, updates } = await req.json();

        if (secret !== ADMIN_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('discovery_sources')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ source: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        const secret = url.searchParams.get("secret");

        if (secret !== ADMIN_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { error } = await supabase
            .from('discovery_sources')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
