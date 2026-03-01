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
    const LEGACY_SECRET = "make-com-webhook-secret";

    try {
        const body = await req.json();
        const { platforms, autoPublish, articleId, secret } = body;

        if (secret !== process.env.ADMIN_SECRET && secret !== LEGACY_SECRET) {
            return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
        }

        if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
            return NextResponse.json({ error: "Missing platforms" }, { status: 400 });
        }

        // 1. Fetch articles
        let availableArticles: { id: string; title: string; excerpt: string; category: string; slug: string; published_at: string; main_image?: string }[] = [];
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        if (articleId) {
            const { data: article, error: articleError } = await supabase
                .from("articles")
                .select("id, title, excerpt, category, slug, published_at, main_image")
                .eq("id", articleId)
                .single();
            if (articleError) throw articleError;
            if (article) availableArticles = [article];
        } else {
            const { data: articles, error: articlesError } = await supabase
                .from("articles")
                .select("id, title, excerpt, category, slug, published_at, main_image")
                .eq("status", "published")
                .gte("published_at", twentyFourHoursAgo)
                .order("published_at", { ascending: false });

            if (articlesError) throw articlesError;
            availableArticles = articles || [];
        }

        // 2. Fetch ALL existing social posts to check for duplicates
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

        // 3. Filter available articles (if not for a specific articleId)
        if (!articleId && availableArticles.length > 0) {
            availableArticles = availableArticles.filter(article => {
                const existsById = allExistingPosts?.some(p => p.article_id === article.id);
                if (existsById) return false;

                const existsByTitle = allExistingPosts?.some(p => {
                    const articlesData = p.articles;
                    const t = Array.isArray(articlesData) ? (articlesData as { title: string }[])[0]?.title : (articlesData as { title: string })?.title;
                    return t?.trim().toLowerCase() === article.title.trim().toLowerCase();
                });
                if (existsByTitle) return false;

                return true;
            });
        }

        if (availableArticles.length === 0) {
            return NextResponse.json({ message: "Nenašli sa žiadne vhodné články na spracovanie.", posts: [] });
        }

        // 4. Select articles (AI or direct)
        let selectedArticles = [];
        if (articleId) {
            selectedArticles = availableArticles;
        } else {
            const selectionPrompt = `Si elitný sociálny stratég pre technologický portál Postovinky. Z nasledujúceho zoznamu správ za posledných 24 hodín vyber PRESNE 4 témy, ktoré sú momentálne NAJVYŠŠOU PRIORITOU.
            
Hľadaj témy, ktoré:
1. Sú najviac relevantné k aktuálnemu svetovému dianiu a technologickým trendom (to, čo sa práve teraz najviac rieši).
2. Majú najväčší informačný prínos a zároveň virálny potenciál.
3. Reprezentujú dôležité míľniky v AI, techu alebo biznise.

DÔLEŽITÉ PRAVIDLÁ:
1. Vyber 4 ROZLIČNÉ témy. Ak je v zozname viac správ o tej istej veci, vyber len tú najzásadnejšiu.
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
            const selectedData = JSON.parse(rawContent || '{"selectedIds": []}');
            const selectedIds = selectedData.selectedIds || [];
            selectedArticles = availableArticles.filter(a => selectedIds.includes(a.id));
        }

        console.log("Processing selected articles, count:", selectedArticles.length);

        // 5. Generate posts
        const generatedPosts = [];
        for (const article of selectedArticles) {
            for (const platform of platforms) {
                // Check if already posted to THIS platform
                const alreadyPosted = allExistingPosts?.some((p: SocialPost) => p.article_id === article.id && p.platform === platform);
                if (alreadyPosted) continue;

                const host = req.headers.get("host") || "postovinky.news";
                const protocol = host.includes("localhost") ? "http" : "https";
                const appUrl = `${protocol}://${host}`;
                const url = `${appUrl}/article/${article.slug}`;

                const promptSystem = `Si šéfredaktor a špičkový social media manažér pre prestížny portál Postovinky. Tvojou úlohou je napísať profesionálny, úderný a stručný príspevok.

PRAVIDLÁ:
1. Jazyk: Profesionálna, moderná slovenčina. Dávaj si obrovský pozor na gramatiku a logický slovosled.
2. Štýl: News-style (spravodajský). Buď vecný, informuj o faktoch z článku.
3. Emodži: PRÍSNY ZÁKAZ. Nepoužívaj žiadne emodži.
4. Štruktúra: 
   - Krátky "hook" (jedna veta max).
   - Jedna až dve vety o tom, čo sa v článku píše (faktograficky).
   - ${platform === 'Instagram' ? "Namiesto linku napíš na konci text 'Link v bio'." : "Čistý link na konci na samostatnom riadku."}
5. Zákaz: Nepoužívaj Markdown. ${platform === 'Instagram' ? "V príspevku nesmie byť žiadna URL adresa." : `Iba čistá URL: ${url}`}

ŠPECIFIKÁCIE PRE PLATFORMY:
- Facebook: Max 3 vety + otázka na vyvolanie diskusie.
- Instagram: Krátky, estetický text, max 3-4 vety. Hashtagy daj na samostatný blok nižšie (max 5 kusov). HASHTAGY MUSIA BYŤ BEZ DIAKRITIKY. Namiesto odkazu použi vetu "Link v bio".
- X (Twitter): Extrémne stručný news-flash.

HASHTAGY: Musia byť trefné a ZÁSADNE BEZ DIAKRITIKY.`;

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

        // 6. Save and optionally publish
        const savedPosts = [];
        const publishedResults = [];
        for (const post of generatedPosts) {
            const { data: savedPost, error: insertError } = await supabase
                .from("social_posts")
                .insert(post)
                .select()
                .single();

            if (insertError) continue;
            savedPosts.push(savedPost);

            if (autoPublish && savedPost) {
                try {
                    // Call our specialized publishing API to ensure we follow the EXACT same logic
                    // as the manual "Publish" button (storage buffering, FB link logic, etc.)
                    const host = req.headers.get("host") || "postovinky.news";
                    const protocol = host.includes("localhost") ? "http" : "https";
                    const publishEndpoint = `${protocol}://${host}/api/admin/publish-social-post`;

                    console.log(`>>> [Social Autopilot] Auto-publishing ${post.platform} (ID: ${savedPost.id}) via ${publishEndpoint}...`);

                    const publishRes = await fetch(publishEndpoint, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            id: savedPost.id,
                            secret: LEGACY_SECRET
                        })
                    });

                    const publishData = await publishRes.json();

                    if (publishRes.ok) {
                        publishedResults.push({ id: savedPost.id, platform: post.platform, success: true });
                    } else {
                        throw new Error(publishData.error || "Publishing failed");
                    }
                } catch (publishError: unknown) {
                    const errMsg = publishError instanceof Error ? publishError.message : String(publishError);
                    console.error(`>>> [Social Autopilot] Auto-publish failed for ${post.platform}:`, errMsg);
                    publishedResults.push({ id: savedPost.id, platform: post.platform, success: false, error: errMsg });
                }
            }
        }

        return NextResponse.json({
            message: autoPublish ? "Príspevky boli vygenerované a spracované." : "Príspevky boli uložené ako koncepty.",
            posts: savedPosts,
            publishResults: publishedResults
        });

    } catch (error: unknown) {
        console.error("Social autopilot failed:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}
