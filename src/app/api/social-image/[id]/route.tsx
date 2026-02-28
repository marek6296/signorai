import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    return new Response(`Body test for ID: ${params.id}`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
    });
}
