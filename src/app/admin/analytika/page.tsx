"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  RefreshCw,
  TrendingUp,
  Users,
  Smartphone,
  Eye,
  Globe,
  Monitor,
  BarChart2,
  Mail,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface SiteVisit {
  path: string;
  visitor_id: string;
  country: string;
  city: string;
  device: string;
  browser: string;
  os: string;
  created_at: string;
  user_agent: string;
  referrer: string;
}

interface NewsletterSubscriber {
  email: string;
  updated_at: string;
}

interface DailyStats {
  date: string;
  visits: number;
  unique: number;
}

const ORANGE = "#f97316";
const ORANGE_DIM = "rgba(249,115,22,0.12)";
const ORANGE_BORDER = "rgba(249,115,22,0.25)";

function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
  live,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  icon: React.ElementType;
  live?: boolean;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: "20px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
          <p style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{value}</p>
          {sub && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 4 }}>{sub}</p>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {live && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "2px 8px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>LIVE</span>
            </div>
          )}
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `rgba(${accent === ORANGE ? "249,115,22" : "59,130,246"},0.1)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={16} style={{ color: accent }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [allVisits, setAllVisits] = useState<SiteVisit[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [showSubscribers, setShowSubscribers] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const totalVisits = allVisits.length;
  const uniqueVisitors = new Set(allVisits.map((v) => v.visitor_id).filter(Boolean)).size;
  const today = new Date().toISOString().split("T")[0];
  const todayVisits = allVisits.filter((v) => v.created_at.startsWith(today));
  const todayUnique = new Set(todayVisits.map((v) => v.visitor_id).filter(Boolean)).size;

  const dailyStats: DailyStats[] = (() => {
    const stats: { [key: string]: { visits: number; unique: Set<string> } } = {};
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split("T")[0]);
    }
    days.forEach((date) => {
      stats[date] = { visits: 0, unique: new Set() };
    });
    allVisits.forEach((visit) => {
      const date = visit.created_at.split("T")[0];
      if (stats[date]) {
        stats[date].visits++;
        if (visit.visitor_id) stats[date].unique.add(visit.visitor_id);
      }
    });
    return Object.entries(stats).map(([date, data]) => ({
      date,
      visits: data.visits,
      unique: data.unique.size,
    }));
  })();

  const topPages = (() => {
    const pages: { [key: string]: number } = {};
    allVisits.forEach((visit) => {
      pages[visit.path] = (pages[visit.path] || 0) + 1;
    });
    return Object.entries(pages).sort(([, a], [, b]) => b - a).slice(0, 10);
  })();

  const countries = (() => {
    const countryMap: { [key: string]: number } = {};
    allVisits.forEach((visit) => {
      const code = visit.country || "UNKNOWN";
      countryMap[code] = (countryMap[code] || 0) + 1;
    });
    return Object.entries(countryMap).sort(([, a], [, b]) => b - a).slice(0, 10);
  })();

  const devices = (() => {
    const deviceMap: { [key: string]: number } = {};
    allVisits.forEach((visit) => {
      const device = visit.device?.toLowerCase() || "unknown";
      deviceMap[device] = (deviceMap[device] || 0) + 1;
    });
    return Object.entries(deviceMap).sort(([, a], [, b]) => b - a);
  })();

  const browsers = (() => {
    const browserMap: { [key: string]: number } = {};
    allVisits.forEach((visit) => {
      const browser = visit.browser || "Unknown";
      browserMap[browser] = (browserMap[browser] || 0) + 1;
    });
    return Object.entries(browserMap).sort(([, a], [, b]) => b - a).slice(0, 5);
  })();

  const recentVisits = allVisits.slice(-15).reverse();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [{ data: visitsData }, { data: subscribersData }] = await Promise.all([
          supabase
            .from("site_visits")
            .select("*")
            .gte("created_at", thirtyDaysAgo.toISOString())
            .order("created_at", { ascending: false })
            .limit(50000),
          supabase.from("newsletter_subscribers").select("*"),
        ]);
        setAllVisits(visitsData || []);
        setSubscribers(subscribersData || []);
        setLastUpdated(
          new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        );
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const maxDailyVisits = Math.max(...dailyStats.map((d) => d.visits), 1);

  const getCountryFlag = (code: string) => {
    const flags: { [key: string]: string } = {
      SK: "🇸🇰", CZ: "🇨🇿", US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪",
      FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸", PL: "🇵🇱", RO: "🇷🇴",
    };
    return flags[code] || "🌍";
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}`;
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: "2px solid rgba(249,115,22,0.3)", borderTopColor: ORANGE, borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Načítavam analytiku...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .bar-wrap:hover .bar-tooltip { opacity: 1 !important; }
      `}</style>
      <div style={{ padding: "32px", maxWidth: "none" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 40, gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: ORANGE_DIM, border: `1px solid ${ORANGE_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BarChart2 size={20} style={{ color: ORANGE }} />
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Analytika</h1>
            </div>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
              {lastUpdated ? `Aktualizované o ${lastUpdated}` : "Načítavanie..."}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
          >
            <RefreshCw size={14} />
            Obnoviť
          </button>
        </div>

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          <StatCard label="Dnes" value={todayVisits.length} sub={`${todayUnique} unikátnych`} accent={ORANGE} icon={Eye} live />
          <StatCard label="Posledné 30d" value={totalVisits.toLocaleString()} sub={`${uniqueVisitors} unikátnych`} accent={ORANGE} icon={TrendingUp} />
          <StatCard label="Priemer/deň" value={Math.round(totalVisits / Math.max(30, 1))} sub="Posledné 30 dní" accent={ORANGE} icon={BarChart2} />
          <StatCard
            label="Konverzia"
            value={`${uniqueVisitors > 0 ? Math.round((subscribers.length / uniqueVisitors) * 100) : 0}%`}
            sub={`${subscribers.length} odberateľov`}
            accent={ORANGE}
            icon={Users}
          />
        </div>

        {/* Activity Chart */}
        <div
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: "24px",
            marginBottom: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${ORANGE}, transparent)` }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <TrendingUp size={18} style={{ color: ORANGE }} />
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Aktivita – posledných 30 dní</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: ORANGE }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Návštevy</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 160, paddingBottom: 24, position: "relative" }}>
            {/* Y-axis labels */}
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 24, width: 30, display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "right" }}>{maxDailyVisits}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "right" }}>{Math.round(maxDailyVisits / 2)}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "right" }}>0</span>
            </div>

            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3, height: "100%", paddingLeft: 36 }}>
              {dailyStats.map((day, idx) => {
                const heightPct = maxDailyVisits > 0 ? (day.visits / maxDailyVisits) * 100 : 0;
                const isHovered = hoveredBar === idx;
                return (
                  <div
                    key={idx}
                    className="bar-wrap"
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", position: "relative", cursor: "pointer" }}
                    onMouseEnter={() => setHoveredBar(idx)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Tooltip */}
                    <div
                      className="bar-tooltip"
                      style={{
                        position: "absolute",
                        bottom: "100%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        marginBottom: 8,
                        background: "rgba(20,20,20,0.95)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 11,
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        opacity: isHovered ? 1 : 0,
                        transition: "opacity 0.15s",
                        zIndex: 10,
                      }}
                    >
                      <p style={{ color: "#fff", fontWeight: 600, marginBottom: 2 }}>{formatDate(day.date)}</p>
                      <p style={{ color: ORANGE }}>{day.visits} návštev</p>
                      <p style={{ color: "rgba(255,255,255,0.4)" }}>{day.unique} unikát.</p>
                    </div>

                    {/* Bar */}
                    <div
                      style={{
                        width: "100%",
                        height: `${Math.max(heightPct, day.visits > 0 ? 3 : 0)}%`,
                        background: isHovered
                          ? `linear-gradient(to top, ${ORANGE}, rgba(249,115,22,0.6))`
                          : `linear-gradient(to top, rgba(249,115,22,0.7), rgba(249,115,22,0.3))`,
                        borderRadius: "3px 3px 0 0",
                        transition: "background 0.15s",
                        minHeight: day.visits > 0 ? 3 : 0,
                      }}
                    />

                    {/* X-axis label */}
                    {idx % 7 === 0 && (
                      <span style={{ position: "absolute", bottom: -20, fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                        {new Date(day.date).getDate()}.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Two col: Top Pages + Countries */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Top Pages */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.5), transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Globe size={16} style={{ color: ORANGE }} />
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>Top Stránky</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {topPages.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Žiadne dáta</p>}
              {topPages.map(([path, count], idx) => (
                <div key={path} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, fontFamily: "monospace", minWidth: 16, textAlign: "right" }}>{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{path || "/"}</p>
                    <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(count / topPages[0][1]) * 100}%`, background: `linear-gradient(90deg, ${ORANGE}, rgba(249,115,22,0.5))`, borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, whiteSpace: "nowrap" }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Countries */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.5), transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Globe size={16} style={{ color: ORANGE }} />
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>Krajiny</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {countries.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Žiadne dáta</p>}
              {countries.map(([code, count]) => (
                <div key={code} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{getCountryFlag(code)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{code}</p>
                    <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(count / countries[0][1]) * 100}%`, background: "linear-gradient(90deg, rgba(34,197,94,0.8), rgba(34,197,94,0.3))", borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Three col: Devices + Browsers + Newsletter */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Devices */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.5), transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Smartphone size={16} style={{ color: "#a855f7" }} />
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>Zariadenia</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {devices.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Žiadne dáta</p>}
              {devices.map(([device, count]) => {
                const total = devices.reduce((s, [, c]) => s + c, 0);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={device}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>{device}</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{pct}%</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #a855f7, rgba(168,85,247,0.4))", borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Browsers */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Monitor size={16} style={{ color: "#3b82f6" }} />
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>Prehliadače</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {browsers.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Žiadne dáta</p>}
              {browsers.map(([browser, count], idx) => {
                const total = browsers.reduce((s, [, c]) => s + c, 0);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={browser}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{browser}</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{pct}%</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #3b82f6, rgba(59,130,246,0.4))", borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Newsletter */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(236,72,153,0.5), transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Mail size={16} style={{ color: "#ec4899" }} />
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>Newsletter</h2>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{subscribers.length}</span>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>odberateľov</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginBottom: 16 }}>
              {uniqueVisitors > 0 ? `${Math.round((subscribers.length / uniqueVisitors) * 100)}% konverzný pomer` : "—"}
            </p>
            <button
              onClick={() => setShowSubscribers(!showSubscribers)}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#ec4899", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {showSubscribers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showSubscribers ? "Skryť zoznam" : "Zobraziť zoznam"}
            </button>
            {showSubscribers && (
              <div style={{ marginTop: 12, maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {subscribers.slice(0, 20).map((sub) => (
                  <p key={sub.email} style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {sub.email}
                  </p>
                ))}
                {subscribers.length > 20 && (
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>+{subscribers.length - 20} ďalších</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Visits Table */}
        <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${ORANGE}, transparent)` }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Eye size={16} style={{ color: ORANGE }} />
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Posledné Návštevy</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Stránka", "Krajina", "Zariadenie", "Prehliadač", "Čas"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "rgba(255,255,255,0.3)", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentVisits.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "20px 12px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Žiadne návštevy</td>
                  </tr>
                )}
                {recentVisits.map((visit, idx) => (
                  <tr
                    key={idx}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                  >
                    <td style={{ padding: "10px 12px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{visit.path || "/"}</td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.5)" }}>
                      {getCountryFlag(visit.country)} {visit.country}
                    </td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.5)", textTransform: "capitalize" }}>{visit.device || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.5)" }}>{visit.browser || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                      {new Date(visit.created_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
