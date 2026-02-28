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

        // Fetch the social post with article title
        const { data: post, error: postError } = await supabase
            .from("social_posts")
            .select(`
                *,
                articles (
                    title
                )
            `)
            .eq("id", id)
            .single();

        if (postError || !post) {
            return new Response(`Post not found`, { status: 404 });
        }

        const title = post.articles?.title || 'Novinky zo sveta AI';

        // Load Syne font (using a more reliable CDN approach or fallback)
        let syneBold;
        try {
            syneBold = await fetch(
                new URL('https://fonts.gstatic.com/s/syne/v22/8UA9YrtN6Z7S6Z5Y2Q.woff', 'https://fonts.googleapis.com')
            ).then((res) => res.arrayBuffer());
        } catch (e) {
            console.error("Font load failed, using system font");
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
                    {/* Background Accents */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '-250px',
                            right: '-250px',
                            width: '800px',
                            height: '800px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(18, 246, 198, 0.15) 0%, rgba(18, 246, 198, 0) 70%)',
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-400px',
                            left: '-400px',
                            width: '1000px',
                            height: '1000px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(18, 246, 198, 0.1) 0%, rgba(18, 246, 198, 0) 70%)',
                        }}
                    />

                    {/* Top Logo */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '120px',
                            display: 'flex',
                            alignItems: 'baseline',
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
                                letterSpacing: '0.3em',
                                marginLeft: '12px',
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
                            maxWidth: '940px',
                        }}
                    >
                        <div
                            style={{
                                width: '140px',
                                height: '6px',
                                backgroundColor: '#12F6C6',
                                marginBottom: '50px',
                                borderRadius: '99px',
                            }}
                        />
                        <h2
                            style={{
                                fontSize: '84px',
                                fontWeight: 800,
                                lineHeight: 1.1,
                                color: '#fff',
                                textTransform: 'uppercase',
                                letterSpacing: '-0.02em',
                                margin: 0,
                                wordSpacing: '0.2em',
                                fontFamily: syneBold ? 'Syne' : 'sans-serif',
                            }}
                        >
                            {title}
                        </h2>
                        <div
                            style={{
                                width: '140px',
                                height: '6px',
                                backgroundColor: '#12F6C6',
                                marginTop: '50px',
                                borderRadius: '99px',
                            }}
                        />
                    </div>

                    {/* Bottom URL Pill */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '100px',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            padding: '20px 50px',
                            borderRadius: '99px',
                            fontWeight: 600,
                            fontSize: '24px',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            backdropFilter: 'blur(10px)',
                        }}
                    >
                        www.postovinky.news
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
