import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { discoverNewNews } from "@/lib/discovery-logic";

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        const secret = request.nextUrl.searchParams.get("secret");

        // New filters
        const maxDays = parseInt(request.nextUrl.searchParams.get("days") || "3");
        const categoriesRaw = request.nextUrl.searchParams.get("categories");
        const targetCategories = categoriesRaw ? categoriesRaw.split(",").filter(Boolean) : [];

        if (secret !== process.env.ADMIN_SECRET && authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
            return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
        }

        const newsItems = await discoverNewNews(maxDays, targetCategories);

        if (newsItems.length === 0) {
            return NextResponse.json({ message: "Všetky novinky z týchto kategórií si už videl, alebo sa nenašli žiadne nové za posledné dni.", count: 0 }, { status: 404 });
        }

        // Final Filter: Only keep suggestions that match the user's requested (filtered) categories
        const finalResults = newsItems.filter(item => {
            if (targetCategories.length === 0) return true;
            return targetCategories.includes(item.category);
        });

        if (finalResults.length === 0) {
            return NextResponse.json({ message: "Nepodarilo sa nájsť návrhy pre vybrané kategórie po AI spracovaní.", count: 0 }, { status: 404 });
        }

        // Batch insert into database
        const { error: insertError } = await supabase
            .from('suggested_news')
            .insert(finalResults);

        if (insertError && !insertError.message.includes('unique')) {
            throw insertError;
        }

        return NextResponse.json({
            success: true,
            message: `Úspešne som našiel ${finalResults.length} rôznorodých návrhov naprieč kategóriami.`,
            suggestions: finalResults
        });

    } catch (error: unknown) {
        console.error("News discovery error detail:", error);
        return NextResponse.json({
            message: "Chyba pri objavovaní správ.",
            detail: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
