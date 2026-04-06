import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, MessageSquare, Pin, Lock, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { sk } from "date-fns/locale";
import { ReplySection } from "@/components/forum/ReplySection";
import { ViewTracker } from "@/components/forum/ViewTracker";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: { threadId: string };
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
    .from("forum_threads")
    .select("title, content")
    .eq("id", params.threadId)
    .single();
  if (!data) return { title: "Vlákno | AIWai Fórum" };
  return {
    title: `${data.title} | AIWai Fórum`,
    description: data.content.slice(0, 160).replace(/\*/g, ""),
  };
}

function renderContent(text: string) {
  // Simple markdown-like rendering: **bold**, newlines
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className={line === "" ? "h-3" : "leading-relaxed"}>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j} className="font-black text-foreground">
              {part.slice(2, -2)}
            </strong>
          ) : (
            part
          )
        )}
      </p>
    );
  });
}

function getInitials(name: string | null): string {
  if (!name) return "AI";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function ThreadPage({ params }: Props) {
  const supabase = getSupabase();

  const { data: thread } = await supabase
    .from("forum_threads")
    .select(`
      id, title, content, created_at, views, is_pinned, is_locked,
      user_id,
      forum_categories(id, name, icon, color, slug)
    `)
    .eq("id", params.threadId)
    .single();

  if (!thread) notFound();

  const { data: replies } = await supabase
    .from("forum_replies")
    .select("id, content, created_at, user_id")
    .eq("thread_id", params.threadId)
    .eq("is_approved", true)
    .order("created_at", { ascending: true });

  // Fetch author profiles
  const allUserIds = Array.from(new Set([
    thread.user_id,
    ...(replies || []).map((r) => r.user_id),
  ].filter(Boolean)));
  const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
  if (allUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", allUserIds);
    (profiles || []).forEach((p) => { profileMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
  }

  const cat = Array.isArray(thread.forum_categories)
    ? thread.forum_categories[0]
    : thread.forum_categories;
  const authorProfile = thread.user_id ? profileMap[thread.user_id] : null;
  const authorName = authorProfile?.full_name ?? "AIWai Tím";
  const author = authorProfile;
  const dateStr = format(parseISO(thread.created_at), "d. MMMM yyyy, HH:mm", { locale: sk });

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-3xl">
      <ViewTracker threadId={thread.id} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground/60 font-semibold flex-wrap">
        <Link href="/forum" className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />
          Fórum
        </Link>
        {cat && (
          <>
            <span>/</span>
            <Link href={`/forum/kategoria/${cat.slug}`} className="hover:text-primary transition-colors">
              {cat.icon} {cat.name}
            </Link>
          </>
        )}
      </div>

      {/* Thread card */}
      <article className="rounded-2xl border border-border/30 bg-secondary/10 overflow-hidden mb-6">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/20">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {cat && (
              <span
                className="text-[9px] font-black uppercase tracking-widest rounded-full px-2.5 py-1"
                style={{ background: `${cat.color}15`, color: cat.color, border: `1px solid ${cat.color}30` }}
              >
                {cat.icon} {cat.name}
              </span>
            )}
            {thread.is_pinned && (
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
                <Pin className="w-2.5 h-2.5" /> Pripnuté
              </span>
            )}
            {thread.is_locked && (
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-secondary/30 border border-border/30 rounded-full px-2.5 py-1">
                <Lock className="w-2.5 h-2.5" /> Uzamknuté
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-black leading-tight mb-4">{thread.title}</h1>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Author */}
            <div className="flex items-center gap-2">
              {author?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={author.avatar_url} alt={authorName} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-[9px] font-black text-primary">
                  {getInitials(authorName)}
                </div>
              )}
              <span className="text-xs font-black text-foreground/70">{authorName}</span>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
              <Calendar className="w-3 h-3" />
              {dateStr}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40 font-semibold">
              <Eye className="w-3 h-3" />
              {thread.views + 1}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40 font-semibold">
              <MessageSquare className="w-3 h-3" />
              {replies?.length ?? 0} odpovedí
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 text-sm text-foreground/85 flex flex-col gap-1">
          {renderContent(thread.content)}
        </div>
      </article>

      {/* Replies + form */}
      <ReplySection
        threadId={thread.id}
        initialReplies={(replies || []).map((r) => ({
          ...r,
          profiles: r.user_id ? (profileMap[r.user_id] ?? null) : null,
        }))}
        isLocked={thread.is_locked}
      />
    </div>
  );
}
