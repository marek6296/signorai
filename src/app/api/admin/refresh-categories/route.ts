import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60; // Set maximum execution time on Vercel to 60s for bulk processing
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { secret, articleIds } = await request.json();

        if (secret !== process.env.ADMIN_SECRET) {
            return NextResponse.json({ message: "Invalid token" }, { status: 401 });
        }

        if (!Array.isArray(articleIds) || articleIds.length === 0) {
            return NextResponse.json({ message: "No articles provided" }, { status: 400 });
        }

        // Fetch articles
        const { data: articles, error: fetchError } = await supabase
            .from('articles')
            .select('id, title, excerpt')
            .in('id', articleIds);

        if (fetchError || !articles) {
            return NextResponse.json({ message: "Error fetching articles", error: fetchError }, { status: 500 });
        }

        const results = await Promise.allSettled(articles.map(async (article) => {
            const promptSystem = `Pred sebou máš názov a perex technologického/spravodajského článku v slovenčine. 
Tvojou jedinou úlohou je vrátiť EXAKTNE JEDEN kľúč kategórie v JSON formáte na základe tém:

KATEGÓRIE NA VÝBER:
- Novinky SK/CZ
- Umelá Inteligencia
- Tech
- Biznis
- Krypto
- Svet
- Politika
- Veda
- Gaming
- Návody & Tipy

Pravidlá určovania:
- Ak ide o Slovensko alebo Česko, automaticky zvoľ "Novinky SK/CZ" (je to priorita!)
- Ak ide o Bitcoin/krypto, zvoľ "Krypto".
- Ak ide o AI/LLM, zvoľ "Umelá Inteligencia".
- Ak ide o hry a konzoly, zvoľ "Gaming".

Výstup musí byť STRICT JSON formát:
{
    "category": "Názov Kategórie"
}

Nepíš žiadne iné slová okolo.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o", // using gpt-4o for high accuracy
                messages: [
                    { role: "system", content: promptSystem },
                    { role: "user", content: `Názov: ${article.title}\n\nPerex: ${article.excerpt}` }
                ],
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0].message.content;
            if (!content) throw new Error("Empty AI response");

            const parsed = JSON.parse(content);
            const category = parsed.category || "Nezaradené";

            // Update in DB
            const { error: updateError } = await supabase.from('articles').update({ category }).eq('id', article.id);
            if (updateError) throw updateError;

            return { id: article.id, category };
        }));

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        console.log("Refresh categories results:", results);

        return NextResponse.json({
            message: `Úspešne pre-kategorizovaných ${successCount} z ${articleIds.length} článkov.`,
            successCount,
            total: articleIds.length
        });

    } catch (error: unknown) {
        console.error("Refresh categories API error:", error);
        return NextResponse.json({ message: (error as Error).message || "Internal Error" }, { status: 500 });
    }
}
