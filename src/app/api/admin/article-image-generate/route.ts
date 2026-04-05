import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    try {
        const { title, excerpt } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY || "AIzaSyBwslaqe7TRYOwgEtmMbNxbjDJcbVSr5K4";
        
        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            return NextResponse.json({ error: "Gemini API kľúč nie je nakonfigurovaný" }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `Generate a highly professional, cinematic, and modern editorial image for a technology/AI news article.
Article Title: ${title}
Context: ${excerpt || 'Teaser na článok'}

REQUIREMENTS:
- Style: Ultra-high quality, tech-focused editorial illustration or photorealistic render, vibrant colors but serious journalistic tone.
- Cinematic or dramatic lighting, high detail.
- NO text, NO watermarks, NO UI elements, NO logos on the image itself.
- Aspect ratio: Widescreen 16:9 for article header/thumbnail.`;

        const imageResult = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ],
            config: {
                // @ts-ignore
                responseModalities: ["IMAGE"],
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
                        // Saving to articles bucket or generated images bucket
                        const filename = `article-generated/${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
                        
                        // Let's use the social-images bucket as it is confirmed to work publicly
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

        return NextResponse.json({ imageUrl });

    } catch (error: any) {
        console.error("Article Image generation failed:", error);
        return NextResponse.json({ error: error.message || "Failed to generate image" }, { status: 500 });
    }
}
