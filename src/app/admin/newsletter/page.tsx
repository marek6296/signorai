"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  RefreshCw,
  Search,
  Trash2,
  Download,
  CheckCircle2,
  XCircle,
  X,
  Globe,
  UserPlus,
  TrendingUp,
} from "lucide-react";

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  source: "registration" | "website" | "footer" | "other";
  subscribed: boolean;
  subscribed_at: string;
  unsubscribed_at: string | null;
};

import { supabase } from "@/lib/supabase";

const sourceStyle: Record<string, { label: string; bg: string; color: string; border: string }> = {
  registration: { label: "Registrácia", bg: "rgba(34,197,94,0.12)", color: "#4ade80", border: "rgba(34,197,94,0.25)" },
  website:      { label: "Web formulár", bg: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "rgba(59,130,246,0.25)" },
  footer:       { label: "Footer",        bg: "rgba(168,85,247,0.12)", color: "#c084fc", border: "rgba(168,85,247,0.25)" },
  other:        { label: "Iné",           bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "rgba(255,255,255,0.12)" },
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

function DeleteModal({ sub, onConfirm, onCancel }: { sub: Subscriber; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <button onClick={onCancel} className="text-white/30 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div>
          <h3 className="text-white font-black text-base mb-1">Odstrániť odberateľa?</h3>
          <p className="text-white/40 text-sm"><span className="text-white/70 font-bold">{sub.email}</span> bude natrvalo vymazaný zo zoznamu.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition-all">Zrušiť</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-red-500/90 hover:bg-red-500 text-white transition-all">Odstrániť</button>
        </div>
      </div>
    </div>
  );
}

export default function NewsletterPage() {
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [deleteTarget, setDeleteTarget] = useState<Subscriber | null>(null);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("newsletter_subscribers")
      .select("*")
      .order("subscribed_at", { ascending: false });
    setSubs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("newsletter_subscribers").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    fetchSubs();
  };

  const handleToggle = async (sub: Subscriber) => {
    await supabase
      .from("newsletter_subscribers")
      .update({
        subscribed: !sub.subscribed,
        unsubscribed_at: sub.subscribed ? new Date().toISOString() : null,
      })
      .eq("id", sub.id);
    fetchSubs();
  };

  const exportCSV = () => {
    const active = subs.filter((s) => s.subscribed);
    const csv = ["Email,Meno,Zdroj,Dátum odberu", ...active.map((s) => `${s.email},${s.name ?? ""},${s.source},${fmt(s.subscribed_at)}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "newsletter-subscribers.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = subs.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.email.toLowerCase().includes(q) || (s.name ?? "").toLowerCase().includes(q);
    const matchFilter = filter === "all" || (filter === "active" ? s.subscribed : !s.subscribed);
    return matchSearch && matchFilter;
  });

  const activeCount = subs.filter((s) => s.subscribed).length;
  const regCount = subs.filter((s) => s.source === "registration").length;
  const webCount = subs.filter((s) => s.source === "website" || s.source === "footer").length;

  // Last 7 days
  const last7 = subs.filter((s) => {
    const d = new Date(s.subscribed_at);
    return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: "#080808" }}>
      {deleteTarget && <DeleteModal sub={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                <Mail size={15} className="text-violet-400" />
              </div>
              <h1 className="text-xl font-black text-white uppercase tracking-wider">Newsletter</h1>
            </div>
            <p className="text-white/30 text-sm ml-11">Správa odberateľov</p>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-all"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Aktívni odberatelia", value: activeCount, icon: CheckCircle2, color: "#4ade80" },
          { label: "Nových (7 dní)", value: last7, icon: TrendingUp, color: "#60a5fa" },
          { label: "Cez registráciu", value: regCount, icon: UserPlus, color: "#c084fc" },
          { label: "Cez web formulár", value: webCount, icon: Globe, color: "#fb923c" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            placeholder="Hľadať podľa emailu alebo mena..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-all"
          />
        </div>

        <div className="flex gap-2">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              style={
                filter === f
                  ? { background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }
                  : { background: "transparent", color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.08)" }
              }
            >
              {f === "all" ? "Všetci" : f === "active" ? "Aktívni" : "Odhlásení"}
            </button>
          ))}
          <button onClick={fetchSubs} disabled={loading} className="px-3 py-2 rounded-xl text-white/30 hover:text-white border border-white/8 hover:border-white/20 transition-all">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] px-5 py-3 gap-4 text-[9px] font-black uppercase tracking-widest text-white/20"
          style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span>Email</span>
          <span>Zdroj</span>
          <span>Dátum</span>
          <span>Status</span>
          <span></span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-white/20" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-white/20">
            <Mail size={32} />
            <p className="text-sm font-bold uppercase tracking-widest">Žiadni odberatelia</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {filtered.map((s) => {
              const src = sourceStyle[s.source] ?? sourceStyle.other;
              return (
                <div
                  key={s.id}
                  className="grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] grid-cols-1 px-5 py-4 gap-4 items-center hover:bg-white/[0.02] transition-colors"
                >
                  {/* Email + name */}
                  <div>
                    <div className="text-[13px] font-bold text-white">{s.email}</div>
                    {s.name && <div className="text-[11px] text-white/35 mt-0.5">{s.name}</div>}
                  </div>

                  {/* Source */}
                  <div className="md:block hidden">
                    <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                      style={{ background: src.bg, color: src.color, border: `1px solid ${src.border}` }}>
                      {src.label}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="text-[11px] text-white/30 md:block hidden">{fmt(s.subscribed_at)}</div>

                  {/* Status */}
                  <div className="md:block hidden">
                    <button
                      onClick={() => handleToggle(s)}
                      className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all hover:opacity-80"
                      style={s.subscribed
                        ? { color: "#4ade80" }
                        : { color: "rgba(255,255,255,0.25)" }}
                    >
                      {s.subscribed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {s.subscribed ? "Aktívny" : "Odhlásený"}
                    </button>
                  </div>

                  {/* Mobile row */}
                  <div className="md:hidden flex items-center justify-between">
                    <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                      style={{ background: src.bg, color: src.color, border: `1px solid ${src.border}` }}>
                      {src.label}
                    </span>
                    <span className="text-[10px] text-white/25">{fmt(s.subscribed_at)}</span>
                  </div>

                  {/* Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDeleteTarget(s)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[10px] text-white/15 mt-4 text-right">
        {filtered.length} z {subs.length} odberateľov · {activeCount} aktívnych
      </p>
    </div>
  );
}
