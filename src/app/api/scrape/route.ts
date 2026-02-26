import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
    try {
        const { url, secret } = await request.json();

        // 1. Ochrana endpointu (rovnaký secret ako pri revalidate)
        if (secret !== "make-com-webhook-secret") {
            return NextResponse.json({ message: "Invalid token" }, { status: 401 });
        }

        if (!url) {
            return NextResponse.json({ message: "URL is required" }, { status: 400 });
        }

        // 2. Stiahnutie surového HTML zadanej stránky (tvárime sa ako bežný prehliadač)
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5"
            },
        });

        if (!response.ok) {
            return NextResponse.json({ message: `Failed to fetch URL, status: ${response.status}` }, { status: response.status });
        }

        const html = await response.text();

        // 3. Extrakcia čistého textu pomocou Mozilla Readability (krásne vytiahne len článok bez reklám)
        const doc = new JSDOM(html, { url });
        const reader = new Readability(doc.window.document);
        const parsedArticle = reader.parse();

        if (!parsedArticle) {
            return NextResponse.json({ message: "Could not parse article from the provided URL" }, { status: 422 });
        }

        // 4. Vrátime čisté dáta pre Make.com
        return NextResponse.json({
            success: true,
            data: {
                title: parsedArticle.title,
                textContent: parsedArticle.textContent,
                byline: parsedArticle.byline,
                siteName: parsedArticle.siteName,
                sourceUrl: url
            }
        });

    } catch (error) {
        console.error("Scraping error:", error);
        return NextResponse.json({ message: "Internal server error during scraping" }, { status: 500 });
    }
}
