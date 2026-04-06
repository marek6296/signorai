import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get top paths from site_visits last 7 days
  const { data: visits } = await supabase
    .from("site_visits")
    .select("path")
    .gte("created_at", sevenDaysAgo.toISOString())
    .like("path", "/article/%");

  if (!visits || visits.length === 0) {
    // Fallback: get recent articles
    const { data: recent } = await supabase
      .from("articles")
      .select("id, title, slug, category, main_image")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(5);
    return NextResponse.json({ articles: (recent || []).map((a, i) => ({ ...a, views: 0, rank: i + 1 })) });
  }

  // Count by path
  const pathCounts: Record<string, number> = {};
  visits.forEach(v => {
    pathCounts[v.path] = (pathCounts[v.path] || 0) + 1;
  });

  // Get top 5 slugs
  const topPaths = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, count]) => ({ slug: path.replace("/article/", ""), views: count }));

  // Fetch article data for each slug
  const results: Array<{ id: string; title: string; slug: string; category: string; main_image: string; views: number; rank: number }> = [];
  for (const { slug, views } of topPaths) {
    const { data: article } = await supabase
      .from("articles")
      .select("id, title, slug, category, main_image")
      .eq("slug", slug)
      .eq("status", "published")
      .single();
    if (article) results.push({ ...article, views, rank: results.length + 1 });
  }

  // If less than 5, fill with recent
  if (results.length < 5) {
    const existingIds = results.map(r => r.id);
    const { data: recent } = await supabase
      .from("articles")
      .select("id, title, slug, category, main_image")
      .eq("status", "published")
      .not("id", "in", `(${existingIds.join(",")})`)
      .order("published_at", { ascending: false })
      .limit(5 - results.length);
    (recent || []).forEach((a) => results.push({ ...a, views: 0, rank: results.length + 1 }));
  }

  return NextResponse.json({ articles: results });
}
