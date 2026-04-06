
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishToFacebook, publishToInstagram, commentOnFacebook, getPageAccessToken } from "@/lib/meta-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);



export async function POST(req: Request) {
    try {
        const contentType = req.headers.get("content-type") || "";
        let id: string, secret: string, customImageUrl: string | undefined;
        let imageVariant: string = 'studio'; // default

        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            id = formData.get("id") as string;
            secret = formData.get("secret") as string;
            imageVariant = (formData.get("variant") as string) || 'studio';
            // image blob from formData is ignored for Instagram — we use server-side Satori instead
            // (but we now forward the variant so the server renders the correct style)
        } else {
            const body = await req.json();
            id = body.id;
            secret = body.secret;
            customImageUrl = body.imageUrl;
            imageVariant = body.variant || 'studio';
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
        if (!article?.slug) {
            throw new Error(`Article slug missing for social post ${id} — cannot build valid URL`);
        }
        // ALWAYS use production URL — localhost/Vercel preview URLs break Facebook OG scraping
        const articleUrl = `https://aiwai.news/article/${article.slug}`;

        let finalImageUrl = customImageUrl || post.image_url || article?.main_image;

        // For Instagram, we ALWAYS want to use the server-side Satori image (not browser screenshots)
        // to ensure 100% pixel-perfect matching across all bots, automations, and manual clicks.
        if (post.platform === 'Instagram') {
            try {
                const headerHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "aiwai.news";
                const protocol = headerHost.includes("localhost") ? "http" : "https";
                const preRenderEndpoint = `${protocol}://${headerHost}/api/admin/pre-render-social-image`;

                console.log(`[Instagram Satori Vizuál] Forcing fresh server-side generation (variant: ${imageVariant})...`);
                const res = await fetch(preRenderEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: post.id, variant: imageVariant })
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

        let result;
        if (post.platform === 'Facebook') {
            // ── Step 1: Get the Satori image (same as Instagram) ─────────────────
            // Look for the Instagram post for the same article and reuse its pre-rendered image
            let fbImageUrl: string | undefined;

            const { data: igPost } = await supabase
                .from("social_posts")
                .select("image_url")
                .eq("article_id", post.article_id)
                .eq("platform", "Instagram")
                .not("image_url", "is", null)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (igPost?.image_url) {
                fbImageUrl = igPost.image_url;
                console.log(`[Facebook] Reusing Instagram Satori image: ${fbImageUrl}`);
            } else {
                // Fallback: generate the image fresh via pre-render endpoint
                try {
                    const headerHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "aiwai.news";
                    const protocol = headerHost.includes("localhost") ? "http" : "https";
                    const preRenderRes = await fetch(`${protocol}://${headerHost}/api/admin/pre-render-social-image`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: post.id, variant: imageVariant }),
                    });
                    if (preRenderRes.ok) {
                        const preRenderData = await preRenderRes.json();
                        fbImageUrl = preRenderData.url;
                        console.log(`[Facebook] Fresh Satori image generated: ${fbImageUrl}`);
                    }
                } catch (e) {
                    console.warn("[Facebook] Image generation failed, posting without image:", e);
                }
            }

            // ── Step 2: Post photo + text to Facebook ─────────────────────────────
            const finalMessage = `${post.content || ""}\n\nČlánok nájdete tu: ${articleUrl}`;
            result = await publishToFacebook(finalMessage, undefined, fbImageUrl);
            // When posting a photo, FB returns { id: photo_id, post_id: "PAGE_ID_POST_ID" }
            // We MUST comment on post_id (the timeline post), not on id (the photo object)
            console.log(`[Facebook] Photo post raw response — id: ${result?.id}, post_id: ${result?.post_id}`);

            let fbPostId: string | undefined = result?.post_id;

            // Fallback: if post_id was not returned, fetch it from the photo object via Graph API
            if (!fbPostId && result?.id) {
                try {
                    // Get meta config from Supabase (to exchange for Page Token)
                    const { data: settingsRow } = await supabase
                        .from('site_settings')
                        .select('value')
                        .eq('key', 'meta_config')
                        .single();
                    const val = settingsRow?.value as any;
                    const metaToken = val?.access_token || process.env.META_ACCESS_TOKEN;
                    const fbPageId = val?.page_id || process.env.FB_PAGE_ID;

                    // Get a real Page Access Token to perform the lookup
                    const pageToken = await getPageAccessToken(fbPageId, metaToken);

                    const photoFieldsRes = await fetch(
                        `https://graph.facebook.com/v22.0/${result.id}?fields=post_id&access_token=${pageToken}`
                    );
                    const photoFields = await photoFieldsRes.json();
                    if (photoFields?.post_id) {
                        fbPostId = photoFields.post_id;
                        console.log(`[Facebook] Recovered post_id from photo object: ${fbPostId}`);
                    } else {
                        console.warn(`[Facebook] Could not recover post_id — fallback to photo id. API said: ${JSON.stringify(photoFields)}`);
                        fbPostId = result.id;
                    }
                } catch (lookupErr) {
                    console.warn("[Facebook] post_id lookup failed, using photo id:", lookupErr);
                    fbPostId = result.id;
                }
            }

            // ── Step 3: Add article link as first comment ──────────────────────────
            if (fbPostId) {
                try {
                    await commentOnFacebook(fbPostId, articleUrl);
                    console.log(`[Facebook] ✓ Link comment added to post ${fbPostId}: ${articleUrl}`);
                } catch (commentErr) {
                    console.error("[Facebook] Comment with link failed:", commentErr);
                    // Non-fatal — post is published even without comment
                }
            } else {
                console.warn("[Facebook] No post_id recovered — cannot add comment");
            }
        } else if (post.platform === 'Instagram') {
            // Instagram ideally needs a 1:1 image, but let's allow the publish attempt even if pre-render failed
            // Meta API will validate aspect ratio and reject if too far off
            if (!finalImageUrl) {
                finalImageUrl = article?.main_image || "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200";
                console.warn(`[Instagram] ⚠️ Using fallback image: ${finalImageUrl.substring(0, 60)}...`);
            }
            console.log(`[Instagram] Publishing with image: ${finalImageUrl.substring(0, 60)}...`);
            result = await publishToInstagram(finalImageUrl, post.content);
        } else if (post.platform === 'X') {
            console.log("X (Twitter) publishing not implemented yet.");
            throw new Error("X (Twitter) API for automated publishing is not configured yet.");
        } else {
            throw new Error(`Unsupported platform: ${post.platform}`);
        }

        // 4. Update status and external ID in DB
        const externalId = result?.id || result?.post_id;
        const { error: updateError } = await supabase
            .from("social_posts")
            .update({
                status: 'posted',
                posted_at: new Date().toISOString(),
                external_id: externalId
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
