import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const { query } = await req.json();
        if (!query) return NextResponse.json({ error: "Query is required" }, { status: 400 });

        const apiKey = process.env.SERPER_API_KEY;
        if (!apiKey) return NextResponse.json({ error: "SERPER_API_KEY not configured" }, { status: 500 });

        const response = await fetch("https://google.serper.dev/images", {
            method: "POST",
            headers: {
                "X-API-KEY": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: query, gl: "us", hl: "en", num: 20 }),
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Serper API request failed" }, { status: 502 });
        }

        const data = await response.json();

        interface SerperImage {
            imageUrl: string;
            title?: string;
            imageWidth?: number;
            imageHeight?: number;
            source?: string;
        }

        const BLOCKED = ['fbsbx', 'licdn', 'lookaside', 'gstatic', 'googleusercontent', 'ytimg', 'twimg'];

        const images = ((data.images as SerperImage[]) || [])
            .filter(img =>
                img.imageUrl &&
                img.imageUrl.startsWith('http') &&
                !BLOCKED.some(b => img.imageUrl.includes(b)) &&
                (img.imageWidth || 0) >= 600
            )
            .slice(0, 9) // return up to 9 candidates; frontend picks 6
            .map(img => ({
                url: img.imageUrl,
                title: img.title || "",
                width: img.imageWidth || 0,
                height: img.imageHeight || 0,
                source: img.source || "",
            }));

        return NextResponse.json({ images });
    } catch (error: any) {
        console.error("[search-images] Error:", error);
        return NextResponse.json({ error: error.message || "Search failed" }, { status: 500 });
    }
}
