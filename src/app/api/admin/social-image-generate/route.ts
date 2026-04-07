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

        // Use API key from environment
        const apiKey = process.env.GEMINI_API_KEY || "AIzaSyBwslaqe7TRYOwgEtmMbNxbjDJcbVSr5K4";
        
        if (!apiKey) {
            return NextResponse.json({ error: "Gemini API kľúč nie je nakonfigurovaný" }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `Generate a photorealistic, ultra-high quality marketing image that perfectly captures the essence of this news portal social media post.
Theme: ${topic || articleTitle || 'Teaser na článok'}

CRITICAL INSTRUCTIONS TO AVOID ERRORS:
- MUST NOT contain specific real-world public figures (like Elon Musk, Sam Altman, etc.) or trademarked logos. If the article mentions them, generate a generic photorealistic alternative (e.g. "a tech CEO", "a modern server room", "a high-tech office").
- Style: Realistic photography, sharp focus, professional marketing style.
- NO text, NO watermarks, NO UI elements.`;

        const imageResult = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: prompt,
            config: {
                // @ts-ignore
                aspectRatio: "1:1",
                personGeneration: "ALLOW_ADULT"
            }
        });

        // Extract image from response parts
        let imageUrl: string | null = null;
        let debugInfo: any = {};
        
        try {
            debugInfo.hasCandidates = !!imageResult.candidates;
            debugInfo.candidateCount = imageResult.candidates?.length;
            debugInfo.finishReason = imageResult.candidates?.[0]?.finishReason;
            debugInfo.hasParts = !!imageResult.candidates?.[0]?.content?.parts;
            debugInfo.partsCount = imageResult.candidates?.[0]?.content?.parts?.length;
        } catch (e) {
            console.error("Debug info extraction failed:", e);
        }

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
                            return NextResponse.json({ error: "Chyba ukladania obrázku do úložiska: " + uploadError.message }, { status: 500 });
                        }

                        if (uploadData) {
                            const { data: urlData } = supabase.storage.from('social-images').getPublicUrl(filename);
                            imageUrl = urlData.publicUrl;
                        }
                        break;
                    }
                } else if (part.text) {
                    debugInfo.containedText = part.text;
                    console.log("Image gen returned text instead:", part.text);
                }
            }
        }

        if (!imageUrl) {
            return NextResponse.json({ 
                error: `Obrázok sa nepodarilo vygenerovať. Debug: ${JSON.stringify(debugInfo)}` 
            }, { status: 500 });
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
