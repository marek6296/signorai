import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const title = searchParams.get('title') || 'Novinky zo sveta AI';

        // Load Syne font (Bold/Extrabold 800)
        const syneBold = await fetch(
            new URL('https://fonts.gstatic.com/s/syne/v22/8UA9YrtN6Z7S6Z5Y2Q.woff', 'https://fonts.googleapis.com')
        ).then((res) => res.arrayBuffer());

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
                    {/* Background Accents (Radial Gradients mimic blur) */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '-250px',
                            right: '-250px',
                            width: '800px',
                            height: '800px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(18, 246, 198, 0.1) 0%, rgba(18, 246, 198, 0) 70%)',
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
                            background: 'radial-gradient(circle, rgba(18, 246, 198, 0.08) 0%, rgba(18, 246, 198, 0) 70%)',
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
                                fontFamily: 'Syne',
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
                                width: '120px',
                                height: '8px',
                                backgroundColor: '#fff',
                                marginBottom: '50px',
                                borderRadius: '99px',
                            }}
                        />
                        <h2
                            style={{
                                fontSize: '80px',
                                fontWeight: 800,
                                lineHeight: 1.1,
                                color: '#fff',
                                textTransform: 'uppercase',
                                letterSpacing: '-0.02em',
                                margin: 0,
                                wordSpacing: '0.2em',
                            }}
                        >
                            {title}
                        </h2>
                        <div
                            style={{
                                width: '120px',
                                height: '8px',
                                backgroundColor: '#fff',
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
                            backgroundColor: '#fff',
                            color: '#000',
                            padding: '24px 60px',
                            borderRadius: '99px',
                            fontWeight: 900,
                            fontSize: '28px',
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                        }}
                    >
                        www.postovinky.news
                    </div>
                </div>
            ),
            {
                width: 1080,
                height: 1080,
                fonts: [
                    {
                        name: 'Syne',
                        data: syneBold,
                        weight: 800,
                        style: 'normal',
                    },
                ],
            }
        );
    } catch (e: any) {
        console.error('OG Generation Error:', e.message);
        return new Response(`Failed to generate the image`, { status: 500 });
    }
}
