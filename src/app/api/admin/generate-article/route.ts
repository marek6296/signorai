import { NextRequest, NextResponse } from "next/server";
import { processArticleFromUrl } from "@/lib/generate-logic";

export async function POST(request: NextRequest) {
    try {
        const { url, secret } = await request.json();

        // 1. Authorization
        if (secret !== process.env.ADMIN_SECRET) {
            return NextResponse.json({ message: "Invalid token" }, { status: 401 });
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
