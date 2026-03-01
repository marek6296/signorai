import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
    try {
        const { data: posts, error } = await supabase
            .from("social_posts")
            .select(`
                *,
                articles (
                    title,
                    slug,
                    category,
                    main_image
                )
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return NextResponse.json(posts);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const posts = await req.json();
        const { data, error } = await supabase
            .from("social_posts")
            .insert(posts)
            .select();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const { id, ...updates } = await req.json();

        if (updates.status === 'posted' && !updates.posted_at) {
            updates.posted_at = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from("social_posts")
            .update(updates)
            .eq("id", id)
            .select();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { id } = await req.json();
        const { error } = await supabase
            .from("social_posts")
            .delete()
            .eq("id", id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
