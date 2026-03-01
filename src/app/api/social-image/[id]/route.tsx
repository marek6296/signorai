import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id.split('.')[0];

        // Fetch the social post with article title and main_image
        const { data: post, error: postError } = await supabase
            .from("social_posts")
            .select(`
                *,
                articles (
                    title,
                    main_image
                )
            `)
            .eq("id", id)
            .single();

        if (postError || !post) {
            return new Response(`Post not found`, { status: 404 });
        }

        const title = post.articles?.title || 'Novinky zo sveta AI';

        let syneBold: ArrayBuffer | undefined;
        let interBlack: ArrayBuffer | undefined;
        try {
            const fontRes = await fetch(
                new URL('https://fonts.gstatic.com/s/syne/v24/8vIS7w4qzmVxsWxjBZRjr0FKM_24vj6k.ttf'),
                { cache: 'force-cache' }
            );

            if (fontRes.ok) {
                const buffer = await fontRes.arrayBuffer();
                syneBold = buffer;
            }
        } catch (e) {
            console.error("[Social Image] Syne font load failed:", e);
        }

        try {
            const fontRes = await fetch(
                new URL('https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYMZg.ttf'),
                { cache: 'force-cache' }
            );

            if (fontRes.ok) {
                const buffer = await fontRes.arrayBuffer();
                interBlack = buffer;
            }
        } catch (e) {
            console.error("[Social Image] Inter font load failed:", e);
        }

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#000',
                        padding: 80,
                    }}
                >

                    {/* Background Accents for depth using SVG for Satori compatibility */}
                    <svg
                        style={{
                            position: 'absolute',
                            top: -250,
                            right: -250,
                            width: 500,
                            height: 500,
                        }}
                        viewBox="0 0 500 500"
                    >
                        <defs>
                            <radialGradient id="glowTopRight" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="rgba(0, 255, 204, 0.2)" />
                                <stop offset="100%" stopColor="rgba(0, 255, 204, 0)" />
                            </radialGradient>
                        </defs>
                        <circle cx="250" cy="250" r="250" fill="url(#glowTopRight)" />
                    </svg>

                    <svg
                        style={{
                            position: 'absolute',
                            bottom: -300,
                            left: -300,
                            width: 600,
                            height: 600,
                        }}
                        viewBox="0 0 600 600"
                    >
                        <defs>
                            <radialGradient id="glowBottomLeft" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="rgba(0, 255, 204, 0.2)" />
                                <stop offset="100%" stopColor="rgba(0, 255, 204, 0)" />
                            </radialGradient>
                        </defs>
                        <circle cx="300" cy="300" r="300" fill="url(#glowBottomLeft)" />
                    </svg>

                    {/* Top Branding */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 120,
                            left: 0,
                            right: 0,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'baseline',
                        }}
                    >
                        <div
                            style={{
                                fontFamily: syneBold ? 'Syne' : 'sans-serif',
                                fontWeight: 800,
                                fontSize: 56,
                                letterSpacing: '-0.05em',
                                textTransform: 'uppercase',
                                color: '#fff',
                                margin: 0,
                            }}
                        >
                            POSTOVINKY
                        </div>
                        <div
                            style={{
                                color: 'rgba(255, 255, 255, 0.8)',
                                fontWeight: 900,
                                fontSize: 16,
                                textTransform: 'uppercase',
                                letterSpacing: '0.3em',
                                marginLeft: 12,
                                transform: 'translateY(-4px)',
                            }}
                        >
                            News
                        </div>
                    </div>

                    {/* Centered Content */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            width: 900,
                        }}
                    >
                        {/* Top Line */}
                        <div
                            style={{
                                width: 96,
                                height: 6,
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderRadius: 100,
                                marginBottom: 40,
                            }}
                        />

                        <div
                            style={{
                                fontSize: title.length > 50 ? 64 : 70,
                                fontWeight: 900,
                                lineHeight: 1.15,
                                color: '#fff',
                                textTransform: 'uppercase',
                                margin: 0,
                                paddingLeft: 20,
                                paddingRight: 20,
                                letterSpacing: '-0.01em',
                                fontFamily: interBlack ? 'Inter' : 'sans-serif',
                                textAlign: 'center',
                            }}
                        >
                            {title}
                        </div>

                        {/* Bottom Line */}
                        <div
                            style={{
                                width: 96,
                                height: 6,
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderRadius: 100,
                                marginTop: 40,
                            }}
                        />
                    </div>

                    {/* Bottom URL Pill */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 100,
                            left: 0,
                            right: 0,
                            display: 'flex',
                            justifyContent: 'center',
                        }}
                    >
                        <div
                            style={{
                                backgroundColor: '#fff',
                                color: '#000',
                                paddingTop: 20,
                                paddingBottom: 20,
                                paddingLeft: 48,
                                paddingRight: 48,
                                borderRadius: 100,
                                fontWeight: 900,
                                fontSize: 26,
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase',
                                fontFamily: interBlack ? 'Inter' : 'sans-serif',
                            }}
                        >
                            WWW.POSTOVINKY.NEWS
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1080,
                height: 1080,
                fonts: [
                    ...(syneBold ? [{
                        name: 'Syne',
                        data: syneBold,
                        weight: 800 as const,
                        style: 'normal' as const,
                    }] : []),
                    ...(interBlack ? [{
                        name: 'Inter',
                        data: interBlack,
                        weight: 900 as const,
                        style: 'normal' as const,
                    }] : [])
                ]
            }
        );
    } catch (e: unknown) {
        console.error('OG Generation Error:', e);
        return new Response(`Error generating photo`, { status: 500 });
    }
}
