
/**
 * Utility for publishing to Facebook and Instagram via Meta Graph API
 */

import { createClient } from "@supabase/supabase-js";

// Initialize internal supabase client for config fetching
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Fetches the latest Meta configuration from Supabase site_settings.
 * Falls back to environment variables.
 */
async function getMetaConfig() {
    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'meta_config')
            .single();

        if (!error && data?.value) {
            const val = data.value as any;
            return {
                FB_PAGE_ID: val.page_id || process.env.FB_PAGE_ID,
                IG_BUSINESS_ACCOUNT_ID: val.ig_id || process.env.IG_BUSINESS_ACCOUNT_ID,
                META_ACCESS_TOKEN: val.access_token || process.env.META_ACCESS_TOKEN
            };
        }
    } catch (e) {
        console.warn("[Meta API] Error fetching dynamic config, falling back to ENV:", e);
    }

    return {
        FB_PAGE_ID: process.env.FB_PAGE_ID,
        IG_BUSINESS_ACCOUNT_ID: process.env.IG_BUSINESS_ACCOUNT_ID,
        META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN
    };
}

/**
 * Exchanges a User Access Token for a Page Access Token for the specified page.
 */
export async function getPageAccessToken(pageId: string, userToken: string): Promise<string> {
    try {
        const url = `https://graph.facebook.com/v22.0/${pageId}?fields=access_token&access_token=${userToken}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.access_token) {
            return data.access_token;
        }
        return userToken;
    } catch (e) {
        console.warn("[Meta API] Error exchanging for Page Access Token, using User Token:", e);
        return userToken;
    }
}

export async function publishToFacebook(message: string, link?: string, imageUrl?: string) {
    const { FB_PAGE_ID, META_ACCESS_TOKEN } = await getMetaConfig();
    if (!FB_PAGE_ID || !META_ACCESS_TOKEN) {
        throw new Error("Missing Facebook configuration (FB_PAGE_ID or META_ACCESS_TOKEN)");
    }

    // Exchange for Page Token
    const pageToken = await getPageAccessToken(FB_PAGE_ID, META_ACCESS_TOKEN);
    console.log(`[Meta API] Final Article URL: ${link}`);

    if (imageUrl) {
        // ── Two-step: upload unpublished photo → create feed post with attached_media ──
        // This creates a proper timeline feed post (not a "photo" album post).

        // Step 1: Upload photo as unpublished
        console.log(`[Meta API] Publishing to Facebook (Feed + image, step 1: upload photo)...`);
        const photoParams = new URLSearchParams({
            url: imageUrl,
            published: 'false',
            access_token: pageToken,
        });
        const photoRes = await fetch(
            `https://graph.facebook.com/v22.0/${FB_PAGE_ID}/photos`,
            { method: "POST", body: photoParams }
        );
        const photoData = await photoRes.json();
        if (!photoRes.ok) {
            throw new Error(photoData.error?.message || "Failed to upload photo to Facebook");
        }
        const photoId = photoData.id;
        console.log(`[Meta API] Unpublished photo uploaded: ${photoId}`);

        // Step 2: Create feed post with attached photo + link preview
        console.log(`[Meta API] Publishing to Facebook (Feed + image, step 2: create feed post)...`);
        const feedParams: Record<string, string> = {
            message,
            attached_media: JSON.stringify([{ media_fbid: photoId }]),
            access_token: pageToken,
        };
        if (link) {
            // link creates a proper link-preview card below the image
            feedParams.link = link;
        }

        let lastError: string | null = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            const feedRes = await fetch(
                `https://graph.facebook.com/v22.0/${FB_PAGE_ID}/feed`,
                { method: "POST", body: new URLSearchParams(feedParams) }
            );
            const feedData = await feedRes.json();
            if (feedRes.ok) {
                console.log(`[Meta API] Facebook feed+image post — id: ${feedData.id}`);
                // Normalise to the same shape consumers expect ({id, post_id})
                return { id: feedData.id, post_id: feedData.id };
            }
            lastError = feedData.error?.message || "Failed to create Facebook feed post";
            console.warn(`[Meta API] Facebook feed attempt ${attempt} failed: ${lastError}`);
            if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
        }
        throw new Error(lastError || "Failed to create Facebook feed post");
    } else {
        // ── Text / link-only post ─────────────────────────────────────────────────
        // Use `link` param so Facebook creates a proper link-preview card (image + title).
        // Message must NOT contain the URL — it goes only in `link`.
        const params: Record<string, string> = {
            message,
            access_token: pageToken,
        };
        if (link) {
            params.link = link;
        }

        console.log(`[Meta API] Publishing to Facebook (Feed text/link)...`);
        const body = new URLSearchParams(params);

        let lastError: string | null = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            const response = await fetch(
                `https://graph.facebook.com/v22.0/${FB_PAGE_ID}/feed`,
                { method: "POST", body }
            );
            const data = await response.json();
            if (response.ok) {
                console.log(`[Meta API] Facebook feed post — id: ${data.id}`);
                return data;
            }
            lastError = data.error?.message || "Failed to post to Facebook";
            console.warn(`[Meta API] Facebook attempt ${attempt} failed: ${lastError}`);
            if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
        }
        throw new Error(lastError || "Failed to post to Facebook");
    }
}

