import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
    try {
        // Basic verification of incoming data
        // For a real app, you should use a secret token from headers or query params
        // to authenticate the Make.com webhook.
        const secret = request.nextUrl.searchParams.get("secret");

        // Replace "VÁŠ_TAJNÝ_TOKEN_Z_MAKE_COM" with an environment variable in production
        // e.g. process.env.REVALIDATION_TOKEN
        if (secret !== "make-com-webhook-secret") {
            return NextResponse.json({ message: "Invalid token" }, { status: 401 });
        }

        // You can parse the body to find out exactly what changed
        // const body = await request.json();

        // Revalidate the homepage and all nested pages to show the new article
        revalidatePath("/", "layout");

        // Optionally revalidate categories or everything
        // revalidatePath("/kategoria/[kategoria]", "page");

        return NextResponse.json({ revalidated: true, now: Date.now() });
    } catch {
        return NextResponse.json({ message: "Error revalidating" }, { status: 500 });
    }
}
