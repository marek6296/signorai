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
        console.log(`[Social Image] Generating for ID: ${id}`);

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
            console.error(`[Social Image] Post not found: ${id}`);
            return new Response(`Post not found`, { status: 404 });
        }

        const title = post.articles?.title || 'Novinky zo sveta AI';

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
                        color: '#fff',
                        padding: '80px',
                        position: 'relative',
                        fontFamily: 'sans-serif',
                    }}
                >
                    <div style={{ display: 'flex', position: 'absolute', top: '100px', fontSize: '40px', fontWeight: 'bold' }}>
                        POSTOVINKY
                    </div>
                    <div style={{ display: 'flex', textAlign: 'center', fontSize: '60px', fontWeight: '900', textTransform: 'uppercase' }}>
                        {title}
                    </div>
                    <div style={{ display: 'flex', position: 'absolute', bottom: '100px', fontSize: '30px' }}>
                        www.postovinky.news
                    </div>
                </div>
            ),
            {
                width: 1080,
                height: 1080,
            }
        );
    } catch (e: unknown) {
        console.error('[Social Image] Error:', e);
        return new Response(`Error: ${String(e)}`, { status: 500 });
    }
}
