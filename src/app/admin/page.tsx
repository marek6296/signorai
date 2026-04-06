"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowRight, RefreshCw } from "lucide-react";

interface Article {
  id: string;
  title: string;
  status: string;
  created_at: string;
  category?: string;
  slug?: string;
}

const AMBER = "#f59e0b";
const AMBER_DIM = "rgba(245,158,11,0.08)";
const AMBER_BORDER = "rgba(245,158,11,0.2)";

export default function AdminDashboard() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [visits, setVisits] = useState(0);
  const [subscribers, setSubscribers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [time, setTime] = useState("");

  const published = articles.filter((a) => a.status === "published");
  const drafts = articles.filter((a) => a.status === "draft");
  const todayStr = new Date().toISOString().split("T")[0];
  const todayPublished = published.filter((a) => a.created_at?.startsWith(todayStr)).length;
  const thisWeek = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return published.filter((a) => new Date(a.created_at) >= d).length;
  })();

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0];
    return {
      dateStr,
      label: d.toLocaleDateString("sk-SK", { weekday: "short" }).toUpperCase().substring(0, 2),
      count: published.filter((a) => a.created_at?.startsWith(dateStr)).length,
      isToday: i === 6,
    };
  });
  const maxDay = Math.max(...weekDays.map((d) => d.count), 1);

  const recent = [...published]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  const fetchData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const [{ data: arts }, { data: vis }, { count: subs }] = await Promise.all([
        supabase.from("articles").select("id,title,status,created_at,category,slug").limit(500),
        supabase.from("site_visits").select("created_at").gte("created_at", today + "T00:00:00"),
        supabase.from("newsletter_subscribers").select("*", { count: "exact", head: true }),
      ]);
      setArticles(arts || []);
      setVisits(vis?.length || 0);
      setSubscribers(subs || 0);
      setTime(new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 36, height: 36, border: `2px solid ${AMBER_BORDER}`, borderTopColor: AMBER, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const pipelinePct =
    published.length + drafts.length > 0
      ? Math.round((published.length / (published.length + drafts.length)) * 100)
      : 0;

  const QUICK_ACTIONS = [
    { label: "Vytvoriť článok", sub: "AI generovanie obsahu", path: "/admin/tvorba", color: "#a855f7" },
    { label: "Správa článkov", sub: `${drafts.length} draft${drafts.length !== 1 ? "y" : ""} · ${published.length} live`, path: "/admin/clanky", color: "#22c55e" },
    { label: "Sociálne siete", sub: "Instagram · Facebook", path: "/admin/socialne", color: "#ec4899" },
    { label: "AI Boty", sub: "Automatizácia obsahu", path: "/admin/autopilot", color: AMBER },
    { label: "Analytika", sub: `${visits} návštev dnes`, path: "/admin/analytika", color: "#f97316" },
    { label: "Zdroje", sub: "RSS a discovery", path: "/admin/zdroje", color: "#3b82f6" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        .qa-btn:hover { background: rgba(255,255,255,0.04) !important; }
        .recent-row:hover { opacity: 0.6; }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px 64px" }}>

        {/* ── STATUS BAR ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 0",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          marginBottom: 48,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.2em", color: "#22c55e" }}>LIVE</span>
            </div>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.15em", fontWeight: 600 }}>POSTOVINKY.NEWS</span>
            <span style={{ color: "rgba(255,255,255,0.1)", fontSize: 10 }}>·</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.15em", fontWeight: 600 }}>ADMIN CENTRUM</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {time && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em" }}>AKTUÁLNE {time}</span>}
            <button
              onClick={() => { setRefreshing(true); fetchData(); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", padding: 4, display: "flex" }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
            </button>
          </div>
        </div>

        {/* ── HERO ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 48, alignItems: "start", marginBottom: 56 }}>

          {/* Left: main metric */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginBottom: 20 }}>
              Centrum obsahu
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginBottom: 36 }}>
              <span style={{
                fontSize: "clamp(80px, 12vw, 128px)",
                fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.05em",
                fontVariantNumeric: "tabular-nums",
                background: "linear-gradient(155deg, #ffffff 30%, rgba(255,255,255,0.38) 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "block",
              }}>
                {published.length}
              </span>
              <div style={{ paddingBottom: 10 }}>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.38)", fontWeight: 500, lineHeight: 1.5 }}>
                  publikovaných<br />článkov
                </p>
                {todayPublished > 0 && (
                  <p style={{ fontSize: 13, color: "#22c55e", fontWeight: 700, marginTop: 6 }}>▲ +{todayPublished} dnes</p>
                )}
              </div>
            </div>

            {/* Sub-stats horizontal row */}
            <div style={{ display: "flex", alignItems: "center" }}>
              {[
                { label: "Návštev dnes", value: visits.toLocaleString("sk-SK"), color: AMBER },
                { label: "Odberateľov", value: subscribers.toString(), color: "#fff" },
                { label: "Za 7 dní", value: `+${thisWeek}`, color: "#22c55e" },
                { label: "V príprave", value: drafts.length.toString(), color: "rgba(255,255,255,0.45)" },
              ].map((stat, i) => (
                <div key={stat.label} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ padding: "0 28px" }}>
                    <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", color: stat.color, lineHeight: 1 }}>
                      {stat.value}
                    </p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 5, fontWeight: 600 }}>
                      {stat.label}
                    </p>
                  </div>
                  {i < 3 && <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.06)" }} />}
                </div>
              ))}
            </div>
          </div>

          {/* Right: 7-day chart */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginBottom: 16 }}>
              Aktivita 7 dní
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 88 }}>
              {weekDays.map((day) => {
                const heightPct = (day.count / maxDay) * 100;
                return (
                  <div key={day.dateStr} title={`${day.count} článkov`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 6 }}>
                    <div style={{
                      width: "100%",
                      height: `${Math.max(heightPct, day.count > 0 ? 8 : 0)}%`,
                      background: day.isToday ? AMBER : day.count > 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.04)",
                      borderRadius: "3px 3px 0 0",
                      minHeight: day.count > 0 ? 4 : 2,
                    }} />
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.05em", color: day.isToday ? AMBER : "rgba(255,255,255,0.18)" }}>
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── SEPARATOR ── */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)", marginBottom: 40 }} />

        {/* ── PIPELINE ── */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginBottom: 20 }}>
            Obsah Pipeline
          </p>
          <div style={{ display: "flex", alignItems: "stretch", gap: 0, height: 68 }}>
            {/* Drafts */}
            <div style={{
              display: "flex", flexDirection: "column", justifyContent: "center",
              padding: "0 28px", background: AMBER_DIM,
              border: `1px solid ${AMBER_BORDER}`, borderRadius: "12px 0 0 12px", minWidth: 120,
            }}>
              <p style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", color: AMBER, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {drafts.length}
              </p>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", marginTop: 4 }}>
                Drafty
              </p>
            </div>
            {/* Progress */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{
                position: "absolute", top: 0, left: 0, bottom: 0,
                width: `${pipelinePct}%`,
                background: `linear-gradient(90deg, ${AMBER_DIM}, transparent)`,
                borderRight: `1px solid ${AMBER_BORDER}`,
                transition: "width 1.2s ease",
              }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: "0 24px", gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", fontWeight: 600, letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
                  {pipelinePct}% publikovaných
                </span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
              </div>
            </div>
            {/* Published */}
            <div style={{
              display: "flex", flexDirection: "column", justifyContent: "center",
              padding: "0 28px", background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.15)", borderRadius: "0 12px 12px 0", minWidth: 120,
            }}>
              <p style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", color: "#22c55e", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {published.length}
              </p>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", marginTop: 4 }}>
                Live
              </p>
            </div>
          </div>
        </div>

        {/* ── SEPARATOR ── */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)", marginBottom: 40 }} />

        {/* ── QUICK ACTIONS + RECENT ── */}
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 60 }}>

          {/* Quick Actions */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginBottom: 20 }}>
              Rýchle akcie
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.path}
                  className="qa-btn"
                  onClick={() => router.push(action.path)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px 12px 18px",
                    background: "rgba(255,255,255,0.015)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderLeft: `3px solid ${action.color}`,
                    borderRadius: 10, cursor: "pointer", color: "#fff", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{action.label}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{action.sub}</p>
                  </div>
                  <ArrowRight size={13} style={{ color: "rgba(255,255,255,0.18)", flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>

          {/* Recent Articles */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>
                Posledné publikované
              </p>
              <button
                onClick={() => router.push("/admin/clanky")}
                style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}
              >
                Všetky <ArrowRight size={11} />
              </button>
            </div>

            {recent.length === 0 && (
              <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 13, padding: "24px 0" }}>Žiadne publikované články</p>
            )}
            {recent.map((article, idx) => (
              <div
                key={article.id}
                className="recent-row"
                onClick={() => router.push("/admin/clanky")}
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "13px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: "pointer", transition: "opacity 0.15s",
                }}
              >
                <span style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: "0.05em",
                  color: "rgba(255,255,255,0.15)", fontVariantNumeric: "tabular-nums",
                  minWidth: 22, fontFamily: "monospace",
                }}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                    {article.title}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {article.category && (
                      <span style={{ fontSize: 10, color: AMBER, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {article.category}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>·</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)" }}>
                      {new Date(article.created_at).toLocaleDateString("sk-SK", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
