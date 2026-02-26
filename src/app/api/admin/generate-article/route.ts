import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LEGACY_SECRET = "make-com-webhook-secret";

export async function GET() {
    return NextResponse.json({ message: "This endpoint only accepts POST requests (Article Generation)." }, { status: 405 });
}

interface GenerateArticleRequest {
    url?: string;
    secret?: string;
}

export async function POST(request: NextRequest) {
    let body: GenerateArticleRequest;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const { url, secret } = body ?? {};

    if (secret !== process.env.ADMIN_SECRET && secret !== LEGACY_SECRET) {
        return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ message: "OPENAI_API_KEY is not set (Vercel Environment Variables)." }, { status: 500 });
    }

    if (!url || typeof url !== "string") {
        return NextResponse.json({ message: "URL is required" }, { status: 400 });
    }

    try {
        console.log("Starting article generation for URL:", url);
        // Use dynamic import to avoid loading heavy JSDOM/Readability during initial route discovery
        const { processArticleFromUrl } = await import("@/lib/generate-logic");
        const data = await processArticleFromUrl(url, "draft");
        console.log("Article generation successful for:", url);
        return NextResponse.json({ success: true, article: data });
    } catch (error: unknown) {
        console.error("Generate article error:", error);
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ message: msg, error: true }, { status: 500 });
    }
}
