
/**
 * Utility for publishing to Facebook and Instagram via Meta Graph API
 */

const FB_PAGE_ID = process.env.FB_PAGE_ID;
const IG_BUSINESS_ACCOUNT_ID = process.env.IG_BUSINESS_ACCOUNT_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

export async function publishToFacebook(message: string, link?: string, imageUrl?: string) {
    if (!FB_PAGE_ID || !META_ACCESS_TOKEN) {
        throw new Error("Missing Facebook configuration (FB_PAGE_ID or META_ACCESS_TOKEN)");
    }

    const isPhoto = !!imageUrl;
    const url = `https://graph.facebook.com/v22.0/${FB_PAGE_ID}/${isPhoto ? 'photos' : 'feed'}`;

    // Pridáme link priamo do správy (caption/message), aby bol vždy viditeľný a klikateľný v texte
    const finalMessage = link ? `${message}\n\nČítajte viac: ${link}` : message;

    const params: Record<string, string> = {
        access_token: META_ACCESS_TOKEN,
    };

    if (isPhoto) {
        params.url = imageUrl!;
        params.caption = finalMessage;
    } else {
        params.message = finalMessage;
        if (link) params.link = link;
    }

    console.log(`[Meta API] Publishing to Facebook (${isPhoto ? 'Photo' : 'Feed'})...`);

    // Používame POST body pre lepší handling dlhých správ (vyhneme sa URI limitom) / We use POST body for better handling of long messages
    const body = new URLSearchParams(params);

    // Retry logic pre Facebook
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        const response = await fetch(url, {
            method: "POST",
            body: body,
            // Header Content-Type netreba explicitne, URLSearchParams ho nastaví automaticky / URLSearchParams handles content-type automatically
        });

        const data = await response.json();
        if (response.ok) {
            console.log(`[Meta API] Facebook post successful: ${data.id || data.post_id}`);
            return data;
        }

        lastError = data.error?.message || "Failed to post to Facebook";
        console.warn(`[Meta API] Facebook attempt ${attempt} failed: ${lastError}`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }

    throw new Error(lastError);
}

export async function publishToInstagram(imageUrl: string, caption: string) {
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

    const containerResponse = await fetch(`${containerUrl}?${containerParams.toString()}`, {
        method: "POST",
    });

    const containerData = await containerResponse.json();
    if (!containerResponse.ok) {
        console.error("Instagram Container Error:", containerData);
        throw new Error(containerData.error?.message || "Failed to create Instagram media container");
    }

    const creationId = containerData.id;
    if (!creationId) {
        console.error("Instagram API returned success but no ID:", containerData);
        throw new Error("Meta API did not return a Media ID (Creation ID).");
    }

    console.log(`[Meta API] Media container created: ${creationId}. Waiting for processing...`);

    // Wait a bit for Meta to process the image from the URL (especially for new Supabase uploads)
    await new Promise(r => setTimeout(r, 2000));

    // 2. Publish Media Container
    const publishUrl = `https://graph.facebook.com/v22.0/${IG_BUSINESS_ACCOUNT_ID}/media_publish`;
    const publishParams = new URLSearchParams({
        creation_id: creationId,
        access_token: META_ACCESS_TOKEN,
    });

    // Strategy: Small retry for the actual publish if it says "not ready" or similar
    let publishData;
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
        const publishResponse = await fetch(`${publishUrl}?${publishParams.toString()}`, {
            method: "POST",
        });

        publishData = await publishResponse.json();
        if (publishResponse.ok) {
            console.log(`[Meta API] Instagram post published successfully: ${publishData.id}`);
            return publishData;
        }

        lastError = publishData.error?.message || "Unknown error during publish";
        console.warn(`[Meta API] Instagram publish attempt ${attempt} failed: ${lastError}`);

        if (attempt < 3) {
            const delay = attempt * 2000;
            console.log(`[Meta API] Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    throw new Error(`Failed to publish Instagram media after retries: ${lastError}`);
}
