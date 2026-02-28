
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

        let finalImageUrl = customImageUrl || article?.main_image;

        if (post.platform === 'Instagram' && !customImageUrl) {
            try {
                // Hardcode prod hostname for Meta's convenience
                const generatorUrl = `https://postovinky.news/api/social-image/${id}.png?t=${Date.now()}`;

                console.log(`[Instagram Storage] Fetching image from: ${generatorUrl}`);

                // Give the generator 1 second to breathe if it was just deployed
                await new Promise(r => setTimeout(r, 1000));

                // Step A: Fetch the image bytes from our own generator
                const imageRes = await fetch(generatorUrl);

                if (!imageRes.ok) {
                    throw new Error(`Generator returned status ${imageRes.status}`);
                }

                const imageBuffer = await imageRes.arrayBuffer();

                if (imageBuffer.byteLength < 1000) {
                    throw new Error(`Generator returned 0 bytes or suspiciously small file: ${imageBuffer.byteLength} bytes.`);
                }

                // Step B: Upload to Supabase Storage
                const fileName = `${id}-${Date.now()}.png`;
                const { error: uploadError } = await supabase.storage
                    .from("social-images")
                    .upload(fileName, imageBuffer, {
                        contentType: 'image/png',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                // Step C: Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from("social-images")
                    .getPublicUrl(fileName);

                finalImageUrl = publicUrl;
                console.log(`[Instagram Storage] Successfully uploaded and using brand image: ${finalImageUrl}`);

            } catch (storageError) {
                console.error("[Instagram Storage Error - Fallback triggered]", storageError);
                // Last resort fallback
                finalImageUrl = article?.main_image || finalImageUrl;
            }
        }

        // 3. Publish based on platform
        let result;
        if (post.platform === 'Facebook') {
            result = await publishToFacebook(post.content, articleUrl);
        } else if (post.platform === 'Instagram') {
            if (!finalImageUrl) throw new Error("Instagram requires an image.");
            result = await publishToInstagram(finalImageUrl, post.content);
        } else if (post.platform === 'X') {
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
