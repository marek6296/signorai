
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishToFacebook, publishToInstagram } from "@/lib/meta-api";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);



export async function POST(req: Request) {
    try {
        const contentType = req.headers.get("content-type") || "";
        let id: string, secret: string, customImageUrl: string | undefined, uploadedFile: File | null = null;

        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            id = formData.get("id") as string;
            secret = formData.get("secret") as string;
            uploadedFile = formData.get("image") as File;
        } else {
            const body = await req.json();
            id = body.id;
            secret = body.secret;
            customImageUrl = body.imageUrl;
        }

        // 1. Auth check
        if (secret !== process.env.ADMIN_SECRET && secret !== "make-com-webhook-secret") {
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

        // NEW: Handle direct image upload from client (bit-perfect preview)
        if (uploadedFile) {
            try {
                const imageBuffer = Buffer.from(await uploadedFile.arrayBuffer());
                const fileName = `direct-${id}-${Date.now()}.png`;

                console.log(`[Instagram Direct Upload] Size: ${imageBuffer.byteLength} bytes`);

                const { error: uploadError } = await supabase.storage
                    .from("social-images")
                    .upload(fileName, imageBuffer, {
                        contentType: 'image/png',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from("social-images")
                    .getPublicUrl(fileName);

                finalImageUrl = publicUrl;
                console.log(`[Instagram Direct Upload] Success: ${finalImageUrl}`);

                // Give Supabase Storage a moment to ensure the file is publicly available for Meta's crawlers
                await new Promise(r => setTimeout(r, 2000));
            } catch (err) {
                console.error("[Instagram Direct Upload Failed]", err);
            }
        }
        // Fallback: Use server-side generator if no direct upload or it failed
        else if (post.platform === 'Instagram' && !customImageUrl) {
            try {
                const generatorUrl = `https://postovinky.news/api/social-image/${id}.png?t=${Date.now()}`;
                console.log(`[Instagram Storage Fallback] Using generator: ${generatorUrl}`);

                await new Promise(r => setTimeout(r, 1000));
                const imageRes = await fetch(generatorUrl);

                if (imageRes.ok) {
                    const imageBuffer = await imageRes.arrayBuffer();
                    if (imageBuffer.byteLength > 1000) {
                        const fileName = `fallback-${id}-${Date.now()}.png`;
                        const { error: uploadError } = await supabase.storage
                            .from("social-images")
                            .upload(fileName, imageBuffer, {
                                contentType: 'image/png',
                                upsert: true
                            });

                        if (!uploadError) {
                            const { data: { publicUrl } } = supabase.storage
                                .from("social-images")
                                .getPublicUrl(fileName);
                            finalImageUrl = publicUrl;
                        }
                    }
                }
            } catch (storageError) {
                console.error("[Instagram Storage Fallback Error]", storageError);
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
