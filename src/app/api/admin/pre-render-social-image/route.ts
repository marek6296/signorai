import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id } = body;

        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        const headerHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "aiwai.news";
        const protocol = headerHost.includes("localhost") ? "http" : "https";
        const dynamicAppUrl = `${protocol}://${headerHost}`;
        const generatorUrl = `${dynamicAppUrl}/api/social-image/${id}.png?t=${Date.now()}`;

        console.log(`>>> [Pre-render Storage] Generating: ${generatorUrl}`);

        const imageRes = await fetch(generatorUrl);

        if (!imageRes.ok) {
            throw new Error(`Generator returned ${imageRes.status}`);
        }

        const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
        if (imageBuffer.byteLength < 1000) {
            throw new Error("Generated image too small/empty");
        }

        const fileName = `pre-render-${id}-${Date.now()}.png`;

        const { error: uploadError } = await supabase.storage
            .from("social-images")
            .upload(fileName, imageBuffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from("social-images")
            .getPublicUrl(fileName);

        await supabase.from('social_posts').update({ image_url: publicUrl }).eq('id', id);

        // Give the storage edge network 4 full seconds to replicate the file just in case it's instantly queried by Meta/Instagram bots
        await new Promise(r => setTimeout(r, 4000));

        console.log(`>>> [Pre-render Storage] Success, image cached: ${publicUrl}`);

        return NextResponse.json({ success: true, url: publicUrl });
    } catch (err: unknown) {
        console.error(">>> [Pre-render Storage] Cache failed:", err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
