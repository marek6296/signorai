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
            model: 'gemini-3.1-flash-image-preview',
            contents: prompt,
            config: {
                // @ts-ignore
                aspectRatio: "16:9",
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
                        // Saving to articles bucket or generated images bucket
                        const filename = `article-generated/${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
                        
                        // Let's use the social-images bucket as it is confirmed to work publicly
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

        return NextResponse.json({ imageUrl });

    } catch (error: any) {
        console.error("Article Image generation failed:", error);
        return NextResponse.json({ error: error.message || "Failed to generate image" }, { status: 500 });
    }
}