export async function publishToInstagram(imageUrl: string, caption: string) {
    const { IG_BUSINESS_ACCOUNT_ID, META_ACCESS_TOKEN } = await getMetaConfig();
    if (!IG_BUSINESS_ACCOUNT_ID || !META_ACCESS_TOKEN) {
        throw new Error("Missing Instagram configuration (IG_BUSINESS_ACCOUNT_ID or META_ACCESS_TOKEN)");
    }

    console.log(`[Meta API] Starting Instagram publish with image: ${imageUrl.substring(0, 50)}...`);

    // 1. Create Media Container
    const containerUrl = `https://graph.facebook.com/v22.0/${IG_BUSINESS_ACCOUNT_ID}/media`;
    const containerParams = new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: META_ACCESS_TOKEN,
    });

    const containerResponse = await fetch(`${containerUrl}?${containerParams.toString()}`, { method: "POST" });
    const containerData = await containerResponse.json();
    if (!containerResponse.ok) {
        console.error("Instagram Container Error:", containerData);
        throw new Error(containerData.error?.message || "Failed to create Instagram media container");
    }

    const creationId = containerData.id;
    if (!creationId) throw new Error("Meta API did not return a Media ID.");

    console.log(`[Meta API] Media container created: ${creationId}. Waiting for processing...`);
    // Wait longer for Instagram to process the image — 4 seconds is safer for background/cron execution
    await new Promise(r => setTimeout(r, 4000));

    // 2. Publish Media Container
    const publishUrl = `https://graph.facebook.com/v22.0/${IG_BUSINESS_ACCOUNT_ID}/media_publish`;
    const publishParams = new URLSearchParams({ creation_id: creationId, access_token: META_ACCESS_TOKEN });

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        const publishResponse = await fetch(`${publishUrl}?${publishParams.toString()}`, { method: "POST" });
        const publishData = await publishResponse.json();
        if (publishResponse.ok) {
            console.log(`[Meta API] Instagram post published successfully: ${publishData.id}`);
            return publishData;
        }
        lastError = publishData.error?.message || "Unknown error during publish";
        console.warn(`[Meta API] Instagram publish attempt ${attempt} failed: ${lastError}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000));
    }
    throw new Error(`Failed to publish Instagram media after retries: ${lastError}`);
}

/**
 * Comments on a specific Facebook object (Post, Photo, etc.)
 */
export async function commentOnFacebook(objectId: string, message: string) {
    const { FB_PAGE_ID, META_ACCESS_TOKEN } = await getMetaConfig();
    if (!META_ACCESS_TOKEN || !FB_PAGE_ID) throw new Error("Missing access token or Page ID for commenting");

    const pageToken = await getPageAccessToken(FB_PAGE_ID, META_ACCESS_TOKEN);
    const url = `https://graph.facebook.com/v22.0/${objectId}/comments`;
    const body = new URLSearchParams({ message, access_token: pageToken });

    const response = await fetch(url, { method: "POST", body });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error?.message || "Failed to comment on Facebook");
    return data;
}

/**
 * Comments on a specific Instagram Media object
 */
export async function commentOnInstagram(mediaId: string, message: string) {
    const { META_ACCESS_TOKEN } = await getMetaConfig();
    if (!META_ACCESS_TOKEN) throw new Error("Missing access token for commenting");

    const url = `https://graph.facebook.com/v22.0/${mediaId}/comments`;
    const body = new URLSearchParams({ message, access_token: META_ACCESS_TOKEN });

    const response = await fetch(url, { method: "POST", body });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error?.message || "Failed to comment on Instagram");
    return data;
}

/**
 * Deletes a post or comment from Facebook
 */
export async function deleteFromFacebook(objectId: string) {
    const { FB_PAGE_ID, META_ACCESS_TOKEN } = await getMetaConfig();
    if (!META_ACCESS_TOKEN || !FB_PAGE_ID) throw new Error("Missing access token or Page ID for deletion");

    const pageToken = await getPageAccessToken(FB_PAGE_ID, META_ACCESS_TOKEN);
    const url = `https://graph.facebook.com/v22.0/${objectId}`;
    const params = new URLSearchParams({ access_token: pageToken });

    const response = await fetch(`${url}?${params.toString()}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error?.message || "Failed to delete from Facebook");
    return data;
}

/**
 * Deletes a comment from Instagram
 */
export async function deleteInstagramComment(commentId: string) {
    const { META_ACCESS_TOKEN } = await getMetaConfig();
    if (!META_ACCESS_TOKEN) throw new Error("Missing access token for deletion");

    const url = `https://graph.facebook.com/v22.0/${commentId}`;
    const params = new URLSearchParams({ access_token: META_ACCESS_TOKEN });

    const response = await fetch(`${url}?${params.toString()}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error?.message || "Failed to delete Instagram comment");
    return data;
}
