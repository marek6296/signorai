/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  Zap, Sparkles, FileText, Share2, BarChart3, Settings,
  RefreshCw, ArrowRight, CheckCircle, Clock, TrendingUp,
  Eye, Edit, Globe, AlertTriangle, PlayCircle, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────────── */
type AutopilotSettings = {
  enabled: boolean;
  last_run: string | null;
  processed_count: number;
};
type RecentArticle = {
  id: string; title: string; slug: string; category: string;
  status: string; published_at: string;
};
type SocialDraft = {
  id: string; platform: string; content: string;
  articles?: { title: string; slug: string };
};
type DashboardStats = {
  todayArticles: number; totalPublished: number; pendingTopics: number;
  socialDrafts: number; todayVisits: number;
};

const todayStr = () => new Date().toISOString().split("T")[0];

function categoryColor(cat: string) {
  if (cat === "AI") return { bg: "rgba(59,130,246,0.12)", text: "#93c5fd", border: "rgba(59,130,246,0.25)" };
  if (cat === "Tech") return { bg: "rgba(168,85,247,0.12)", text: "#c4b5fd", border: "rgba(168,85,247,0.25)" };
  if (cat === "Návody & Tipy") return { bg: "rgba(34,197,94,0.12)", text: "#86efac", border: "rgba(34,197,94,0.25)" };
  return { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.4)", border: "rgba(255,255,255,0.1)" };
}

function platformStyle(p: string) {
  if (p === "Instagram") return { bg: "rgba(236,72,153,0.12)", text: "#f9a8d4", border: "rgba(236,72,153,0.25)" };
  if (p === "Facebook") return { bg: "rgba(59,130,246,0.12)", text: "#93c5fd", border: "rgba(59,130,246,0.25)" };
  return { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.4)", border: "rgba(255,255,255,0.1)" };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("sk-SK", { day: "numeric", month: "short" });
}

