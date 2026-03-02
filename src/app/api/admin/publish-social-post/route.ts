
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
        let id: string, secret: string, customImageUrl: string | undefined;

        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            id = formData.get("id") as string;
            secret = formData.get("secret") as string;
            // image from formData is deliberately ignored for Instagram to force Satori pre-render
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

        let finalImageUrl = customImageUrl || post.image_url || article?.main_image;

        // For Instagram, we ALWAYS want to use the server-side Satori image (not browser screenshots)
        // to ensure 100% pixel-perfect matching across all bots, automations, and manual clicks.
        if (post.platform === 'Instagram') {
            try {
                const headerHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "postovinky.news";
                const protocol = headerHost.includes("localhost") ? "http" : "https";
                const preRenderEndpoint = `${protocol}://${headerHost}/api/admin/pre-render-social-image`;

                console.log(`[Instagram Satori Vizuál] Forcing fresh server-side generation...`);
                const res = await fetch(preRenderEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: post.id })
                });

                if (res.ok) {
                    const dat = await res.json();
                    if (dat.url) {
                        finalImageUrl = dat.url;
                        console.log(`[Instagram Satori Vizuál] Success, using exact URL: ${finalImageUrl}`);
                        // The pre-render endpoint already waited 4s, but we'll add 2s extra buffer 
                        await new Promise(r => setTimeout(r, 2000));
                    }
                } else {
                    console.warn(`[Instagram Satori Vizuál] Failed, using cached or fallback.`);
                }
            } catch (err) {
                console.error("[Instagram Satori Vizuál Error]", err);
                finalImageUrl = post.image_url || article?.main_image || customImageUrl;
            }
        }

        // 3. Publish based on platform
        let result;
        if (post.platform === 'Facebook') {
            // Pre Facebook chceme čistý Link Post (aby si FB sám stiahol obrázok z webu)
            // Posielame aj explicitný link, aby FB vygeneroval poriadny náhľad (preview card)
            result = await publishToFacebook(post.content, articleUrl);
        } else if (post.platform === 'Instagram') {
            // Instagram MUST have our generated 1:1 image to avoid aspect ratio errors
            if (!finalImageUrl || (finalImageUrl === article?.main_image)) {
                console.warn(`[Instagram] Warning: Aspect ratio might be rejected due to original image usage.`);
                throw new Error("Instagram requires a 1:1 image. Generator fallback failed.");
            }
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
