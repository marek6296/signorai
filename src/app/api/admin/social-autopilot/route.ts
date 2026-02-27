import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SocialPost {
    article_id: string;
    platform: string;
    status: string;
    articles?: {
        title: string;
    } | {
        title: string;
    }[];
}

export async function POST(req: Request) {
    try {
        const { platforms } = await req.json();

        if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
            return NextResponse.json({ error: "Missing platforms" }, { status: 400 });
        }

        // 1. Fetch articles from last 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: articles, error: articlesError } = await supabase
            .from("articles")
            .select("id, title, excerpt, category, slug, published_at")
            .eq("status", "published")
            .gte("published_at", twentyFourHoursAgo)
            .order("published_at", { ascending: false });

        if (articlesError) throw articlesError;

        // 2. Fetch ALL existing social posts with article titles to check for near-duplicates
        const { data: allExistingPostsRaw, error: postsError } = await supabase
            .from("social_posts")
            .select(`
                article_id, 
                platform, 
                status,
                articles (
                    title
                )
            `);

        if (postsError) throw postsError;
        const allExistingPosts = allExistingPostsRaw as unknown as SocialPost[];

        // 3. Filter out articles:
        // - Exclude if the article ID is already in the planner
        // - Exclude if an article with the EXACT same title is already in the planner
        const availableArticles = (articles || []).filter(article => {
            // 1. Check by ID
            const existsById = allExistingPosts?.some(p => p.article_id === article.id);
            if (existsById) return false;

            // 2. Check by Title (to avoid suggesting the same story if it was re-published with new ID)
            const existsByTitle = allExistingPosts?.some(p => {
                const articlesData = p.articles;
                const t = Array.isArray(articlesData) ? articlesData[0]?.title : articlesData?.title;
                return t?.trim().toLowerCase() === article.title.trim().toLowerCase();
            });
            if (existsByTitle) return false;

            return true;
        });

        console.log("Found available articles:", availableArticles.length);

        if (availableArticles.length === 0) {
            return NextResponse.json({ message: "Všetky aktuálne témy už máš v plánovači.", posts: [] });
        }

        // 4. Use AI to select the most interesting articles
        const selectionPrompt = `Si elitný sociálny stratég pre technologický portál. Z nasledujúceho zoznamu správ za posledných 24 hodín vyber PRESNE 4 témy, ktoré sú najviac "clickbait" (majú najväčší potenciál zaujať).
        
DÔLEŽITÉ PRAVIDLÁ:
1. Vyber 4 ROZLIČNÉ témy. Ak je v zozname viac správ o tej istej veci (napr. 2 správy o tom istom politikovi alebo tej istej kauze), vyber z nich len tú najlepšiu.
2. Odpovedaj len v JSON formáte.

Zoznam článkov:
${availableArticles.map((a, i) => `${i}. ID: ${a.id} | Názov: ${a.title} | Kategória: ${a.category}`).join("\n")}

ODPOVEDAJ LEN VO FORMÁTE JSON:
{ "selectedIds": ["id1", "id2", "id3", "id4"] }`;

        const selectionCompletion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: selectionPrompt }],
            response_format: { type: "json_object" }
        });

        const rawContent = selectionCompletion.choices[0].message.content;
        console.log("AI selection response:", rawContent);
        const selectedData = JSON.parse(rawContent || '{"selectedIds": []}');
        const selectedIds = selectedData.selectedIds || [];

        console.log("Selected IDs by AI:", selectedIds);

        const selectedArticles = availableArticles.filter(a => selectedIds.includes(a.id));
        console.log("Filtering selected articles, found:", selectedArticles.length);

        // 5. Generate posts for each selected article and platform
        const generatedPosts = [];

        for (const article of selectedArticles) {
            for (const platform of platforms) {
                // Check if already posted to THIS platform
                const alreadyPosted = allExistingPosts?.some((p: SocialPost) => p.article_id === article.id && p.platform === platform);
                if (alreadyPosted) continue;

                const url = `https://postovinky.news/article/${article.slug}`;

                const promptSystem = `Si špičkový social media manažér pre seriózny technologický a AI portál Postovinky. Tvojou úlohou je napísať profesionálny, úderný a stručný príspevok.

PRAVIDLÁ:
1. Jazyk: Profesionálna, moderná slovenčina (žiadne klišé ako "pozor", "máme tu", "uži si").
2. Štýl: News-style (spravodajský). Buď vecný, informuj o faktoch z článku.
3. Emodži: PRÍSNY ZÁKAZ. Nepoužívaj žiadne emodži, smajlíky ani grafické symboly.
4. Štruktúra: 
   - Krátky "hook" (jedna veta max).
   - Jedna až dve vety o tom, čo sa v článku píše (faktograficky).
   - Čistý link na konci na samostatnom riadku.
5. Zákaz: Nepoužívaj Markdown ([text](url)). Iba čistá URL: ${url}

ŠPECIFIKÁCIE PRE PLATFORMY:
- Facebook: Max 3 vety + otázka na vyvolanie diskusie.
- Instagram: Krátky, estetický text, max 3-4 vety. Hashtagy daj na samostatný blok nižšie (max 5 kusov).
- X (Twitter): Extrémne stručný news-flash.

Príspevok nesmie znieť ako reklama, ale ako správa.`;

                const promptUser = `Vytvor príspevok na ${platform} pre tento článok:
Názov: ${article.title}
Perex: ${article.excerpt}`;

                const postCompletion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: promptSystem },
                        { role: "user", content: promptUser }
                    ],
                });

                const content = postCompletion.choices[0].message.content;

                generatedPosts.push({
                    article_id: article.id,
                    platform,
                    content,
                    status: 'draft'
                });
            }
        }

        // 6. Save to DB automatically
        if (generatedPosts.length > 0) {
            const { error: insertError } = await supabase
                .from("social_posts")
                .insert(generatedPosts);

            if (insertError) {
                console.error("Failed to save posts to DB:", insertError);
            }
        }

        return NextResponse.json({ posts: generatedPosts });

    } catch (error: unknown) {
        console.error("Social autopilot failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
