import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use service role if available, otherwise anon key (limited functionality)
const supabaseAdmin = createClient(
  supabaseUrl,
  serviceKey || anonKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// GET — list all users from profiles table
export async function GET() {
  try {
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    let users = profiles ?? [];

    // If service role key is available, enrich with auth data (last sign in)
    if (serviceKey) {
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const authMap = new Map(authData?.users?.map((u) => [u.id, u]) ?? []);
        users = users.map((p) => ({
          ...p,
          last_sign_in_at: authMap.get(p.id)?.last_sign_in_at ?? null,
          email_confirmed: authMap.get(p.id)?.email_confirmed_at != null,
        }));
      } catch {
        // Auth admin API failed, continue without enrichment
      }
    }

    return NextResponse.json({ users });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH — update user role
export async function PATCH(req: NextRequest) {
  try {
    const { id, role } = await req.json();
    if (!id || !role) return NextResponse.json({ error: "Missing id or role" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — delete user (requires service role)
export async function DELETE(req: NextRequest) {
  try {
    if (!serviceKey) {
      return NextResponse.json(
        { error: "Mazanie vyžaduje SUPABASE_SERVICE_ROLE_KEY v .env.local" },
        { status: 403 }
      );
    }
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
