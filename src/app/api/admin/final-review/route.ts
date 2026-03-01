import { NextRequest, NextResponse } from "next/server";
import { runFinalReviewAndPublish } from "@/lib/generate-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;



const ADMIN_SECRET = process.env.ADMIN_SECRET || "make-com-webhook-secret";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { articleId, secret } = body as { articleId: string; secret: string };

        if (!secret || secret !== ADMIN_SECRET) {
            return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
        }

        if (!articleId) {
            return NextResponse.json({ message: "No article selected" }, { status: 400 });
        }

        // Run review
        const result = await runFinalReviewAndPublish(articleId);

        return NextResponse.json({
            message: "Článok úspešne skontrolovaný a publikovaný.",
            articleId,
            success: true,
            result
        });

    } catch (error: unknown) {
        console.error("Final review API error:", error);
        return NextResponse.json({ message: (error as Error).message || "Internal Error" }, { status: 500 });
    }
}
