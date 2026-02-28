import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient } from "@supabase/supabase-js";

export const runtime = 'edge';
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

        // Load Syne font with extra safety
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
                    // Check for OpenType/WOFF signature (not '<!DO')
                    const view = new Uint8Array(buffer.slice(0, 4));
                    const signature = String.fromCharCode(view[0], view[1], view[2], view[3]);
                    if (signature !== '<!DO' && signature !== '<htm') {
                        syneBold = buffer;
                    } else {
                        console.error("[Social Image] Font fetch returned HTML instead of binary.");
                    }
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
                        backgroundColor: '#000',
                        padding: '80px',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    {/* Article Image as Background */}
                    {post.articles?.main_image && (
                        <img
                            src={post.articles.main_image}
                            alt=""
                            style={{
                                position: 'absolute',
                                inset: 0,
                                objectFit: 'cover',
                                opacity: 0.1,
                                filter: 'blur(30px)',
                            }}
                        />
                    )}

                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'radial-gradient(circle at top right, rgba(18, 246, 198, 0.08), transparent 400px), radial-gradient(circle at bottom left, rgba(18, 246, 198, 0.05), transparent 400px)',
                        }}
                    />

                    {/* Gradient Overlay */}
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.7))',
                        }}
                    />

                    {/* Background Blurred Logo Effect */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '900px',
                            height: '900px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(18, 246, 198, 0.03) 0%, rgba(18, 246, 198, 0) 70%)',
                        }}
                    />

                    {/* Top Branding */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '120px',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '12px',
                        }}
                    >
                        <span
                            style={{
                                fontFamily: syneBold ? 'Syne' : 'sans-serif',
                                fontWeight: 800,
                                fontSize: '64px',
                                textTransform: 'uppercase',
                                color: '#fff',
                                letterSpacing: '-0.03em',
                                margin: 0,
                            }}
                        >
                            POSTOVINKY
                        </span>
                        <span
                            style={{
                                color: '#12F6C6',
                                fontWeight: 900,
                                fontSize: '18px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.4em',
                                transform: 'translateY(-6px)',
                            }}
                        >
                            News
                        </span>
                    </div>

                    {/* Centered Content */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            maxWidth: '1000px',
                        }}
                    >
                        {/* Top Line */}
                        <div
                            style={{
                                width: '160px',
                                height: '8px',
                                backgroundColor: '#12F6C6',
                                marginBottom: '60px',
                                borderRadius: '100px',
                                boxShadow: '0 0 20px rgba(18, 246, 198, 0.2)',
                            }}
                        />

                        <h1
                            style={{
                                fontSize: title.length > 50 ? '72px' : '88px',
                                fontWeight: 800,
                                lineHeight: 1.05,
                                color: '#fff',
                                textTransform: 'uppercase',
                                letterSpacing: '-0.02em',
                                margin: 0,
                                padding: '0 20px',
                                fontFamily: syneBold ? 'Syne' : 'sans-serif',
                                wordSpacing: '0.1em',
                            }}
                        >
                            {title}
                        </h1>

                        {/* Bottom Line */}
                        <div
                            style={{
                                width: '160px',
                                height: '8px',
                                backgroundColor: '#12F6C6',
                                marginTop: '60px',
                                borderRadius: '100px',
                                boxShadow: '0 0 20px rgba(18, 246, 198, 0.2)',
                            }}
                        />
                    </div>

                    {/* Bottom URL Pill */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '100px',
                            backgroundColor: 'rgba(255,256,255,0.03)',
                            border: '1.5px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.7)',
                            padding: '18px 54px',
                            borderRadius: '100px',
                            fontWeight: 700,
                            fontSize: '22px',
                            letterSpacing: '0.15em',
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
                fonts: syneBold ? [
                    {
                        name: 'Syne',
                        data: syneBold,
                        weight: 800,
                        style: 'normal',
                    },
                ] : [],
            }
        );
    } catch (e: unknown) {
        console.error('OG Generation Error:', e);
        return new Response(`Error generating photo`, { status: 500 });
    }
}
