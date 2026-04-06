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
    model?: 'gpt-4o' | 'gemini';
    fallbackTitle?: string;
    fallbackContent?: string;
}

export async function POST(request: NextRequest) {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`>>> [API][${requestId}] POST /api/admin/generate-article received`);

    try {
        const body: GenerateArticleRequest = await request.json();
        console.log(`>>> [API][${requestId}] Body parsed items:`, Object.keys(body));
        
        const { url, secret, status = 'draft', model = 'gpt-4o', fallbackTitle, fallbackContent } = body ?? {};
        console.log(`>>> [API][${requestId}] Data: url=${url}, model=${model}, secret=${secret ? 'provided' : 'none'}, hasFallback=${!!(fallbackTitle || fallbackContent)}`);

        // Authorization
        if (secret !== process.env.ADMIN_SECRET && secret !== LEGACY_SECRET) {
            console.warn(`>>> [API][${requestId}] Unauthorized attempt with secret:`, secret);
            return NextResponse.json({ message: "Neautorizovaný prístup (nesprávny secret)." }, { status: 401 });
        }

        if (!url || typeof url !== "string") {
            return NextResponse.json({ message: "URL je povinná" }, { status: 400 });
        }

        // Model key checks
        if (model === 'gemini' && !process.env.GEMINI_API_KEY) {
            console.error(`>>> [API][${requestId}] GEMINI_API_KEY is missing!`);
            return NextResponse.json({ message: "Chýba GEMINI_API_KEY na serveri." }, { status: 500 });
        }

        console.log(`>>> [API][${requestId}] Importing logic and starting generation...`);
        const { processArticleFromUrl } = await import("../../../../lib/generate-logic");
        
        const data = await processArticleFromUrl(url, status, undefined, model, fallbackTitle, fallbackContent);
        
        console.log(`>>> [API][${requestId}] Success for article:`, data?.title);
        return NextResponse.json({ success: true, article: data });

    } catch (error: any) {
        console.error(`>>> [API][${requestId}] CRITICAL ERROR:`, error);
        const msg = error instanceof Error ? error.message : "Neznáma chyba na serveri.";
        return NextResponse.json({ message: msg, error: true }, { status: 500 });
    }
}
