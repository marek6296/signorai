
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishToFacebook, publishToInstagram } from "@/lib/meta-api";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_SECRET = process.env.ADMIN_SECRET || "make-com-webhook-secret";

export async function POST(req: Request) {
    try {
        const { id, secret, imageUrl: customImageUrl } = await req.json();

        // 1. Auth check
        if (secret !== ADMIN_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Fetch the post and article data
        const { data: post, error: postError } = await supabase
            .from("social_posts")
            .select(`
                *,
                articles (
                    title,
                    slug,
                    main_image,
                    excerpt
                )
            `)
            .eq("id", id)
            .single();

        if (postError || !post) {
            throw new Error(`Social post not found: ${id}`);
        }

        if (post.status === 'posted') {
            return NextResponse.json({ message: "Post already published" });
        }

        const article = post.articles;
        const articleUrl = `https://postovinky.news/article/${article?.slug}`;

        // Final image determination: 
        // 1. If customImageUrl provided in request, use it.
        // 2. Otherwise, for Instagram, use our brand generator.
        let imageUrl = customImageUrl || article?.main_image;

        if (post.platform === 'Instagram' && !customImageUrl) {
            // Generate our branded social image URL
            const protocol = req.headers.get("x-forwarded-proto") || "http";
            const host = req.headers.get("host");
            imageUrl = `${protocol}://${host}/api/social-image?title=${encodeURIComponent(article?.title || 'Novinky zo sveta AI')}`;
        }

        // 3. Publish based on platform
        let result;
        if (post.platform === 'Facebook') {
            result = await publishToFacebook(post.content, articleUrl);
        } else if (post.platform === 'Instagram') {
            if (!imageUrl) throw new Error("Instagram requires an image.");
            result = await publishToInstagram(imageUrl, post.content);
        } else if (post.platform === 'X') {
            // Placeholder for X (Twitter) API
            // For now, we skip but mark as done if user wants just automation for FB/IG
            console.log("X (Twitter) publishing not implemented yet.");
            throw new Error("X (Twitter) API for automated publishing is not configured yet.");
        } else {
            throw new Error(`Unsupported platform: ${post.platform}`);
        }

        // 4. Update status in DB
        const { error: updateError } = await supabase
            .from("social_posts")
            .update({
                status: 'posted',
                posted_at: new Date().toISOString()
            })
            .eq("id", id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, result });

    } catch (error: unknown) {
        console.error("Publishing Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
