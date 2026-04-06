import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side image proxy — avoids browser CORS taint issues when html-to-image
 * tries to embed external images (e.g. Supabase storage) into an HTML5 canvas.
 *
 * Usage: GET /api/proxy-image?url=<encoded-image-url>
 */
export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
        return new NextResponse('Missing url param', { status: 400 });
    }

    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            return new NextResponse(`Upstream error: ${res.status}`, { status: res.status });
        }

        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const buffer = await res.arrayBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (err) {
        console.error('[proxy-image] fetch failed:', err);
        return new NextResponse('Proxy fetch failed', { status: 500 });
    }
}
