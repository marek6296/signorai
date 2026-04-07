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

        const facebookRules = `FACEBOOK — pravidlá:
- 2-3 krátke, factografické vety priamo z článku
- Žiadne otázky, výzvy k diskusii ani CTA ("Diskutujte", "Čo myslíte", "Myslíte si, že")
- Žiadne superlativy ani senzacionalizmus
- Zakončenie: kľúčový fakt alebo insight z článku
- BEZ URL v texte — link sa pridá automaticky`;

        const instagramRules = `INSTAGRAM — pravidlá:
- 3-4 vety, faktografický, čistý štýl
- Žiadne otázky ani výzvy k diskusii
- Na konci poslednej vety: "Link v bio."
- Nový riadok, potom hashtagy (8-10 kusov, BEZ DIAKRITIKY)
- Hashtagy: mix broad (#AI #tech) + tematické (#machinelearning #aitools #ainews)
- Príklady vhodných tagov: #artificialintelligence #AI #machinelearning #technologia #ainews #aitools #deeplearning #innovation #tech #openai #llm #airesearch`;

        const promptSystem = `Si novinár a social media editor prestížneho AI & Tech portálu AIWai. Píšeš príspevky v štýle The Verge, Wired a MIT Technology Review — presné, informatívne, bez senzacionalizmu.

ZÁVÄZNÉ PRAVIDLÁ:
1. Jazyk: Prirodzená profesionálna slovenčina. Žiadne klišé, žiadne bohemizmy.
2. Štýl: Čisto spravodajský. Fakty, nie marketing.
3. ZÁKAZ emodži, smajlíkov a grafických symbolov.
4. ZÁKAZ Markdown formátovania.
5. ZÁKAZ diskusných otázok a CTA ("Diskutujte", "Čo myslíte?", "Myslíte si, že...", "Diskutujme").
6. ZÁKAZ superlativov a senzacionalizmu ("revolúcia", "neuveriteľné", "navždy zmení").
7. ${platform === 'Instagram' ? "Žiadna URL v texte príspevku." : "NIKDY nevkladaj URL do textu — link sa pridá automaticky."}

PLATFORMA:
${platform === 'Facebook' ? facebookRules : ''}
${platform === 'Instagram' ? instagramRules : ''}
${platform === 'X' ? 'X (Twitter): Max 2 vety, news-flash štýl. Hashtagy (3-4, BEZ DIAKRITIKY) na konci.' : ''}`;

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
