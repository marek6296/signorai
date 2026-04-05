import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const postId = formData.get('postId') as string;

        if (!file) {
            return NextResponse.json({ error: 'Nenájdený žiadny súbor pre upload' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const filename = `uploads/${postId || Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('social-images')
            .upload(filename, buffer, {
                contentType: file.type,
                upsert: true
            });

        if (uploadError) {
            console.error("Upload error:", uploadError);
            return NextResponse.json({ error: "Chyba nahrávania obrázku" }, { status: 500 });
        }

        const { data: urlData } = supabase.storage.from('social-images').getPublicUrl(filename);
        const imageUrl = urlData.publicUrl;

        if (postId) {
            await supabase.from('social_posts').update({ image_url: imageUrl }).eq('id', postId);
        }

        return NextResponse.json({ url: imageUrl });

    } catch (error: any) {
        console.error("Upload failed:", error);
        return NextResponse.json({ error: error.message || "Failed to upload image" }, { status: 500 });
    }
}
