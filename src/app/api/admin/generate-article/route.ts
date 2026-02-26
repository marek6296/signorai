import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LEGACY_SECRET = "make-com-webhook-secret";

export function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: { Allow: "POST", "Content-Length": "0" } });
}

export async function POST(request: NextRequest) {
    let body: { url?: string; secret?: string };
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
        const { processArticleFromUrl } = await import("@/lib/generate-logic");
        const data = await processArticleFromUrl(url, "draft");
        return NextResponse.json({ success: true, article: data });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Internal server error";
        console.error("Generate article error:", error);
        return NextResponse.json({ message: msg }, { status: 500 });
    }
}
