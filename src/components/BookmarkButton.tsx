"use client";

import { useState, useEffect, useRef } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";

interface BookmarkButtonProps {
  articleId: string;
}

export function BookmarkButton({ articleId }: BookmarkButtonProps) {
  const { user } = useUser();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if already saved
  useEffect(() => {
    if (!user) {
      setSaved(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("saved_articles")
      .select("id")
      .eq("user_id", user.id)
      .eq("article_id", articleId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setSaved(!!data);
      });
    return () => { cancelled = true; };
  }, [user, articleId]);

  const handleClick = async () => {
    if (!user) {
      setShowTooltip(true);
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
      tooltipTimeout.current = setTimeout(() => setShowTooltip(false), 3000);
      return;
    }

    setLoading(true);
    try {
      if (saved) {
        await supabase
          .from("saved_articles")
          .delete()
          .eq("user_id", user.id)
          .eq("article_id", articleId);
        setSaved(false);
      } else {
        await supabase
          .from("saved_articles")
          .insert({ user_id: user.id, article_id: articleId });
        setSaved(true);
      }
    } catch (err) {
      console.error("Bookmark error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        style={{
          background: saved ? "rgba(251, 191, 36, 0.15)" : "rgba(255,255,255,0.06)",
          border: saved ? "1px solid rgba(251, 191, 36, 0.35)" : "1px solid rgba(255,255,255,0.12)",
          color: saved ? "#fbbf24" : "rgba(255,255,255,0.6)",
        }}
        aria-label={saved ? "Odstrániť zo záložiek" : "Uložiť článok"}
      >
        {saved ? (
          <BookmarkCheck
            className="w-4 h-4 transition-transform duration-200"
            style={{ fill: "#fbbf24", color: "#fbbf24" }}
          />
        ) : (
          <Bookmark className="w-4 h-4 transition-transform duration-200" />
        )}
        <span>{saved ? "Uložené" : "Uložiť"}</span>
      </button>

      {showTooltip && (
        <div
          className="absolute top-full mt-2 right-0 z-50 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold shadow-lg"
          style={{
            background: "rgba(15,15,20,0.95)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.8)",
          }}
        >
          Prihláste sa pre ukladanie článkov
          <div
            className="absolute -top-1 right-4 w-2 h-2 rotate-45"
            style={{ background: "rgba(15,15,20,0.95)", borderLeft: "1px solid rgba(255,255,255,0.12)", borderTop: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>
      )}
    </div>
  );
}
