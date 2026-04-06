import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { MessageSquare, Eye, Pin, Lock, PlusCircle, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { sk } from "date-fns/locale";
import { NewThreadButton } from "@/components/forum/NewThreadButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fórum | AIWai News",
  description: "Diskutujte o umelej inteligencii, AI nástrojoch, budúcnosti technológií a zdieľajte skúsenosti s komunitou AIWai.",
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  order_index: number;
  thread_count?: number;
}

interface ForumThread {
  id: string;
  title: string;
  created_at: string;
  views: number;
  is_pinned: boolean;
  is_locked: boolean;
  reply_count: number;
  category_id: string;
  forum_categories: { name: string; icon: string; color: string; slug: string } | null;
  profiles: { full_name: string | null } | null;
}

export default async function ForumPage() {
  const supabase = getSupabase();

  // Fetch categories
  const { data: categories } = await supabase
    .from("forum_categories")
    .select("*")
    .order("order_index");

  // Fetch thread counts per category
  const { data: threadCounts } = await supabase
    .from("forum_threads")
    .select("category_id");

  const countMap: Record<string, number> = {};
  (threadCounts || []).forEach((t) => {
    countMap[t.category_id] = (countMap[t.category_id] || 0) + 1;
  });

  const categoriesWithCounts: ForumCategory[] = (categories || []).map((c) => ({
    ...c,
    thread_count: countMap[c.id] || 0,
  }));

  // Fetch recent threads (pinned first, then latest)
  const { data: threads } = await supabase
    .from("forum_threads")
    .select(`
      id, title, created_at, views, is_pinned, is_locked,
      user_id, category_id,
      forum_categories(name, icon, color, slug)
    `)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch author names separately for non-null user_ids
  const userIds = Array.from(new Set((threads || []).map((t) => t.user_id).filter(Boolean)));
  const profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    (profiles || []).forEach((p) => { if (p.full_name) profileMap[p.id] = p.full_name; });
  }

  // Get reply counts
  const threadIds = (threads || []).map((t) => t.id);
  const { data: replyCounts } = threadIds.length > 0
    ? await supabase
        .from("forum_replies")
        .select("thread_id")
        .in("thread_id", threadIds)
    : { data: [] };

  const replyCountMap: Record<string, number> = {};
  (replyCounts || []).forEach((r) => {
    replyCountMap[r.thread_id] = (replyCountMap[r.thread_id] || 0) + 1;
  });

  const threadsWithCounts: ForumThread[] = (threads || []).map((t) => ({
    ...t,
    reply_count: replyCountMap[t.id] || 0,
    forum_categories: Array.isArray(t.forum_categories) ? t.forum_categories[0] : t.forum_categories,
    profiles: t.user_id ? { full_name: profileMap[t.user_id] ?? null } : null,
  }));

  // Total stats
  const totalThreads = threadCounts?.length || 0;
  const totalReplies = replyCounts?.length || 0;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-5xl">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-2">
            Fórum
          </h1>
          <p className="text-muted-foreground font-medium">
            Diskutujte o AI, zdieľajte nástroje a skúsenosti s komunitou.
          </p>
        </div>
        <NewThreadButton categories={categoriesWithCounts} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        {[
          { label: "Vlákna", value: totalThreads, icon: MessageSquare },
          { label: "Odpovede", value: totalReplies, icon: TrendingUp },
          { label: "Kategórie", value: categoriesWithCounts.length, icon: PlusCircle },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1 p-4 rounded-2xl border border-border/30 bg-secondary/10"
          >
            <Icon className="w-4 h-4 text-primary mb-1" />
            <span className="text-2xl font-black">{value}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</span>
          </div>
        ))}
      </div>

      {/* Categories */}
      <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/50 mb-4">
        Kategórie
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
        {categoriesWithCounts.map((cat) => (
          <Link
            key={cat.id}
            href={`/forum/kategoria/${cat.slug}`}
            className="group flex items-start gap-4 p-4 rounded-2xl border transition-all hover:border-primary/30 hover:bg-secondary/20"
            style={{ borderColor: `${cat.color}25`, background: `${cat.color}08` }}
          >
            <span className="text-2xl flex-shrink-0">{cat.icon}</span>
            <div className="min-w-0">
              <p className="font-black text-sm text-foreground/90 group-hover:text-foreground transition-colors">
                {cat.name}
              </p>
              <p className="text-xs text-muted-foreground/60 line-clamp-2 mt-0.5">{cat.description}</p>
              <p className="text-[10px] font-black uppercase tracking-widest mt-2" style={{ color: cat.color }}>
                {cat.thread_count} vlákien
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Thread list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/50">
          Najnovšie vlákna
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        {threadsWithCounts.map((thread) => {
          const cat = thread.forum_categories;
          const dateStr = format(parseISO(thread.created_at), "d. MMM yyyy", { locale: sk });
          const authorName = thread.profiles?.full_name ?? "AIWai Tím";

          return (
            <Link
              key={thread.id}
              href={`/forum/${thread.id}`}
              className="group flex items-start gap-4 p-4 rounded-2xl border border-border/20 bg-secondary/5 hover:bg-secondary/15 hover:border-border/40 transition-all"
            >
              {/* Category icon */}
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg mt-0.5"
                style={{ background: cat ? `${cat.color}15` : "rgba(139,92,246,0.1)" }}
              >
                {cat?.icon ?? "💬"}
              </div>

              {/* Content */}
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <div className="flex items-start gap-2 flex-wrap">
                  {thread.is_pinned && (
                    <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                  )}
                  {thread.is_locked && (
                    <Lock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="font-bold text-sm text-foreground/85 group-hover:text-foreground transition-colors line-clamp-1">
                    {thread.title}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {cat && (
                    <span
                      className="text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0.5"
                      style={{ background: `${cat.color}15`, color: cat.color, border: `1px solid ${cat.color}30` }}
                    >
                      {cat.name}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/50 font-semibold">{authorName}</span>
                  <span className="text-[10px] text-muted-foreground/40">{dateStr}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-shrink-0 flex flex-col items-end gap-1.5 text-right">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50 font-semibold">
                  <MessageSquare className="w-3 h-3" />
                  {thread.reply_count}
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
