import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "make-com-webhook-secret";

export async function GET(req: Request) {
    try {
        const { data: existingSources, error: fetchError } = await supabase
            .from('discovery_sources')
            .select('*')
            .order('name', { ascending: true });

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
                { name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml", category: "AI" },
                { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", category: "AI" },
                { name: "Wired AI", url: "https://www.wired.com/feed/category/ai/latest/rss", category: "AI" },
                { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", category: "AI" },
                { name: "AI News", url: "https://www.artificialintelligence-news.com/feed/", category: "AI" },
                { name: "MIT Tech Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/", category: "AI" },
                { name: "Futurism AI", url: "https://futurism.com/feed", category: "AI" },
                { name: "Import AI", url: "https://jack-clark.net/feed/", category: "AI" },
                { name: "The Batch (DeepLearning.AI)", url: "https://www.deeplearning.ai/the-batch/feed/", category: "AI" },
                { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml", category: "AI" },
                { name: "Google DeepMind", url: "https://deepmind.google/blog/rss/", category: "AI" },
                { name: "Ars Technica AI", url: "https://arstechnica.com/ai/feed/", category: "AI" },
                { name: "TLDR AI", url: "https://tldr.tech/ai/rss", category: "AI" },
                { name: "The Rundown AI", url: "https://www.therundown.ai/rss", category: "AI" },
                // Tech
                { name: "Engadget", url: "https://www.engadget.com/rss.xml", category: "Tech" },
                { name: "Ars Technica", url: "https://feeds.feedburner.com/arstechnica/index", category: "Tech" },
                { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Tech" },
                { name: "The Next Web", url: "https://thenextweb.com/feed", category: "Tech" },
                { name: "Gizmodo", url: "https://gizmodo.com/rss", category: "Tech" },
                { name: "9to5Mac", url: "https://9to5mac.com/feed", category: "Tech" },
                { name: "9to5Google", url: "https://9to5google.com/feed", category: "Tech" },
                { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Tech" },
                // Návody
                { name: "How-To Geek AI", url: "https://www.howtogeek.com/feed/", category: "Návody & Tipy" },
                { name: "MakeUseOf AI", url: "https://www.makeuseof.com/category/artificial-intelligence/feed/", category: "Návody & Tipy" },
                { name: "Zapier Blog", url: "https://zapier.com/blog/feeds/latest/", category: "Návody & Tipy" },
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
