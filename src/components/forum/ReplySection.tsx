"use client";

import { useState } from "react";
import { MessageSquare, Send, Loader2, Lock } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { format, parseISO } from "date-fns";
import { sk } from "date-fns/locale";
import Link from "next/link";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
}

interface Reply {
  id: string;
  content: string;
  created_at: string;
  profiles: Profile | null;
}

interface ReplySectionProps {
  threadId: string;
  initialReplies: Reply[];
  isLocked: boolean;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ReplySection({ threadId, initialReplies, isLocked }: ReplySectionProps) {
  const { user } = useUser();
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim() || submitting || isLocked) return;

    setSubmitting(true);

    const optimistic: Reply = {
      id: `opt-${Date.now()}`,
      content: content.trim(),
      created_at: new Date().toISOString(),
      profiles: {
        full_name: user.user_metadata?.full_name ?? user.email ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      },
    };
    setReplies((prev) => [...prev, optimistic]);
    setContent("");

    try {
      const { data, error } = await supabase
        .from("forum_replies")
        .insert({ thread_id: threadId, user_id: user.id, content: content.trim() })
        .select("id, content, created_at, profiles(full_name, avatar_url)")
        .single();

      if (!error && data) {
        const real = {
          ...data,
          profiles: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles,
        };
        setReplies((prev) => prev.map((r) => (r.id === optimistic.id ? real : r)));
      }
    } catch {
      setReplies((prev) => prev.filter((r) => r.id !== optimistic.id));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
          <MessageSquare className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-lg font-black uppercase tracking-widest">
          Odpovede <span className="text-primary">({replies.length})</span>
        </h2>
      </div>

      {/* Reply list */}
      {replies.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center bg-secondary/10 border border-border/30 rounded-2xl mb-6">
          <MessageSquare className="w-8 h-8 text-muted-foreground/20" />
          <p className="text-sm font-semibold text-muted-foreground/50">
            Zatiaľ žiadne odpovede. Buďte prvý!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mb-6">
          {replies.map((reply, idx) => {
            const name = reply.profiles?.full_name ?? "Anonymný používateľ";
            let dateStr = "";
            try {
              dateStr = format(parseISO(reply.created_at), "d. MMMM yyyy, HH:mm", { locale: sk });
            } catch { dateStr = reply.created_at; }

            return (
              <div key={reply.id} className="flex gap-4 p-4 bg-secondary/10 border border-border/30 rounded-2xl">
                {/* Number */}
                <span className="flex-shrink-0 text-[10px] font-black text-muted-foreground/30 w-5 text-right pt-1">
                  #{idx + 1}
                </span>

                {/* Avatar */}
                <div className="flex-shrink-0">
                  {reply.profiles?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={reply.profiles.avatar_url}
                      alt={name}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-black"
                      style={{
                        background: "rgba(139,92,246,0.15)",
                        border: "1px solid rgba(139,92,246,0.25)",
                        color: "#a78bfa",
                      }}
                    >
                      {getInitials(name)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-black uppercase tracking-wide text-foreground/90">{name}</span>
                    <span className="text-[10px] text-muted-foreground/40">{dateStr}</span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                    {reply.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form or CTA */}
      {isLocked ? (
        <div className="flex items-center justify-center gap-2 py-5 px-4 bg-secondary/10 border border-border/30 rounded-2xl text-sm text-muted-foreground">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold">Toto vlákno je uzamknuté.</span>
        </div>
      ) : user ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            {user.user_metadata?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-1"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 mt-1"
                style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}
              >
                {getInitials(user.user_metadata?.full_name ?? user.email)}
              </div>
            )}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Napíšte svoju odpoveď..."
              rows={4}
              maxLength={5000}
              disabled={submitting}
              className="w-full resize-none rounded-2xl px-4 py-3 text-sm font-medium bg-secondary/20 border border-border/50 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors disabled:opacity-50"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Odpovedať
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-center gap-2 py-6 px-4 bg-secondary/10 border border-border/30 rounded-2xl text-sm text-muted-foreground">
          <MessageSquare className="w-4 h-4 flex-shrink-0" />
          <span>
            <Link href="/prihlasenie" className="font-bold text-primary hover:text-primary/80 underline underline-offset-4 transition-colors">
              Prihláste sa
            </Link>{" "}
            pre pridanie odpovede
          </span>
        </div>
      )}
    </section>
  );
}
