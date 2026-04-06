import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    try {
        const { title, excerpt, customPrompt } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Gemini API kľúč nie je nakonfigurovaný" }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        // Use custom prompt directly, or build from article content
        const prompt = customPrompt
            ? `${customPrompt}

CRITICAL INSTRUCTIONS:
- MUST NOT contain specific real-world public figures or trademarked logos.
- Style: Realistic photography, cinematic lighting, highly detailed, professional stock photo style.
- NO text, NO watermarks, NO UI elements.`
            : `Generate a photorealistic, ultra-high quality cinematic image that perfectly captures the essence of this technology news article.
Theme: ${title}
Context: ${excerpt || 'Teaser na článok'}

CRITICAL INSTRUCTIONS TO AVOID ERRORS:
- MUST NOT contain specific real-world public figures (like Elon Musk, Sam Altman, etc.) or trademarked logos. If the article mentions them, generate a generic photorealistic alternative (e.g. "a tech CEO", "a modern AI laboratory", "a futuristic server room").
- Style: Realistic photography, cinematic lighting, highly detailed, professional journalistic stock photo style.
- NO text, NO watermarks, NO UI elements.`;

        const imageResult = await ai.models.generateContent({
            model: 'gemini-2.0-flash-preview-image-generation',
            contents: prompt,
            config: { responseModalities: ["IMAGE", "TEXT"] }
        });

        // Extract image from response parts
        let imageUrl: string | null = null;

        const parts = imageResult.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            const inlineData = (part as any).inlineData;
            if (inlineData?.data) {
                const base64 = inlineData.data;
                const mime = inlineData.mimeType || 'image/jpeg';
                const buffer = Buffer.from(base64, 'base64');
                const ext = mime.includes('png') ? 'png' : 'jpg';
                const filename = `article-generated/${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('social-images')
                    .upload(filename, buffer, { contentType: mime, upsert: true });

                if (uploadError) {
                    console.error("Storage upload error:", uploadError);
                    return NextResponse.json({ error: "Chyba ukladania obrázku: " + uploadError.message }, { status: 500 });
                }
                if (uploadData) {
                    const { data: urlData } = supabase.storage.from('social-images').getPublicUrl(filename);
                    imageUrl = urlData.publicUrl;
                }
                break;
            }
        }

        if (!imageUrl) {
            return NextResponse.json({ error: "Obrázok sa nepodarilo vygenerovať (Gemini nevrátil žiadny obrázok)" }, { status: 500 });
        }

        return NextResponse.json({ imageUrl });

    } catch (error: any) {
        console.error("Article Image generation failed:", error);
        return NextResponse.json({ error: error.message || "Failed to generate image" }, { status: 500 });
    }
}
