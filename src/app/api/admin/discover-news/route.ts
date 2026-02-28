import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { discoverNewNews } from "@/lib/discovery-logic";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LEGACY_SECRET = "make-com-webhook-secret";

async function executeDiscovery(days: number, targetCategories: string[], secret: string | null, authHeader: string | null) {
    console.log(">>> [API Discovery] Starting with params:", { days, targetCategories, secretProvided: !!secret });

    if (
        secret !== process.env.ADMIN_SECRET &&
        secret !== LEGACY_SECRET &&
        authHeader !== `Bearer ${process.env.ADMIN_SECRET}`
    ) {
        console.warn(">>> [API Discovery] Unauthorized access attempt.");
        return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ message: "OPENAI_API_KEY is not set on server." }, { status: 500 });
    }

    try {
        console.log(">>> [API Discovery] Calling library function...");
        const newsItems = await discoverNewNews(days, targetCategories);

        if (newsItems.length === 0) {
            return NextResponse.json({ message: "Nenašli sa žiadne nové správy.", count: 0 }, { status: 404 });
        }

        const finalResults = targetCategories.length > 0
            ? newsItems.filter(item => targetCategories.includes(item.category))
            : newsItems;

        if (finalResults.length === 0) {
            return NextResponse.json({ message: "Žiadne správy pre vybrané kategórie.", count: 0 }, { status: 404 });
        }

        console.log(`>>> [API Discovery] Found ${finalResults.length} items. Saving to DB...`);
        const { error: insertError } = await supabase
            .from('suggested_news')
            .insert(finalResults);

        if (insertError && !insertError.message.includes('unique')) {
            throw insertError;
        }

        return NextResponse.json({
            success: true,
            message: `Nájdených ${finalResults.length} návrhov.`,
            items: finalResults,
            suggestions: finalResults
        });
    } catch (error: any) {
        console.error(">>> [API Discovery] CRITICAL ERROR:", error);
        return NextResponse.json({
            message: "Chyba pri objavovaní správ.",
            detail: error.message || String(error)
        }, { status: 500 });
    }
}

// POST handler FIRST
export async function POST(req: Request) {
    console.log(">>> [API Discovery] POST received");
    try {
        const body = await req.json();
        const { days = 3, categories = [], secret = null } = body;
        const authHeader = req.headers.get("authorization");
        return await executeDiscovery(days, categories, secret, authHeader);
    } catch (e: any) {
        console.error(">>> [API Discovery] POST parse error:", e.message);
        return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }
}

export async function GET(req: Request) {
    console.log(">>> [API Discovery] GET received");
    const url = new URL(req.url);
    const authHeader = req.headers.get("authorization");
    const secret = url.searchParams.get("secret");
    const maxDays = parseInt(url.searchParams.get("days") || "3");
    const categoriesRaw = url.searchParams.get("categories");
    const targetCategories = categoriesRaw ? categoriesRaw.split(",").filter(Boolean) : [];

    return await executeDiscovery(maxDays, targetCategories, secret, authHeader);
}
