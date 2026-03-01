import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_SECRET = process.env.ADMIN_SECRET || "make-com-webhook-secret";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { articleIds, mode, secret } = body as { articleIds: string[]; mode: 'auto' | 'suggest'; secret: string };

        if (!secret || secret !== ADMIN_SECRET) {
            return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
        }

        if (!articleIds || articleIds.length === 0) {
            return NextResponse.json({ message: "No articles selected" }, { status: 400 });
        }

        // Fetch articles
        const { data: articles, error: fetchError } = await supabase
            .from('articles')
            .select('id, title, excerpt')
            .in('id', articleIds);

        if (fetchError || !articles) {
            throw new Error("Nepodarilo sa načítať články");
        }

        // Helper to ask GPT for an image search query
        const { getOpenAIClient } = await import("@/lib/generate-logic");
        const getSearchQuery = async (title: string, excerpt: string) => {
            const res = await getOpenAIClient().chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "Si expert na promptovanie a vyhľadávanie obrázkov. Pre zadaný nadpis a úryvok článku vymysli a vráť JEDEN krátky, presný ANGLICKÝ výraz (max 3-4 slová) na vyhľadanie ilustračnej, profesionálnej, kvalitnej fotky vo vysokom rozlíšení do Googlu. Vráť LEN TENTO VÝRAZ, žiadne úvodzovky ani zbytočné texty okolo."
                    },
                    { role: "user", content: `Title: ${title}\nExcerpt: ${excerpt || ""}` }
                ],
                temperature: 0.3
            });
            const q = res.choices[0].message.content?.trim().replace(/^"|"$/g, '') || title;
            return q;
        };

        // If suggest mode: return up to 8 images for 1 article
        if (mode === 'suggest') {
            if (articles.length !== 1) {
                return NextResponse.json({ message: "Suggest mode allows only 1 article" }, { status: 400 });
            }
            const article = articles[0];
            const query = await getSearchQuery(article.title, article.excerpt);

            console.log(`>>> [Refresh Images] Suggest mode for "${query}"`);

            // Call Serper manually for multiple
            const serperKey = process.env.SERPER_API_KEY;
            if (!serperKey) throw new Error("Missing SERPER_API_KEY");

            const response = await fetch("https://google.serper.dev/images", {
                method: "POST",
                headers: {
                    "X-API-KEY": serperKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ q: query, gl: "us", hl: "en", num: 20 }),
            });
            const data = await response.json();
            let images: string[] = [];
            interface SerperImage {
                imageUrl: string;
                imageWidth?: number;
                imageHeight?: number;
            }
            if (data.images && data.images.length > 0) {
                images = (data.images as SerperImage[])
                    .filter(img => img.imageUrl && img.imageUrl.startsWith('http') && !img.imageUrl.includes('fbsbx') && !img.imageUrl.includes('licdn') && !img.imageUrl.includes('lookaside'))
                    .sort((a, b) => (b.imageWidth || 0) - (a.imageWidth || 0))
                    .map(img => img.imageUrl)
                    .slice(0, 10);
            }

            return NextResponse.json({ articleId: article.id, title: article.title, images });
        }


        // Auto mode: update each article
        const { searchImage } = await import("@/lib/generate-logic");
        let successCount = 0;

        for (const article of articles) {
            try {
                const query = await getSearchQuery(article.title, article.excerpt);
                console.log(`>>> [Refresh Images] Auto mode for "${query}"`);
                const newImageUrl = await searchImage(query);

                if (newImageUrl) {
                    const { error: updateError } = await supabase
                        .from('articles')
                        .update({ main_image: newImageUrl })
                        .eq('id', article.id);

                    if (!updateError) {
                        successCount++;
                    } else {
                        console.error(`Error updating DB for ${article.id}:`, updateError);
                    }
                }
            } catch (err) {
                console.error(`Failed to refresh image for ${article.title}:`, err);
            }
        }

        return NextResponse.json({
            message: `Úspešne priradených ${successCount} z ${articleIds.length} nových obrázkov.`,
            successCount,
            total: articleIds.length
        });

    } catch (error: unknown) {
        console.error("Refresh images API error:", error);
        return NextResponse.json({ message: (error as Error).message || "Internal Error" }, { status: 500 });
    }
}
