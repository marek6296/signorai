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

        const promptSystem = `Si expert na sociálne siete a copywriting pre technologický portál Postovinky. 
Tvojou úlohou je vytvoriť pútavý príspevok na sociálnu sieť pre zadaný článok.

PRAVIDLÁ:
1. Jazyk: Dokonalá slovenčina.
2. Štýl: Pútavý, moderný, vzbudzujúci zvedavosť (clicky ale nie spam).
3. Platforma: ${platform}

ŠPECIFIKÁCIE PRE PLATFORMY:
- Facebook: Dlhší text, diskusná otázka na konci, pár emodži, link na článok.
- Instagram: Silný háčik na začiatku, pútavý stred, skupina hashtagov na konci (8-12), link spomenúť ako "v BIO" alebo priamo.
- X (Twitter): Krátky, úderný text, max 280 znakov (vrátane linku), 2-3 hashtagy.

Vždy zahrň link na článok: ${url}`;

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
