import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function loadFont(url: string): Promise<ArrayBuffer | undefined> {
    try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (res.ok) return res.arrayBuffer();
    } catch { /* ignore */ }
    return undefined;
}

/**
 * Fetch an image and return it as a base64 data URL so Satori doesn't need to
 * make any external requests during JSX rendering (which often fails silently,
 * leaving the image area black).
 */
async function loadImageAsDataUrl(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return null;
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return `data:${contentType};base64,${base64}`;
    } catch {
        return null;
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id.split('.')[0];
        const searchParams = req.nextUrl.searchParams;
        const variant = searchParams.get('variant') || 'studio'; // studio | photo

        const { data: post, error: postError } = await supabase
            .from("social_posts")
            .select(`*, articles(title, main_image, category, excerpt, published_at)`)
            .eq("id", id)
            .single();

        if (postError || !post) return new Response(`Post not found`, { status: 404 });

        const title    = post.articles?.title    || 'Novinky zo sveta AI';
        const rawImgUrl = post.articles?.main_image || null;
        const category = post.articles?.category  || 'AI';

        // Pre-fetch the article image as base64 so Satori doesn't need to make
        // any external HTTP request during JSX rendering (external fetches in
        // Satori often fail silently and leave the image area black).
        const [syneBold, interBlack, imgDataUrl] = await Promise.all([
            loadFont('https://fonts.gstatic.com/s/syne/v24/8vIS7w4qzmVxsWxjBZRjr0FKM_24vj6k.ttf'),
            loadFont('https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYMZg.ttf'),
            rawImgUrl ? loadImageAsDataUrl(rawImgUrl) : Promise.resolve(null),
        ]);

        // Use pre-fetched base64 data URL; fall back to original URL if fetch failed
        const imgUrl = imgDataUrl || rawImgUrl;

        const fonts = [
            ...(syneBold  ? [{ name: 'Syne',  data: syneBold,  weight: 800 as const, style: 'normal' as const }] : []),
            ...(interBlack? [{ name: 'Inter', data: interBlack,weight: 900 as const, style: 'normal' as const }] : []),
        ];

        const titleLen = title.length;

        // ── PHOTO VARIANT — matches InstagramPreview PHOTO layout exactly ──
        if (variant === 'photo') {
            const photoTitleSize = titleLen > 80 ? 46 : titleLen > 60 ? 54 : titleLen > 40 ? 62 : 68;

            // Format date like InstagramPreview does
            const pubAt = (post.articles as any)?.published_at as string | undefined;
            let dateStr = '';
            if (pubAt) {
                try {
                    const d = new Date(pubAt);
                    const months = ['JANUÁRA','FEBRUÁRA','MARCA','APRÍLA','MÁJA','JÚNA','JÚLA','AUGUSTA','SEPTEMBRA','OKTÓBRA','NOVEMBRA','DECEMBRA'];
                    dateStr = `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
                } catch { /* ignore */ }
            }

            return new ImageResponse(
                (
                    <div style={{ width: 1080, height: 1080, position: 'relative', overflow: 'hidden', display: 'flex', backgroundColor: '#000' }}>

                        {/* Article image background */}
                        {imgUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imgUrl} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg,#0d0d1a 0%,#141428 40%,#0a1628 100%)' }} />
                        )}

                        {/* Gradient scrim */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.72) 70%, rgba(0,0,0,0.97) 100%)', display: 'flex' }} />

                        {/* Logo — top-left */}
                        <div style={{ position: 'absolute', top: 64, left: 64, display: 'flex', alignItems: 'baseline', gap: 10 }}>
                            <span style={{ fontSize: 58, fontWeight: 900, letterSpacing: '-0.04em', textTransform: 'uppercase', color: '#ffffff', lineHeight: 1, fontFamily: syneBold ? 'Syne' : 'sans-serif' }}>AIWAI</span>
                            <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontFamily: interBlack ? 'Inter' : 'sans-serif' }}>NEWS</span>
                        </div>

                        {/* Bottom content — date + title + www */}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 72px 80px', display: 'flex', flexDirection: 'column' }}>
                            {dateStr && (
                                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 28, fontFamily: interBlack ? 'Inter' : 'sans-serif' }}>
                                    {dateStr}
                                </div>
                            )}
                            <div style={{ fontSize: photoTitleSize, fontWeight: 900, lineHeight: 1.1, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: 40, fontFamily: interBlack ? 'Inter' : 'sans-serif' }}>
                                {title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ width: 52, height: 4, background: '#ffffff', borderRadius: 4 }} />
                                <span style={{ fontSize: 21, fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontFamily: interBlack ? 'Inter' : 'sans-serif' }}>WWW.AIWAI.NEWS</span>
                                <div style={{ width: 52, height: 4, background: '#ffffff', borderRadius: 4 }} />
                            </div>
                        </div>
                    </div>
                ),
                { width: 1080, height: 1080, fonts }
            );
        }

        // ── STUDIO VARIANT (default dark) ─────────────
        const studioTitleSize = titleLen > 80 ? 52 : titleLen > 60 ? 60 : titleLen > 40 ? 68 : 76;

        return new ImageResponse(
            (
                <div style={{ width: 1080, height: 1080, backgroundColor: '#000', position: 'relative', display: 'flex', flexDirection: 'column' }}>

                    {/* Glow accents */}
                    <svg style={{ position: 'absolute', top: -250, right: -250, width: 800, height: 800 }} viewBox="0 0 800 800">
                        <defs>
                            <radialGradient id="g1" cx="50%" cy="50%" r="50%">
                                <stop offset="0%"   stopColor="rgba(110,60,220,0.30)" />
                                <stop offset="65%"  stopColor="rgba(110,60,220,0)" />
                            </radialGradient>
                        </defs>
                        <circle cx="400" cy="400" r="400" fill="url(#g1)" />
                    </svg>
                    <svg style={{ position: 'absolute', bottom: -300, left: -250, width: 900, height: 900 }} viewBox="0 0 900 900">
                        <defs>
                            <radialGradient id="g2" cx="50%" cy="50%" r="50%">
                                <stop offset="0%"   stopColor="rgba(40,80,220,0.25)" />
                                <stop offset="65%"  stopColor="rgba(40,80,220,0)" />
                            </radialGradient>
                        </defs>
                        <circle cx="450" cy="450" r="450" fill="url(#g2)" />
                    </svg>

                    {/* Mini wordmark row */}
                    <div style={{ position: 'absolute', top: 64, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
                        <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
                        <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '0.55em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', fontFamily: interBlack ? 'Inter' : 'sans-serif' }}>
                            AIWAI · NEWS
                        </span>
                        <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
                    </div>

                    {/* Big AIWAI logo */}
                    <div style={{ position: 'absolute', top: 108, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 14 }}>
                        <span style={{ fontSize: 108, fontWeight: 900, letterSpacing: '-0.04em', textTransform: 'uppercase', color: '#ffffff', lineHeight: 1, fontFamily: syneBold ? 'Syne' : 'sans-serif' }}>
                            AIWAI
                        </span>
                        <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', fontFamily: interBlack ? 'Inter' : 'sans-serif' }}>
                            NEWS
                        </span>
                    </div>

                    {/* Center: separator + title + separator */}
                    <div style={{
                        position: 'absolute', top: 340, bottom: 220,
                        left: 80, right: 80,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{ width: 72, height: 4, background: '#fff', borderRadius: 4, marginBottom: 52 }} />
                        <div style={{
                            fontSize: studioTitleSize,
                            fontWeight: 900,
                            lineHeight: 1.12,
                            color: '#ffffff',
                            textTransform: 'uppercase',
                            letterSpacing: '-0.01em',
                            textAlign: 'center',
                            fontFamily: interBlack ? 'Inter' : 'sans-serif',
                        }}>{title}</div>
                        <div style={{ width: 72, height: 4, background: '#fff', borderRadius: 4, marginTop: 52 }} />
                    </div>

                    {/* URL pill */}
                    <div style={{ position: 'absolute', bottom: 84, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                        <div style={{
                            background: '#ffffff', color: '#000000',
                            padding: '20px 56px', borderRadius: 100,
                            fontSize: 26, fontWeight: 900,
                            letterSpacing: '0.15em', textTransform: 'uppercase',
                            fontFamily: interBlack ? 'Inter' : 'sans-serif',
                        }}>WWW.AIWAI.NEWS</div>
                    </div>
                </div>
            ),
            { width: 1080, height: 1080, fonts }
        );

    } catch (e: unknown) {
        console.error('OG Generation Error:', e);
        return new Response(`Error generating image`, { status: 500 });
    }
}
