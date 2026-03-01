import { NextRequest, NextResponse } from "next/server";
import { processArticleFromTopic } from "@/lib/generate-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ADMIN_SECRET = process.env.ADMIN_SECRET || "make-com-webhook-secret";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, postSocial, publishStatus, secret } = body;

        if (secret !== ADMIN_SECRET) {
            return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
        }

        if (!prompt) {
            return NextResponse.json({ message: "Prompt is required" }, { status: 400 });
        }

        console.log(`>>> [Custom Bot] Received request: "${prompt}", Social: ${postSocial}, Status: ${publishStatus}`);

        // 1. Generate and save article
        const article = await processArticleFromTopic(prompt, publishStatus);
        console.log(`>>> [Custom Bot] Article created: ${article.id}`);

        // 2. Optional Social Media Posting
        let socialResult = null;
        if (postSocial && article.status === 'published') {
            console.log(`>>> [Custom Bot] Triggering social autopilot for article: ${article.id}`);
            try {
                const socialRes = await fetch(`${new URL(request.url).origin}/api/admin/social-autopilot`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        platforms: ['Facebook', 'Instagram', 'X'],
                        autoPublish: false, // Keep it false for manual visual review or automated capture later
                        articleId: article.id,
                        secret: ADMIN_SECRET
                    })
                });
                socialResult = await socialRes.json();
            } catch (socialError) {
                console.error(">>> [Custom Bot] Social Autopilot failed:", socialError);
            }
        }

        return NextResponse.json({
            success: true,
            message: "Article generated successfully",
            article,
            social: socialResult
        });

    } catch (error: unknown) {
        console.error(">>> [Custom Bot] Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
