"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { format, parseISO } from "date-fns";
import { sk } from "date-fns/locale";
import Link from "next/link";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  article_id: string;
  user_id: string;
  content: string;
  created_at: string;
  is_approved: boolean;
  profiles: Profile | null;
}

interface CommentsProps {
  articleId: string;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Comments({ articleId }: CommentsProps) {
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("comments")
      .select("*, profiles(full_name, avatar_url)")
      .eq("article_id", articleId)
      .eq("is_approved", true)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) {
          setComments((data as Comment[]) ?? []);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [articleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim() || submitting) return;

    setSubmitting(true);

    // Optimistic update
    const optimistic: Comment = {
      id: `optimistic-${Date.now()}`,
      article_id: articleId,
      user_id: user.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
      is_approved: true,
      profiles: {
        full_name: user.user_metadata?.full_name ?? user.email ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      },
    };
    setComments((prev) => [...prev, optimistic]);
    setContent("");

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({ article_id: articleId, user_id: user.id, content: content.trim() })
        .select("*, profiles(full_name, avatar_url)")
        .single();

      if (!error && data) {
        setComments((prev) =>
          prev.map((c) => (c.id === optimistic.id ? (data as Comment) : c))
        );
      }
    } catch (err) {
      console.error("Comment submit error:", err);
      // Remove optimistic on error
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
          <MessageSquare className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-xl font-black uppercase tracking-widest">
          Komentáre{" "}
          {!loading && (
            <span className="text-primary">({comments.length})</span>
          )}
        </h2>
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center bg-secondary/10 border border-border/30 rounded-2xl mb-8">
          <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground/60">
            Buďte prvý, kto pridá komentár
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 mb-8">
          {comments.map((comment) => {
            const name = comment.profiles?.full_name ?? "Anonymný používateľ";
            const initials = getInitials(name);
            let dateStr = "";
            try {
              dateStr = format(parseISO(comment.created_at), "d. MMMM yyyy, HH:mm", { locale: sk });
            } catch {
              dateStr = comment.created_at;
            }

            return (
              <div
                key={comment.id}
                className="flex gap-4 p-4 bg-secondary/10 border border-border/30 rounded-2xl"
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {comment.profiles?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={comment.profiles.avatar_url}
                      alt={name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black"
                      style={{
                        background: "rgba(139,92,246,0.15)",
                        border: "1px solid rgba(139,92,246,0.25)",
                        color: "#a78bfa",
                      }}
                    >
                      {initials}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-black uppercase tracking-wide text-foreground/90">
                      {name}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">{dateStr}</span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form / CTA */}
      {user ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Napíšte komentár..."
            rows={4}
            maxLength={2000}
            disabled={submitting}
            className="w-full resize-none rounded-2xl px-4 py-3 text-sm font-medium bg-secondary/20 border border-border/50 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors disabled:opacity-50"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Odoslať komentár
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-center gap-2 py-6 px-4 bg-secondary/10 border border-border/30 rounded-2xl text-sm text-muted-foreground">
          <MessageSquare className="w-4 h-4 flex-shrink-0" />
          <span>
            <Link
              href="/prihlasenie"
              className="font-bold text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
            >
              Prihláste sa
            </Link>{" "}
            pre pridanie komentára
          </span>
        </div>
      )}
    </section>
  );
}
