import { NextRequest, NextResponse } from "next/server";
import { runBotCycle, BotConfig } from "@/lib/bot-cycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LEGACY_SECRET = "make-com-webhook-secret";

/**
 * Manual bot run endpoint — called from the admin UI "Spustiť" button.
 * Accepts a full bot config and runs one cycle.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, bot } = body ?? {};

    if (secret !== process.env.ADMIN_SECRET && secret !== LEGACY_SECRET) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!bot || !bot.id) {
      return NextResponse.json({ message: "bot config je povinný" }, { status: 400 });
    }

    const result = await runBotCycle(bot as BotConfig);

    if (!result.success) {
      return NextResponse.json({ message: result.error || "Chyba pri generovaní" }, { status: 500 });
    }

    return NextResponse.json({ success: true, articleId: result.articleId, title: result.articleTitle });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Neznáma chyba";
    return NextResponse.json({ message: msg, error: true }, { status: 500 });
  }
}
