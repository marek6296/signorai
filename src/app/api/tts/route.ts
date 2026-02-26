import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { text, voiceId = "dlGxemPxFMTY7iXagmOj" } = await req.json();
        console.log(">>> [TTS] Text length:", text?.length);

        if (!text) {
            return NextResponse.json({ error: "Text is required" }, { status: 400 });
        }

        const apiKey = process.env.ELEVENLABS_API_KEY;
        console.log(">>> [TTS] API Key present:", !!apiKey);
        if (!apiKey) {
            return NextResponse.json({ error: "ELEVENLABS_API_KEY is not set" }, { status: 500 });
        }

        // ElevenLabs TTS API call
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "xi-api-key": apiKey,
                },
                body: JSON.stringify({
                    text,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error(">>> [TTS] ElevenLabs Error:", response.status, errorData);
            return NextResponse.json(
                { error: errorData.detail?.message || "Failed to generate audio" },
                { status: response.status }
            );
        }

        // Proxy the audio stream
        const audioBuffer = await response.arrayBuffer();
        return new NextResponse(audioBuffer, {
            headers: {
                "Content-Type": "audio/mpeg",
            },
        });
    } catch (error) {
        console.error("TTS Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
