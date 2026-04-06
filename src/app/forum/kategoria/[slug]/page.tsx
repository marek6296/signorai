import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, Eye, Pin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { sk } from "date-fns/locale";
import { NewThreadButton } from "@/components/forum/NewThreadButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("forum_categories")
    .select("name, description")
    .eq("slug", params.slug)
    .single();
  if (!data) return { title: "Kategória | AIWai Fórum" };
  return { title: `${data.name} | AIWai Fórum`, description: data.description };
}

export default async function CategoryPage({ params }: Props) {
  const supabase = getSupabase();

  const { data: category } = await supabase
    .from("forum_categories")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!category) notFound();

  const { data: threads } = await supabase
    .from("forum_threads")
    .select("id, title, created_at, views, is_pinned, is_locked, user_id")
    .eq("category_id", category.id)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const userIds = Array.from(new Set((threads || []).map((t) => t.user_id).filter(Boolean)));
  const profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    (profiles || []).forEach((p) => { if (p.full_name) profileMap[p.id] = p.full_name; });
  }

  const threadIds = (threads || []).map((t) => t.id);
  const { data: replyCounts } = threadIds.length > 0
    ? await supabase.from("forum_replies").select("thread_id").in("thread_id", threadIds)
    : { data: [] };

  const replyMap: Record<string, number> = {};
  (replyCounts || []).forEach((r) => { replyMap[r.thread_id] = (replyMap[r.thread_id] || 0) + 1; });

  const { data: allCategories } = await supabase.from("forum_categories").select("*").order("order_index");

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground/60 font-semibold">
        <Link href="/forum" className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />
          Fórum
        </Link>
        <span>/</span>
        <span>{category.icon} {category.name}</span>
      </div>

      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{category.icon}</span>
            <h1 className="text-3xl font-black">{category.name}</h1>
          </div>
          <p className="text-muted-foreground text-sm">{category.description}</p>
        </div>
        <NewThreadButton categories={allCategories || []} defaultCategory={category.id} />
      </div>

      <div className="flex flex-col gap-2">
        {(threads || []).length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center bg-secondary/10 border border-border/30 rounded-2xl">
            <span className="text-4xl">{category.icon}</span>
            <p className="text-sm font-bold text-muted-foreground/60">
              Zatiaľ žiadne vlákna. Buďte prvý!
            </p>
          </div>
        ) : (threads || []).map((thread) => {
          const authorName2 = thread.user_id ? (profileMap[thread.user_id] ?? "AIWai Tím") : "AIWai Tím";
          const dateStr = format(parseISO(thread.created_at), "d. MMM yyyy", { locale: sk });
          return (
            <Link
              key={thread.id}
              href={`/forum/${thread.id}`}
              className="group flex items-start gap-4 p-4 rounded-2xl border border-border/20 bg-secondary/5 hover:bg-secondary/15 hover:border-border/40 transition-all"
            >
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg mt-0.5"
                style={{ background: `${category.color}15` }}
              >
                {category.icon}
              </div>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {thread.is_pinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
                  <p className="font-bold text-sm text-foreground/85 group-hover:text-foreground transition-colors line-clamp-1">
                    {thread.title}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground/50 font-semibold">
                    {authorName2}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40">{dateStr}</span>
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50 font-semibold">
                  <MessageSquare className="w-3 h-3" />
                  {replyMap[thread.id] || 0}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40 font-semibold">
                  <Eye className="w-3 h-3" />
                  {thread.views}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
