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
    status?: 'draft' | 'published';
}

export async function POST(request: NextRequest) {
    console.log(">>> [API] POST /api/admin/generate-article received");

    // Check Env Variables early
    const envCheck = {
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        ADMIN_SECRET: !!process.env.ADMIN_SECRET
    };
    console.log(">>> [API] Env Check:", envCheck);

    if (!envCheck.OPENAI_API_KEY || !envCheck.NEXT_PUBLIC_SUPABASE_URL || !envCheck.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return NextResponse.json({
            message: "Missing critical environment variables on server.",
            env: envCheck
        }, { status: 500 });
    }

    let body: GenerateArticleRequest;
    try {
        body = await request.json();
        console.log(">>> [API] Body parsed items:", Object.keys(body));
    } catch (e) {
        console.error(">>> [API] Failed to parse JSON body:", e);
        return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const { url, secret, status = 'draft' } = body ?? {};

    if (secret !== process.env.ADMIN_SECRET && secret !== LEGACY_SECRET) {
        console.warn(">>> [API] Unauthorized attempt with secret:", secret ? "provided" : "none");
        return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    if (!url || typeof url !== "string") {
        return NextResponse.json({ message: "URL is required" }, { status: 400 });
    }

    try {
        console.log(">>> [API] Calling processArticleFromUrl for:", url, "with status:", status);
        // Use relative path for dynamic import to be safe
        const { processArticleFromUrl } = await import("../../../../lib/generate-logic");
        const data = await processArticleFromUrl(url, status);
        console.log(">>> [API] Success for:", url);
        return NextResponse.json({ success: true, article: data });
    } catch (error: unknown) {
        console.error(">>> [API] CRITICAL ERROR:", error);
        const msg = error instanceof Error ? error.message : "Internal server error";
        const stack = error instanceof Error ? error.stack : undefined;

        return NextResponse.json({
            message: msg,
            stack: process.env.NODE_ENV === "development" ? stack : undefined,
            error: true
        }, { status: 500 });
    }
}
