import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    try {
        const { imageUrl, prompt, postId } = await req.json();

        if (!imageUrl || !prompt) {
            return NextResponse.json({ error: 'imageUrl a prompt sú povinné' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'API kľúč nie je nakonfigurovaný' }, { status: 500 });
        }

        // 1. Fetch the source image and convert to base64
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) return NextResponse.json({ error: 'Nepodarilo sa stiahnuť zdrojový obrázok na editáciu' }, { status: 400 });
        
        const imgBuf = await imgRes.arrayBuffer();
        const base64 = Buffer.from(imgBuf).toString('base64');
        const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

        const ai = new GoogleGenAI({ apiKey });

        const editPrompt = `Uprav tento marketingový obrázok podľa nasledujúcej inštrukcie:

${prompt}

Dôležité:
- Zachovaj celkovú kompozíciu a tému obrázka
- Aplikuj požadované zmeny čo najpresnejšie
- Výsledok musí byť profesionálna marketingová / spravodajská fotografia
- Štvorec 1:1 formát
- Bez textu, loga alebo vodoznaku`;

        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: [
                {
                    parts: [
                        { inlineData: { mimeType, data: base64 } },
                        { text: editPrompt },
                    ]
                }
            ],
            config: { 
                // @ts-ignore
                responseModalities: ['IMAGE'] 
            },
        });

        if (result.candidates?.[0]?.content?.parts) {
            for (const part of result.candidates[0].content.parts) {
                if (part.inlineData) {
                    const imageBase64 = part.inlineData.data;
                    const mime = part.inlineData.mimeType || 'image/png';
                    
                    if (imageBase64) {
                        const buffer = Buffer.from(imageBase64, 'base64');
                        const ext = mime.includes('png') ? 'png' : 'jpg';
                        const filename = `edited/${postId || Date.now()}_edited_${Date.now()}.${ext}`;
                        
                        const { data: uploadData } = await supabase.storage
                            .from('social-images')
                            .upload(filename, buffer, { contentType: mime, upsert: true });
                            
                        if (uploadData) {
                            const { data: urlData } = supabase.storage.from('social-images').getPublicUrl(filename);
                            
                            if (postId) {
                                await supabase.from('social_posts').update({ image_url: urlData.publicUrl }).eq('id', postId);
                            }
                            
                            return NextResponse.json({ imageUrl: urlData.publicUrl });
                        }
                    }
                }
            }
        }

        return NextResponse.json({ error: 'Nepodarilo sa upraviť obrázok z AI odpovede' }, { status: 500 });
    } catch (err: any) {
        console.error('Edit image error:', err);
        return NextResponse.json({ error: err.message || 'Chyba pri úprave obrázku' }, { status: 500 });
    }
}
