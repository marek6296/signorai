import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { 
    commentOnFacebook, 
    commentOnInstagram, 
    deleteFromFacebook, 
    deleteInstagramComment 
} from "@/lib/meta-api";

export const dynamic = "force-dynamic";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, postId, platform, message, commentId, secret } = body;

        // Auth check
        if (secret !== process.env.ADMIN_SECRET && secret !== "make-com-webhook-secret") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!action || !postId) {
            return NextResponse.json({ error: "Missing action or postId" }, { status: 400 });
        }

        // Fetch post to get external_id
        const { data: post, error: postError } = await supabase
            .from("social_posts")
            .select("*")
            .eq("id", postId)
            .single();

        if (postError || !post) {
            throw new Error(`Social post not found: ${postId}`);
        }

        const externalId = post.external_id;
        if (!externalId && action !== 'delete_local') {
            throw new Error("This post doesn't have an external ID (it might not have been published correctly via API).");
        }

        let result;

        switch (action) {
            case "comment":
                if (!message) throw new Error("Comment message is required.");
                if (platform === "Facebook") {
                    result = await commentOnFacebook(externalId, message);
                } else if (platform === "Instagram") {
                    result = await commentOnInstagram(externalId, message);
                } else {
                    throw new Error("Comments not supported on this platform.");
                }
                break;

            case "delete_social":
                if (platform === "Facebook") {
                    result = await deleteFromFacebook(externalId);
                } else if (platform === "Instagram") {
                    throw new Error("Instagram Graph API does not support deleting media posts. You must delete it manually in the App.");
                } else {
                    throw new Error("Deletion not supported on this platform.");
                }
                break;

            default:
                throw new Error(`Unsupported action: ${action}`);
        }

        return NextResponse.json({ success: true, result });

    } catch (error: any) {
        console.error("Social Action Error:", error);
        return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
    }
}
