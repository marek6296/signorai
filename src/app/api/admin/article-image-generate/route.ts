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

        const apiKey = process.env.GEMINI_API_KEY || "AIzaSyBwslaqe7TRYOwgEtmMbNxbjDJcbVSr5K4";

        if (!apiKey) {
            return NextResponse.json({ error: "Gemini API kľúč nie je nakonfigurovaný" }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        // Use custom prompt directly, or build from article content
        const prompt = customPrompt
            ? `${customPrompt}

STYLE — editorial/documentary photography:
- Real-world environment, natural or professional studio lighting
- STRICT PROHIBITIONS: NO glowing orbs, NO neon lights, NO energy balls, NO electric lightning, NO sci-fi particles, NO holographic displays, NO abstract blue/purple energy waves, NO CGI "AI visualization" clichés
- NO text, NO watermarks, NO trademarked logos, NO real celebrities.`
            : `Generate a photorealistic, editorial-quality photograph for a technology news article header.
Topic: ${title}
Context: ${excerpt || ''}

STYLE — think Associated Press or Reuters editorial photograph:
- Real-world environment: corporate office, conference room, data center, product launch stage, university lab, city skyline
- Natural or professional studio lighting
- People using technology, engineers at work, product close-ups, office environments, company buildings

STRICT PROHIBITIONS (generate NONE of these):
- Glowing orbs, energy balls, plasma spheres
- Neon lights, neon glow, neon-lit rooms
- Electric lightning, sparks, electrical arcs
- Sci-fi particle systems, floating particles, light streams
- Abstract blue/purple energy waves
- Holographic overlays, holographic displays
- Futuristic fantasy environments, CGI "AI visualization" clichés

OUTPUT: 16:9 landscape, NO text, NO watermarks, NO trademarked logos, NO real celebrities.`;

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
