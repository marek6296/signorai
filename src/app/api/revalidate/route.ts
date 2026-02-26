import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
    try {
        const secret = request.nextUrl.searchParams.get("secret");
        if (secret !== "make-com-webhook-secret") {
            return NextResponse.json({ message: "Invalid token" }, { status: 401 });
        }

        let slug: string | null = null;
        try {
            const body = await request.json();
            slug = (body?.slug ?? body?.path) ?? null;
        } catch {
            // Žiadne body alebo nie JSON – OK
        }

        // Úvodná stránka a layout – vždy
        revalidatePath("/", "layout");

        // Konkrétny článok – aby sa zmeny hneď prejavili na webe
        if (slug && typeof slug === "string") {
            revalidatePath(`/article/${slug}`, "page");
        }

        // Kategórie (zoznamy článkov)
        revalidatePath("/kategoria/[kategoria]", "page");

        return NextResponse.json({ revalidated: true, slug: slug ?? undefined, now: Date.now() });
    } catch {
        return NextResponse.json({ message: "Error revalidating" }, { status: 500 });
    }
}
