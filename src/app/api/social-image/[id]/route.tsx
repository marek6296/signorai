import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        console.log(`[Social Image Debug] Request for ID: ${params.id}`);

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
                        fontSize: '100px',
                        fontWeight: 'bold',
                    }}
                >
                    POSTOVINKY AI
                </div>
            ),
            {
                width: 1080,
                height: 1080,
            }
        );
    } catch (e: unknown) {
        console.error('OG Generation Error:', e);
        return new Response(`Error: ${String(e)}`, { status: 500 });
    }
}
