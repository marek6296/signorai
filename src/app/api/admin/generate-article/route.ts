import { NextRequest, NextResponse } from "next/server";
import { processArticleFromUrl } from "@/lib/generate-logic";

export const runtime = "nodejs";
export const maxDuration = 120;

const LEGACY_SECRET = "make-com-webhook-secret";

export async function POST(request: NextRequest) {
    try {
        const { url, secret } = await request.json();

        // 1. Authorization
        if (secret !== process.env.ADMIN_SECRET && secret !== LEGACY_SECRET) {
            return NextResponse.json({ message: "Invalid token" }, { status: 401 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ message: "OPENAI_API_KEY is not set (Vercel Environment Variables)." }, { status: 500 });
        }

        if (!url) {
            return NextResponse.json({ message: "URL is required" }, { status: 400 });
        }

        // 2. Process the article using the shared logic
        const data = await processArticleFromUrl(url, 'draft');

        return NextResponse.json({ success: true, article: data });

    } catch (error: unknown) {
        console.error("Generate article error:", error);
        return NextResponse.json({ message: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
    }
}
