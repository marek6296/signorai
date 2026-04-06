"use client";

import { useState } from "react";
import { PlusCircle, X, Send, Loader2 } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface NewThreadButtonProps {
  categories: Category[];
  defaultCategory?: string;
}

export function NewThreadButton({ categories, defaultCategory }: NewThreadButtonProps) {
  const { user } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategory ?? categories[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const { data, error: err } = await supabase
        .from("forum_threads")
        .insert({
          title: title.trim(),
          content: content.trim(),
          user_id: user.id,
          category_id: categoryId || null,
        })
        .select("id")
        .single();

      if (err) throw err;
      setOpen(false);
      setTitle("");
      setContent("");
      router.push(`/forum/${data.id}`);
      router.refresh();
    } catch {
      setError("Nepodarilo sa vytvoriť vlákno. Skúste znova.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <Link
        href="/prihlasenie"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all flex-shrink-0"
      >
        <PlusCircle className="w-4 h-4" />
        Nové vlákno
      </Link>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all flex-shrink-0"
      >
        <PlusCircle className="w-4 h-4" />
        Nové vlákno
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Modal */}
          <div
            className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: "var(--background)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/30">
              <h2 className="text-base font-black uppercase tracking-widest">Nové vlákno</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-xl hover:bg-secondary/30 transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              {/* Category select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  Kategória
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm font-semibold bg-secondary/20 border border-border/50 text-foreground focus:outline-none focus:border-primary/40 transition-colors appearance-none"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  Názov vlákna
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Zadajte výstižný názov..."
                  maxLength={200}
                  required
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium bg-secondary/20 border border-border/50 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>

              {/* Content */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  Obsah
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Opíšte tému, pridajte kontext, otázky alebo názory..."
                  rows={6}
                  maxLength={10000}
                  required
                  className="w-full resize-none rounded-xl px-4 py-3 text-sm font-medium bg-secondary/20 border border-border/50 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 font-semibold">{error}</p>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-widest border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all"
                >
                  Zrušiť
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || !content.trim() || submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Vytvoriť vlákno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
