import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { title, excerpt, url, platform } = await req.json();

        if (!title || !url || !platform) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const facebookRules = `- Facebook: Max 2-3 vety + 1 otázka na diskusiu. ŽIADNA URL v texte — link na článok sa pridá automaticky ako karta pod príspevkom.`;
        const instagramRules = `- Instagram: Krátky text, max 3-4 vety. Na konci napíš "Link v bio." Hashtagy daj na samostatný blok nižšie (max 5 kusov, BEZ DIAKRITIKY).`;

        const promptSystem = `Si špičkový social media manažér pre seriózny technologický a AI portál AIWai. Tvojou úlohou je napísať profesionálny, úderný a stručný príspevok.

PRAVIDLÁ:
1. Jazyk: Profesionálna, moderná slovenčina (žiadne klišé ako "pozor", "máme tu", "uži si").
2. Štýl: News-style (spravodajský). Buď vecný, informuj o faktoch z článku.
3. Emodži: PRÍSNY ZÁKAZ. Nepoužívaj žiadne emodži, smajlíky ani grafické symboly.
4. Zákaz: Nepoužívaj Markdown ([text](url)).
5. ${platform === 'Instagram' ? "V príspevku nesmie byť žiadna URL adresa." : "V texte príspevku NESMIE byť žiadna URL adresa. Link sa pridá automaticky."}

ŠPECIFIKÁCIE:
${platform === 'Facebook' ? facebookRules : ''}
${platform === 'Instagram' ? instagramRules : ''}
${platform === 'X' ? '- X (Twitter): Extrémne stručný news-flash. HASHTAGY BEZ DIAKRITIKY.' : ''}

HASHTAGY (len pre Instagram/X): Zásadne BEZ DIAKRITIKY (napr. #technologia namiesto #technológia).
Príspevok nesmie znieť ako reklama, ale ako správa.`;

        const promptUser = `Vytvor príspevok na ${platform} pre tento článok:
Názov: ${title}
Perex: ${excerpt}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: promptSystem },
                { role: "user", content: promptUser }
            ],
        });

        const socialPost = completion.choices[0].message.content;

        return NextResponse.json({ socialPost });

    } catch (error: unknown) {
        console.error("Social post generation failed:", error);
        return NextResponse.json({ error: "Failed to generate social post" }, { status: 500 });
    }
}
