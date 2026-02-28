
/**
 * Utility for publishing to Facebook and Instagram via Meta Graph API
 */

const FB_PAGE_ID = process.env.FB_PAGE_ID;
const IG_BUSINESS_ACCOUNT_ID = process.env.IG_BUSINESS_ACCOUNT_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

export async function publishToFacebook(message: string, link?: string) {
    if (!FB_PAGE_ID || !META_ACCESS_TOKEN) {
        throw new Error("Missing Facebook configuration (FB_PAGE_ID or META_ACCESS_TOKEN)");
    }

    const url = `https://graph.facebook.com/v22.0/${FB_PAGE_ID}/feed`;
    const params = new URLSearchParams({
        message,
        access_token: META_ACCESS_TOKEN,
    });

    if (link) {
        params.append("link", link);
    }

    const response = await fetch(`${url}?${params.toString()}`, {
        method: "POST",
    });

    const data = await response.json();
    if (!response.ok) {
        console.error("Facebook API Error:", data);
        throw new Error(data.error?.message || "Failed to post to Facebook");
    }

    return data;
}

export async function publishToInstagram(imageUrl: string, caption: string) {
    if (!IG_BUSINESS_ACCOUNT_ID || !META_ACCESS_TOKEN) {
        throw new Error("Missing Instagram configuration (IG_BUSINESS_ACCOUNT_ID or META_ACCESS_TOKEN)");
    }

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

    // 2. Publish Media Container
    const publishUrl = `https://graph.facebook.com/v22.0/${IG_BUSINESS_ACCOUNT_ID}/media_publish`;
    const publishParams = new URLSearchParams({
        creation_id: creationId,
        access_token: META_ACCESS_TOKEN,
    });

    const publishResponse = await fetch(`${publishUrl}?${publishParams.toString()}`, {
        method: "POST",
    });

    const publishData = await publishResponse.json();
    if (!publishResponse.ok) {
        console.error("Instagram Publish Error:", publishData);
        throw new Error(publishData.error?.message || "Failed to publish Instagram media");
    }

    return publishData;
}
