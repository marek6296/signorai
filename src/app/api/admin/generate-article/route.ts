import { NextRequest, NextResponse } from "next/server";
import { processArticleFromUrl } from "@/lib/generate-logic";

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

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return NextResponse.json({ message: "Supabase environment variables are not set." }, { status: 500 });
    }

    if (!url || typeof url !== "string") {
        return NextResponse.json({ message: "URL is required" }, { status: 400 });
    }

    try {
        console.log("Starting article generation for URL:", url);
        const data = await processArticleFromUrl(url, "draft");
        console.log("Article generation successful for:", url);
        return NextResponse.json({ success: true, article: data });
    } catch (error: unknown) {
        console.error("Generate article CRITICAL error:", error);
        const msg = error instanceof Error ? error.message : "Internal server error";

        return NextResponse.json({
            message: msg,
            error: true
        }, { status: 500 });
    }
}