/* ─── Premium Card component ─────────────────────────────────────── */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("relative rounded-2xl overflow-hidden", className)}
      style={{
        background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      {/* Subtle inner top glow */}
      <div
        className="absolute top-0 left-6 right-6 h-px pointer-events-none"
        style={{
          background: "linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)",
        }}
      />
      {children}
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────────── */
export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todayArticles: 0, totalPublished: 0, pendingTopics: 0,
    socialDrafts: 0, todayVisits: 0,
  });
  const [autopilot, setAutopilot] = useState<AutopilotSettings>({ enabled: false, last_run: null, processed_count: 0 });
  const [recentArticles, setRecentArticles] = useState<RecentArticle[]>([]);
  const [socialDrafts, setSocialDrafts] = useState<SocialDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAutopilot, setRunningAutopilot] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayStr();
      const [
        { count: todayArticles },
        { count: totalPublished },
        { count: pendingTopics },
        { count: socialDraftsCount },
        { count: todayVisits },
        { data: apData },
        { data: articles },
        { data: drafts },
      ] = await Promise.all([
        supabase.from("articles").select("id", { count: "exact", head: true }).gte("published_at", today),
        supabase.from("articles").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("suggested_news").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("social_posts").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("site_visits").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("site_settings").select("value").eq("key", "auto_pilot").single(),
        supabase.from("articles").select("id,title,slug,category,status,published_at").order("published_at", { ascending: false }).limit(6),
        supabase.from("social_posts").select("id,platform,content,articles(title,slug)").eq("status", "draft").order("created_at", { ascending: false }).limit(5),
      ]);

      setStats({
        todayArticles: todayArticles ?? 0,
        totalPublished: totalPublished ?? 0,
        pendingTopics: pendingTopics ?? 0,
        socialDrafts: socialDraftsCount ?? 0,
        todayVisits: todayVisits ?? 0,
      });
      if (apData) setAutopilot(apData.value as AutopilotSettings);
      setRecentArticles((articles ?? []) as RecentArticle[]);
      setSocialDrafts((drafts ?? []) as unknown as SocialDraft[]);
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const runAutopilot = async () => {
    setRunningAutopilot(true);
    try {
      const res = await fetch(`/api/admin/auto-pilot?secret=make-com-webhook-secret&force=true`);
      const data = await res.json();
      if (res.ok) {
        showToast("Autopilot spustený ✓");
        fetchAll();
      } else {
        showToast(data.message || "Chyba autopilota", "error");
      }
    } catch {
      showToast("Chyba pri spúšťaní", "error");
    } finally {
      setRunningAutopilot(false);
    }
  };

  const timeStr = now.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "long" });

  const statCards = [
    {
      label: "Dnes vydané",
      value: stats.todayArticles,
      icon: TrendingUp,
      accent: { color: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.2)", glow: "rgba(74,222,128,0.08)" },
    },
    {
      label: "Všetky článkov",
      value: stats.totalPublished,
      icon: FileText,
      accent: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.2)", glow: "rgba(96,165,250,0.08)" },
    },
    {
      label: "Čakajúce témy",
      value: stats.pendingTopics,
      icon: AlertTriangle,
      accent: { color: "#facc15", bg: "rgba(250,204,21,0.1)", border: "rgba(250,204,21,0.2)", glow: "rgba(250,204,21,0.08)" },
    },
    {
      label: "Social drafty",
      value: stats.socialDrafts,
      icon: Share2,
      accent: { color: "#f472b6", bg: "rgba(244,114,182,0.1)", border: "rgba(244,114,182,0.2)", glow: "rgba(244,114,182,0.08)" },
    },
    {
      label: "Návštevy dnes",
      value: stats.todayVisits,
      icon: Eye,
      accent: { color: "#fb923c", bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.2)", glow: "rgba(251,146,60,0.08)" },
    },
  ];

  const quickNav = [
    { href: "/admin/autopilot", label: "Autopilot", icon: Zap, color: "#facc15", bg: "rgba(250,204,21,0.1)", desc: "Automatizácia" },
    { href: "/admin/tvorba", label: "Tvorba", icon: Sparkles, color: "#c084fc", bg: "rgba(192,132,252,0.1)", desc: "Generovanie" },
    { href: "/admin/clanky", label: "Články", icon: FileText, color: "#4ade80", bg: "rgba(74,222,128,0.1)", desc: "Správa" },
    { href: "/admin/socialne", label: "Sociálne", icon: Share2, color: "#f472b6", bg: "rgba(244,114,182,0.1)", desc: "Promo" },
    { href: "/admin/analytika", label: "Analytika", icon: BarChart3, color: "#fb923c", bg: "rgba(251,146,60,0.1)", desc: "Štatistiky" },
    { href: "/admin/zdroje", label: "Zdroje", icon: Settings, color: "#60a5fa", bg: "rgba(96,165,250,0.1)", desc: "Nastavenia" },
  ];

  return (
    <div className="p-5 md:p-7 space-y-6 min-h-full" style={{ background: "#080808" }}>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold animate-in fade-in slide-in-from-top-2"
          style={
            toast.type === "success"
              ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }
              : { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }
          }
        >
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1
              className="text-2xl md:text-3xl font-black uppercase tracking-tight"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.6) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Dashboard
            </h1>
          </div>
          <p className="text-white/30 text-sm capitalize">{dateStr}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="font-mono text-sm hidden sm:block px-3 py-1.5 rounded-lg"
            style={{ color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {timeStr}
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Aktualizovať
          </button>
        </div>
      </div>

      {/* ── Autopilot Banner ── */}
      <div
        className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 relative overflow-hidden"
        style={
          autopilot.enabled
            ? {
                background: "linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(74,222,128,0.02) 100%)",
                border: "1px solid rgba(74,222,128,0.2)",
                boxShadow: "0 0 40px rgba(74,222,128,0.05)",
              }
            : {
                background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)",
                border: "1px solid rgba(255,255,255,0.07)",
              }
        }
      >
        {/* Glow orb for active state */}
        {autopilot.enabled && (
          <div
            className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(74,222,128,0.12) 0%, transparent 70%)",
            }}
          />
        )}

        <div className="flex items-center gap-4 flex-1 min-w-0 relative">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={
              autopilot.enabled
                ? { background: "rgba(74,222,128,0.15)", boxShadow: "0 0 20px rgba(74,222,128,0.2)" }
                : { background: "rgba(255,255,255,0.05)" }
            }
          >
            <Zap
              className="w-5 h-5"
              style={{ color: autopilot.enabled ? "#4ade80" : "rgba(255,255,255,0.25)" }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-black text-white uppercase tracking-wide">
                AI Autopilot
              </span>
              <span
                className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                style={
                  autopilot.enabled
                    ? { background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }
                }
              >
                {autopilot.enabled ? "● Aktívny" : "○ Vypnutý"}
              </span>
            </div>
            <p className="text-[11px] text-white/30 mt-0.5">
              {autopilot.last_run
                ? `Posledný beh: ${new Date(autopilot.last_run).toLocaleDateString("sk-SK")} · ${autopilot.processed_count} článkov`
                : "Ešte nebol spustený"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 relative">
          <Link
            href="/admin/autopilot"
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Nastavenia
          </Link>
          <button
            onClick={runAutopilot}
            disabled={runningAutopilot}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50"
            style={
              autopilot.enabled
                ? { background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }
                : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }
            }
          >
            <PlayCircle className={cn("w-3.5 h-3.5", runningAutopilot && "animate-spin")} />
            {runningAutopilot ? "Spúšťa sa..." : "Spustiť teraz"}
          </button>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="relative rounded-2xl p-4 md:p-5 overflow-hidden group"
            style={{
              background: `linear-gradient(145deg, #111111 0%, #0d0d0d 100%)`,
              border: `1px solid rgba(255,255,255,0.07)`,
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            {/* Top accent glow line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: `linear-gradient(to right, transparent, ${s.accent.color}40, transparent)`,
              }}
            />
            {/* Hover glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ background: `radial-gradient(ellipse at top, ${s.accent.glow} 0%, transparent 70%)` }}
            />

            <div className="relative">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{ background: s.accent.bg, border: `1px solid ${s.accent.border}` }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.accent.color }} />
              </div>
              <div
                className="text-2xl md:text-3xl font-black mb-1 tabular-nums"
                style={loading ? { color: "rgba(255,255,255,0.1)" } : { color: "#ffffff" }}
              >
                {loading ? "—" : s.value.toLocaleString("sk-SK")}
              </div>
              <div
                className="text-[10px] font-semibold uppercase tracking-wider leading-tight"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Run Autopilot */}
        <button
          onClick={runAutopilot}
          disabled={runningAutopilot}
          className="flex items-center justify-between gap-3 p-4 md:p-5 rounded-2xl transition-all group text-left disabled:opacity-60"
          style={{
            background: "rgba(250,204,21,0.06)",
            border: "1px solid rgba(250,204,21,0.15)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.2)" }}
            >
              <Zap className="w-4.5 h-4.5" style={{ color: "#facc15" }} />
            </div>
            <div>
              <div className="text-sm font-black text-white">Spustiť Autopilot</div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>Nový článok + social</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 shrink-0 transition-all group-hover:translate-x-0.5" style={{ color: "rgba(250,204,21,0.4)" }} />
        </button>

        {/* New Article */}
        <Link
          href="/admin/tvorba"
          className="flex items-center justify-between gap-3 p-4 md:p-5 rounded-2xl transition-all group"
          style={{
            background: "rgba(192,132,252,0.06)",
            border: "1px solid rgba(192,132,252,0.15)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(192,132,252,0.12)", border: "1px solid rgba(192,132,252,0.2)" }}
            >
              <Sparkles className="w-4 h-4" style={{ color: "#c084fc" }} />
            </div>
            <div>
              <div className="text-sm font-black text-white">Nový Článok</div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>Z URL / témy / synthesis</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 shrink-0 transition-all group-hover:translate-x-0.5" style={{ color: "rgba(192,132,252,0.4)" }} />
        </Link>

        {/* Social Posts */}
        <Link
          href="/admin/socialne"
          className="flex items-center justify-between gap-3 p-4 md:p-5 rounded-2xl transition-all group"
          style={{
            background: "rgba(244,114,182,0.06)",
            border: "1px solid rgba(244,114,182,0.15)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(244,114,182,0.12)", border: "1px solid rgba(244,114,182,0.2)" }}
            >
              <Share2 className="w-4 h-4" style={{ color: "#f472b6" }} />
            </div>
            <div>
              <div className="text-sm font-black text-white">Social Príspevky</div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                {stats.socialDrafts > 0 ? `${stats.socialDrafts} drafty čakajú` : "Generovať príspevky"}
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 shrink-0 transition-all group-hover:translate-x-0.5" style={{ color: "rgba(244,114,182,0.4)" }} />
        </Link>
      </div>

      {/* ── Two-column section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Articles */}
        <Card>
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.2)" }}
              >
                <FileText className="w-3.5 h-3.5" style={{ color: "#4ade80" }} />
              </div>
              <h2 className="text-sm font-black text-white uppercase tracking-wide">Posledné Články</h2>
            </div>
            <Link
              href="/admin/clanky"
              className="flex items-center gap-1 text-[11px] font-semibold transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Všetky <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <div className="h-3 rounded-full animate-pulse w-2/3" style={{ background: "rgba(255,255,255,0.05)" }} />
                    <div className="h-3 rounded-full animate-pulse w-12 ml-auto" style={{ background: "rgba(255,255,255,0.04)" }} />
                  </div>
                ))
              : recentArticles.length === 0
              ? (
                <div className="px-5 py-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Žiadne články
                </div>
              )
              : recentArticles.map((a, idx) => {
                  const cat = categoryColor(a.category);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 px-5 py-3.5 group transition-colors"
                      style={{
                        borderBottom: idx < recentArticles.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                      }}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: a.status === "published" ? "#4ade80" : "#facc15" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-tight" style={{ color: "rgba(255,255,255,0.8)" }}>
                          {a.title}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                          {fmtDate(a.published_at)}
                        </p>
                      </div>
                      <span
                        className="text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 hidden sm:block"
                        style={{ background: cat.bg, color: cat.text, border: `1px solid ${cat.border}` }}
                      >
                        {a.category}
                      </span>
                      <Link
                        href={`/admin/clanky`}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)" }}
                      >
                        <Edit className="w-3 h-3" />
                      </Link>
                    </div>
                  );
                })
            }
          </div>
        </Card>

        {/* Social Drafts */}
        <Card>
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(244,114,182,0.12)", border: "1px solid rgba(244,114,182,0.2)" }}
              >
                <Share2 className="w-3.5 h-3.5" style={{ color: "#f472b6" }} />
              </div>
              <h2 className="text-sm font-black text-white uppercase tracking-wide">Social Drafty</h2>
              {stats.socialDrafts > 0 && (
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(244,114,182,0.15)", color: "#f472b6", border: "1px solid rgba(244,114,182,0.3)" }}
                >
                  {stats.socialDrafts}
                </span>
              )}
            </div>
            <Link
              href="/admin/socialne"
              className="flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Všetky <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-start gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <div className="h-5 w-16 rounded-full animate-pulse shrink-0" style={{ background: "rgba(255,255,255,0.05)" }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 rounded animate-pulse w-full" style={{ background: "rgba(255,255,255,0.04)" }} />
                      <div className="h-3 rounded animate-pulse w-2/3" style={{ background: "rgba(255,255,255,0.03)" }} />
                    </div>
                  </div>
                ))
              : socialDrafts.length === 0
              ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>Žiadne čakajúce drafty</p>
                  <Link
                    href="/admin/socialne"
                    className="text-xs font-semibold"
                    style={{ color: "#f472b6" }}
                  >
                    Generovať príspevky →
                  </Link>
                </div>
              )
              : socialDrafts.map((p, idx) => {
                  const pl = platformStyle(p.platform);
                  return (
                    <div
                      key={p.id}
                      className="flex items-start gap-3 px-5 py-4"
                      style={{ borderBottom: idx < socialDrafts.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
                    >
                      <span
                        className="text-[9px] font-black px-2 py-1 rounded-lg shrink-0 mt-0.5"
                        style={{ background: pl.bg, color: pl.text, border: `1px solid ${pl.border}` }}
                      >
                        {p.platform}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {(p as any).articles?.title ?? "Bez článku"}
                        </p>
                        <p
                          className="text-xs mt-0.5 line-clamp-2 leading-relaxed"
                          style={{ color: "rgba(255,255,255,0.55)" }}
                        >
                          {p.content}
                        </p>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </Card>
      </div>

      {/* ── Quick Navigation ── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="text-[9px] font-black uppercase tracking-[0.25em]"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            Rýchla Navigácia
          </div>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-3 p-4 rounded-2xl transition-all group text-center"
              style={{
                background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                style={{ background: item.bg }}
              >
                <item.icon className="w-4 h-4" style={{ color: item.color }} />
              </div>
              <div>
                <div
                  className="text-xs font-black transition-colors"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  {item.label}
                </div>
                <div
                  className="text-[10px] mt-0.5"
                  style={{ color: "rgba(255,255,255,0.2)" }}
                >
                  {item.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── System Status ── */}
      <div
        className="flex flex-wrap items-center gap-4 pt-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.2)" }}>Systém funkčný</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3 h-3" style={{ color: "rgba(255,255,255,0.2)" }} />
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>Supabase Connected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Globe className="w-3 h-3" style={{ color: "rgba(255,255,255,0.2)" }} />
          <a
            href="https://aiwai.news"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] transition-colors hover:text-white/50"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            aiwai.news
          </a>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Clock className="w-3 h-3" style={{ color: "rgba(255,255,255,0.15)" }} />
          <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>{timeStr}</span>
        </div>
      </div>
    </div>
  );
}
