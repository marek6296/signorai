/**
 * /api/social-image/preview
 * Direct Satori render that accepts title + imageUrl + variant as query params.
 * Does NOT require a social_post DB row — used by InstagramPreview's Save button
 * so the user can download a properly-rendered PNG before confirming to drafts.
 *
 * Query params:
 *   title    - article title (required)
 *   imageUrl - article image URL (optional, used in photo variant)
 *   variant  - "photo" | "studio" (default: "photo")
 *   date     - ISO date string (optional, defaults to today)
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadFont(url: string): Promise<ArrayBuffer | undefined> {
    try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (res.ok) return res.arrayBuffer();
    } catch { /* ignore */ }
    return undefined;
}

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

export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams;
        const title   = (sp.get('title') || 'Novinky zo sveta AI').replace(/<[^>]+>/g, '');
        const rawImg  = sp.get('imageUrl') || '';
        const variant = sp.get('variant')  || 'photo';
        const dateStr = sp.get('date')     || '';

        // Format the date label
        let dateLabel = '';
        try {
            const d = dateStr ? new Date(dateStr) : new Date();
            const months = ['JANUÁRA','FEBRUÁRA','MARCA','APRÍLA','MÁJA','JÚNA','JÚLA','AUGUSTA','SEPTEMBRA','OKTÓBRA','NOVEMBRA','DECEMBRA'];
            dateLabel = `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
        } catch { /* ignore */ }

        // Pre-fetch fonts and image in parallel
        const [syneBold, interBlack, imgDataUrl] = await Promise.all([
            loadFont('https://fonts.gstatic.com/s/syne/v24/8vIS7w4qzmVxsWxjBZRjr0FKM_24vj6k.ttf'),
            loadFont('https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYMZg.ttf'),
            rawImg ? loadImageAsDataUrl(rawImg) : Promise.resolve(null),
        ]);

        const imgUrl = imgDataUrl || rawImg || null;

        const fonts = [
            ...(syneBold   ? [{ name: 'Syne',  data: syneBold,   weight: 800 as const, style: 'normal' as const }] : []),
            ...(interBlack ? [{ name: 'Inter', data: interBlack, weight: 900 as const, style: 'normal' as const }] : []),
        ];

        const titleLen = title.length;

        // ── PHOTO VARIANT ──────────────────────────────────────────────────
        if (variant === 'photo') {
            const photoTitleSize = titleLen > 80 ? 46 : titleLen > 60 ? 54 : titleLen > 40 ? 62 : 68;

            return new ImageResponse(
                (
                    <div style={{ width: 1080, height: 1080, position: 'relative', overflow: 'hidden', display: 'flex', backgroundColor: '#000' }}>
                        {/* Background image */}
                        {imgUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imgUrl} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg,#0d0d1a 0%,#141428 40%,#0a1628 100%)', display: 'flex' }} />
                        )}
                        {/* Gradient scrim */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.72) 70%, rgba(0,0,0,0.97) 100%)', display: 'flex' }} />
                        {/* Logo */}
                        <div style={{ position: 'absolute', top: 64, left: 64, display: 'flex', alignItems: 'baseline', gap: 10 }}>
                            <span style={{ fontSize: 58, fontWeight: 900, letterSpacing: '-0.04em', textTransform: 'uppercase', color: '#ffffff', lineHeight: 1, fontFamily: syneBold ? 'Syne' : 'sans-serif' }}>AIWAI</span>
                            <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontFamily: interBlack ? 'Inter' : 'sans-serif' }}>NEWS</span>
                        </div>
                        {/* Bottom content */}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 72px 80px', display: 'flex', flexDirection: 'column' }}>
                            {dateLabel ? (
                                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 28, fontFamily: interBlack ? 'Inter' : 'sans-serif' }}>
                                    {dateLabel}
                                </div>
                            ) : null}
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

        // ── STUDIO VARIANT ─────────────────────────────────────────────────
        const studioTitleSize = titleLen > 80 ? 52 : titleLen > 60 ? 60 : titleLen > 40 ? 68 : 76;

        return new ImageResponse(
            (
                <div style={{ width: 1080, height: 1080, backgroundColor: '#000', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                    <svg style={{ position: 'absolute', top: -250, right: -250, width: 800, height: 800 }} viewBox="0 0 800 800">
                        <defs><radialGradient id="g1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="rgba(110,60,220,0.30)" /><stop offset="65%" stopColor="rgba(110,60,220,0)" /></radialGradient></defs>
                        <circle cx="400" cy="400" r="400" fill="url(#g1)" />
                    </svg>
                    <svg style={{ position: 'absolute', bottom: -300, left: -250, width: 900, height: 900 }} viewBox="0 0 900 900">
                        <defs><radialGradient id="g2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="rgba(40,80,220,0.25)" /><stop offset="65%" stopColor="rgba(40,80,220,0)" /></radialGradient></defs>
                        <circle cx="450" cy="450" r="450" fill="url(#g2)" />
                    </svg>
                    {/* Mini wordmark */}
                    <div style={{ position: 'absolute', top: 64, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
                        <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
                        <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '0.55em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', fontFamily: interBlack ? 'Inter' : 'sans-serif' }}>AIWAI · NEWS</span>
                        <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
                    </div>
                    {/* Big logo */}
                    <div style={{ position: 'absolute', top: 108, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 14 }}>
                        <span style={{ fontSize: 108, fontWeight: 900, letterSpacing: '-0.04em', textTransform: 'uppercase', color: '#ffffff', lineHeight: 1, fontFamily: syneBold ? 'Syne' : 'sans-serif' }}>AIWAI</span>
                        <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', fontFamily: interBlack ? 'Inter' : 'sans-serif' }}>NEWS</span>
                    </div>
                    {/* Title */}
                    <div style={{ position: 'absolute', top: 340, bottom: 220, left: 80, right: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 72, height: 4, background: '#fff', borderRadius: 4, marginBottom: 52 }} />
                        <div style={{ fontSize: studioTitleSize, fontWeight: 900, lineHeight: 1.12, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.01em', textAlign: 'center', fontFamily: interBlack ? 'Inter' : 'sans-serif' }}>{title}</div>
                        <div style={{ width: 72, height: 4, background: '#fff', borderRadius: 4, marginTop: 52 }} />
                    </div>
                    {/* URL pill */}
                    <div style={{ position: 'absolute', bottom: 84, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ background: '#ffffff', color: '#000000', padding: '20px 56px', borderRadius: 100, fontSize: 26, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: interBlack ? 'Inter' : 'sans-serif' }}>WWW.AIWAI.NEWS</div>
                    </div>
                </div>
            ),
            { width: 1080, height: 1080, fonts }
        );

    } catch (e: unknown) {
        console.error('Preview render error:', e);
        return new Response('Error generating preview image', { status: 500 });
    }
}
