import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { email, name, source } = await req.json();
    if (!email) return NextResponse.json({ error: "Email je povinný" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .upsert({ email, name: name ?? null, source: source ?? "website", subscribed: true, subscribed_at: new Date().toISOString() }, { onConflict: "email" });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
