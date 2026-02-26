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

        const promptSystem = `Si špičkový social media manažér pre seriózny technologický a AI portál Postovinky. Tvojou úlohou je napísať profesionálny, úderný a stručný príspevok.

PRAVIDLÁ:
1. Jazyk: Profesionálna, moderná slovenčina (žiadne klišé ako "pozor", "máme tu", "uži si").
2. Štýl: News-style (spravodajský). Buď vecný, informuj o faktoch z článku.
3. Emodži: MAXIMÁLNE 1-2 v celom texte. Používaj len decentné (napr. 🛡️, 💻, 🚀). Žiadne ohníky, smajlíky ani party konfety.
4. Štruktúra: 
   - Krátky "hook" (jedna veta max).
   - Jedna až dve vety o tom, čo sa v článku píše (faktograficky).
   - Čistý link na konci na samostatnom riadku.
5. Zákaz: Nepoužívaj Markdown ([text](url)). Iba čistá URL: ${url}

ŠPECIFIKÁCIE PRE PLATFORMY:
- Facebook: Max 3 vety + otázka na vyvolanie diskusie. Celkovo max 2 emodži.
- Instagram: Krátky, estetický text, max 3-4 vety. Hashtagy daj na samostatný blok nižšie (max 5 kusov).
- X (Twitter): Extrémne stručný news-flash. Max 1 emodži.

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
