import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    try {
        const { topic, articleTitle, postId } = await req.json();

        // Optional API key injected from client or env
        const apiKey = process.env.GEMINI_API_KEY || "AIzaSyBwslaqe7TRYOwgEtmMbNxbjDJcbVSr5K4";
        
        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            return NextResponse.json({ error: "Gemini API kľúč nie je nakonfigurovaný" }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `Generate a highly professional, modern, and engaging marketing image for a news portal social media post.
Theme / Topic: ${topic || articleTitle || 'Teaser na článok'}

REQUIREMENTS:
- Style: Tech-focused, modern editorial, vibrant but professional colors.
- High quality, sharp, cinematic lighting.
- NO text, NO watermarks, NO icons or logos on the image itself.
- Square 1:1 format optimized for Instagram/Facebook.`;

        const imageResult = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ],
            config: {
                // @ts-ignore
                responseModalities: ["IMAGE"]
            }
        });

        // Extract image from response parts
        let imageUrl: string | null = null;
        if (imageResult.candidates?.[0]?.content?.parts) {
            for (const part of imageResult.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64 = part.inlineData.data;
                    const mime = part.inlineData.mimeType || 'image/png';
                    
                    if (base64) {
                        const buffer = Buffer.from(base64, 'base64');
                        const ext = mime.includes('png') ? 'png' : 'jpg';
                        const filename = `generated/${postId || Date.now()}-${Date.now()}.${ext}`;
                        
                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('social-images')
                            .upload(filename, buffer, { contentType: mime, upsert: true });

                        if (uploadError) {
                            console.error("Storage upload error:", uploadError);
                            return NextResponse.json({ error: "Chyba ukladania obrázku do úložiska" }, { status: 500 });
                        }

                        if (uploadData) {
                            const { data: urlData } = supabase.storage.from('social-images').getPublicUrl(filename);
                            imageUrl = urlData.publicUrl;
                        }
                        break;
                    }
                }
            }
        }

        if (!imageUrl) {
            return NextResponse.json({ error: "Obrázok sa nepodarilo vygenerovať" }, { status: 500 });
        }

        // If postId is provided, update it automatically
        if (postId) {
            await supabase.from('social_posts').update({ image_url: imageUrl }).eq('id', postId);
        }

        return NextResponse.json({ imageUrl });

    } catch (error: any) {
        console.error("Image generation failed:", error);
        return NextResponse.json({ error: error.message || "Failed to generate image" }, { status: 500 });
    }
}
