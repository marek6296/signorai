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
        try {
            const fontRes = await fetch(
                new URL('https://fonts.gstatic.com/s/syne/v22/8UA9YrtN6Z7S6Z5Y2Q.woff', 'https://fonts.googleapis.com'),
                { cache: 'no-store' }
            );

            if (fontRes.ok) {
                const contentType = fontRes.headers.get('content-type');
                if (contentType && !contentType.includes('text/html')) {
                    const buffer = await fontRes.arrayBuffer();
                    syneBold = buffer;
                }
            }
        } catch (e) {
            console.error("[Social Image] Font load failed:", e);
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
                        backgroundColor: '#111',
                        padding: 80,
                    }}
                >
                    {/* Article Image as Background without blur removed */}
                    {/* Gradient Overlay removed */}

                    {/* Top Branding */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 120,
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <div
                            style={{
                                fontFamily: syneBold ? 'Syne' : 'sans-serif',
                                fontWeight: 800,
                                fontSize: 64,
                                textTransform: 'uppercase',
                                color: '#fff',
                                margin: 0,
                            }}
                        >
                            POSTOVINKY
                        </div>
                        <div
                            style={{
                                color: '#12F6C6',
                                fontWeight: 900,
                                fontSize: 18,
                                textTransform: 'uppercase',
                                marginLeft: 12,
                                marginBottom: 24,
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
                                width: 160,
                                height: 8,
                                backgroundColor: '#12F6C6',
                                borderRadius: 100,
                                marginBottom: 60,
                            }}
                        />

                        <div
                            style={{
                                fontSize: title.length > 50 ? 64 : 80,
                                fontWeight: 800,
                                color: '#fff',
                                textTransform: 'uppercase',
                                margin: 0,
                                paddingLeft: 20,
                                paddingRight: 20,
                                fontFamily: syneBold ? 'Syne' : 'sans-serif',
                                textAlign: 'center',
                            }}
                        >
                            {title}
                        </div>

                        {/* Bottom Line */}
                        <div
                            style={{
                                width: 160,
                                height: 8,
                                backgroundColor: '#12F6C6',
                                borderRadius: 100,
                                marginTop: 60,
                            }}
                        />
                    </div>

                    {/* Bottom URL Pill */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 100,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '2px solid rgba(255,255,255,0.15)',
                            color: 'rgba(255,255,255,0.8)',
                            paddingTop: 18,
                            paddingBottom: 18,
                            paddingLeft: 54,
                            paddingRight: 54,
                            borderRadius: 100,
                            fontWeight: 700,
                            fontSize: 22,
                            textTransform: 'uppercase',
                        }}
                    >
                        WWW.POSTOVINKY.NEWS
                    </div>
                </div>
            ),
            {
                width: 1080,
                height: 1080,
                ...(syneBold ? {
                    fonts: [
                        {
                            name: 'Syne',
                            data: syneBold,
                            weight: 800,
                            style: 'normal',
                        }
                    ]
                } : {})
            }
        );
    } catch (e: unknown) {
        console.error('OG Generation Error:', e);
        return new Response(`Error generating photo`, { status: 500 });
    }
}
