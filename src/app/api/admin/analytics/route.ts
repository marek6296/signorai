import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
    const today = new Date().toISOString().split("T")[0];

    // Run all queries in parallel
    const [
      totalCountRes,
      uniqueVisitorsRes,
      todayCountRes,
      todayUniqueRes,
      dailyStatsRes,
      topPagesRes,
      countriesRes,
      devicesRes,
      browsersRes,
      recentVisitsRes,
      allTimeCountRes,
      usersRes,
      usersByRoleRes,
      newsletterRes,
      newsletterBySourceRes,
    ] = await Promise.all([
      // Total visits last 30 days
      supabaseAdmin
        .from("site_visits")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgoISO),

      // Unique visitors last 30 days (via RPC or count distinct workaround)
      supabaseAdmin.rpc("count_unique_visitors", { since: thirtyDaysAgoISO }).maybeSingle(),

      // Today visits
      supabaseAdmin
        .from("site_visits")
        .select("*", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00`),

      // Today unique
      supabaseAdmin.rpc("count_unique_visitors", { since: `${today}T00:00:00` }).maybeSingle(),

      // Daily stats — aggregated by day
      supabaseAdmin.rpc("daily_visit_stats", { days_back: 30 }),

      // Top pages
      supabaseAdmin.rpc("top_pages", { days_back: 30, max_rows: 10 }),

      // Countries
      supabaseAdmin.rpc("visit_countries", { days_back: 30 }),

      // Devices
      supabaseAdmin.rpc("visit_devices", { days_back: 30 }),

      // Browsers
      supabaseAdmin.rpc("visit_browsers", { days_back: 30 }),

      // Recent visits — last 50
      supabaseAdmin
        .from("site_visits")
        .select("path, visitor_id, country, device, browser, created_at, referrer")
        .order("created_at", { ascending: false })
        .limit(50),

      // All-time total count
      supabaseAdmin
        .from("site_visits")
        .select("*", { count: "exact", head: true }),

      // Registered users
      supabaseAdmin
        .from("profiles")
        .select("id, email, full_name, role, created_at, avatar_url")
        .order("created_at", { ascending: false })
        .limit(20),

      // Users by role (count)
      supabaseAdmin.rpc("users_by_role"),

      // Newsletter count
      supabaseAdmin
        .from("newsletter_subscribers")
        .select("*", { count: "exact", head: true })
        .eq("subscribed", true),

      // Newsletter by source
      supabaseAdmin.rpc("newsletter_by_source"),
    ]);

    return NextResponse.json({
      totalVisits: totalCountRes.count ?? 0,
      uniqueVisitors: uniqueVisitorsRes.data?.count ?? 0,
      todayVisits: todayCountRes.count ?? 0,
      todayUnique: todayUniqueRes.data?.count ?? 0,
      allTimeVisits: allTimeCountRes.count ?? 0,
      dailyStats: dailyStatsRes.data ?? [],
      topPages: topPagesRes.data ?? [],
      countries: countriesRes.data ?? [],
      devices: devicesRes.data ?? [],
      browsers: browsersRes.data ?? [],
      recentVisits: recentVisitsRes.data ?? [],
      registeredUsers: usersRes.data ?? [],
      usersByRole: usersByRoleRes.data ?? [],
      newsletterCount: newsletterRes.count ?? 0,
      newsletterBySource: newsletterBySourceRes.data ?? [],
    });
  } catch (err: unknown) {
    console.error("Analytics API error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
