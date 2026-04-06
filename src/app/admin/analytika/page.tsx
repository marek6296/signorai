"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, TrendingUp, Users, Smartphone, Eye, Globe,
  Monitor, BarChart2, Mail, Crown, User, UserCheck,
} from "lucide-react";
import Image from "next/image";

/* ── Types ──────────────────────────────────────────────────── */
interface DailyStat  { date: string; visits: number; unique_visitors: number }
interface PageStat   { path: string; visits: number }
interface CountryStat { country: string; visits: number }
interface DeviceStat  { device: string; visits: number }
interface BrowserStat { browser: string; visits: number }
interface RoleStat    { role: string; count: number }
interface SourceStat  { source: string; count: number }
interface RecentVisit { path: string; country: string; device: string; browser: string; created_at: string; referrer: string }
interface UserRow     { id: string; email: string; full_name: string | null; avatar_url: string | null; role: string; created_at: string }

interface AnalyticsData {
  totalVisits: number;
  uniqueVisitors: number;
  todayVisits: number;
  todayUnique: number;
  allTimeVisits: number;
  dailyStats: DailyStat[];
  topPages: PageStat[];
  countries: CountryStat[];
  devices: DeviceStat[];
  browsers: BrowserStat[];
  recentVisits: RecentVisit[];
  registeredUsers: UserRow[];
  usersByRole: RoleStat[];
  newsletterCount: number;
  newsletterBySource: SourceStat[];
}

/* ── Constants ─────────────────────────────────────────────── */
const ORANGE = "#f97316";
const ORANGE_DIM = "rgba(249,115,22,0.12)";
const ORANGE_BORDER = "rgba(249,115,22,0.25)";
const CARD = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px 24px", position: "relative" as const, overflow: "hidden" as const };

const FLAGS: Record<string, string> = {
  SK: "🇸🇰", CZ: "🇨🇿", US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪",
  FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸", PL: "🇵🇱", RO: "🇷🇴",
  AT: "🇦🇹", HU: "🇭🇺", UA: "🇺🇦", NL: "🇳🇱", SE: "🇸🇪",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "#fbbf24", moderator: "#c084fc", editor: "#60a5fa", user: "rgba(255,255,255,0.4)",
};
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", moderator: "Moderátor", editor: "Editor", user: "Používateľ",
};
const SOURCE_LABELS: Record<string, string> = {
  registration: "Registrácia", website: "Web formulár", footer: "Footer", other: "Iné",
};

/* ── Helper components ─────────────────────────────────────── */
function TopLine({ color }: { color: string }) {
  return <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${color},transparent)` }} />;
}

function StatCard({ label, value, sub, accent, icon: Icon, live }: {
  label: string; value: string | number; sub?: string; accent: string; icon: React.ElementType; live?: boolean;
}) {
  return (
    <div style={CARD}>
      <TopLine color={accent} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</p>
          <p style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, marginBottom: 4, color: "#fff" }}>{typeof value === "number" ? value.toLocaleString("sk-SK") : value}</p>
          {sub && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 4 }}>{sub}</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {live && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "2px 8px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>LIVE</span>
            </div>
          )}
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={17} style={{ color: accent }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BarList({ items, total, color }: { items: [string, number][]; total: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map(([label, val]) => {
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        return (
          <div key={label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>{label}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{val.toLocaleString()} <span style={{ color: "rgba(255,255,255,0.2)" }}>({pct}%)</span></span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${color},${color}60)`, borderRadius: 2, transition: "width 0.6s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/analytics");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: `2px solid ${ORANGE_BORDER}`, borderTopColor: ORANGE, borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Načítavam analytiku...</p>
        </div>
      </div>
    );
  }

  const { totalVisits, uniqueVisitors, todayVisits, todayUnique, allTimeVisits,
    dailyStats, topPages, countries, devices, browsers, recentVisits,
    registeredUsers, usersByRole, newsletterCount, newsletterBySource } = data;

  const maxDailyVisits = Math.max(...dailyStats.map((d) => d.visits), 1);
  const totalDevices = devices.reduce((s, d) => s + d.visits, 0);
  const totalBrowsers = browsers.reduce((s, b) => s + b.visits, 0);
  const totalUsers = usersByRole.reduce((s, r) => s + r.count, 0);

  const formatDate = (s: string) => { const d = new Date(s); return `${d.getDate()}.${d.getMonth() + 1}`; };

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .analytics-stats-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:24px; }
        .analytics-two-col    { display:grid; grid-template-columns:1fr; gap:14px; margin-bottom:14px; }
        .analytics-three-col  { display:grid; grid-template-columns:1fr; gap:14px; margin-bottom:14px; }
        .analytics-header     { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:28px; gap:12px; flex-wrap:wrap; }
        @media(min-width:640px){
          .analytics-stats-grid { grid-template-columns:repeat(3,1fr); }
          .analytics-two-col    { grid-template-columns:1fr 1fr; }
          .analytics-three-col  { grid-template-columns:1fr 1fr; }
        }
        @media(min-width:1024px){
          .analytics-stats-grid { grid-template-columns:repeat(5,1fr); gap:14px; margin-bottom:28px; }
          .analytics-three-col  { grid-template-columns:1fr 1fr 1fr; }
        }
      `}</style>
      <div className="p-4 sm:p-6 lg:p-8" style={{ maxWidth: "none" }}>

        {/* ── Header ── */}
        <div className="analytics-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: ORANGE_DIM, border: `1px solid ${ORANGE_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BarChart2 size={20} style={{ color: ORANGE }} />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Analytika</h1>
            </div>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginLeft: 52 }}>
              {lastUpdated ? `Aktualizované o ${lastUpdated}` : "Načítavanie..."}
              <span style={{ marginLeft: 12, color: "rgba(255,255,255,0.15)" }}>Všetky čísla bez limitu</span>
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Obnoviť
          </button>
        </div>

        {/* ── Stats Row ── */}
        <div className="analytics-stats-grid">
          <StatCard label="Dnes" value={todayVisits} sub={`${todayUnique} unikátnych`} accent={ORANGE} icon={Eye} live />
          <StatCard label="Posledné 30d" value={totalVisits} sub={`${uniqueVisitors} unikátnych`} accent={ORANGE} icon={TrendingUp} />
          <StatCard label="Celkovo (all-time)" value={allTimeVisits} sub="Od začiatku" accent="#60a5fa" icon={BarChart2} />
          <StatCard label="Registrovaní" value={totalUsers} sub={`${usersByRole.find(r=>r.role==="admin")?.count ?? 0} adminov`} accent="#a855f7" icon={Users} />
          <StatCard label="Newsletter" value={newsletterCount} sub={`${uniqueVisitors > 0 ? Math.round((newsletterCount / uniqueVisitors) * 100) : 0}% konverzia`} accent="#ec4899" icon={Mail} />
        </div>

        {/* ── Chart ── */}
        <div style={{ ...CARD, padding: 24, marginBottom: 20 }}>
          <TopLine color={ORANGE} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <TrendingUp size={18} style={{ color: ORANGE }} />
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Aktivita – posledných 30 dní</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: ORANGE }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Návštevy</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(59,130,246,0.7)" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Unikátni</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 160, paddingBottom: 24, position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 24, width: 36, display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "right" }}>{maxDailyVisits.toLocaleString()}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "right" }}>{Math.round(maxDailyVisits / 2).toLocaleString()}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "right" }}>0</span>
            </div>

            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 2, height: "100%", paddingLeft: 40 }}>
              {dailyStats.map((day, idx) => {
                const hPct = maxDailyVisits > 0 ? (day.visits / maxDailyVisits) * 100 : 0;
                const uPct = maxDailyVisits > 0 ? (day.unique_visitors / maxDailyVisits) * 100 : 0;
                const isHov = hoveredBar === idx;
                return (
                  <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", position: "relative", cursor: "pointer" }}
                    onMouseEnter={() => setHoveredBar(idx)} onMouseLeave={() => setHoveredBar(null)}>
                    {/* Tooltip */}
                    {isHov && (
                      <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 8, background: "rgba(15,15,15,0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", fontSize: 11, whiteSpace: "nowrap", zIndex: 10 }}>
                        <p style={{ color: "#fff", fontWeight: 700, marginBottom: 4 }}>{formatDate(day.date)}</p>
                        <p style={{ color: ORANGE }}>{day.visits.toLocaleString()} návštev</p>
                        <p style={{ color: "#60a5fa" }}>{day.unique_visitors.toLocaleString()} unikát.</p>
                      </div>
                    )}
                    {/* Unique bar (behind) */}
                    <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${Math.max(uPct, day.unique_visitors > 0 ? 2 : 0)}%`, background: "rgba(59,130,246,0.35)", borderRadius: "2px 2px 0 0" }} />
                    {/* Visits bar (front) */}
                    <div style={{ position: "absolute", bottom: 0, width: "60%", height: `${Math.max(hPct, day.visits > 0 ? 3 : 0)}%`, background: isHov ? `linear-gradient(to top,${ORANGE},rgba(249,115,22,0.6))` : `linear-gradient(to top,rgba(249,115,22,0.8),rgba(249,115,22,0.35))`, borderRadius: "2px 2px 0 0", transition: "background 0.15s" }} />
                    {idx % 7 === 0 && (
                      <span style={{ position: "absolute", bottom: -20, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                        {new Date(day.date).getDate()}.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Top Pages + Countries ── */}
        <div className="analytics-two-col">
          <div style={CARD}>
            <TopLine color={ORANGE} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <Globe size={15} style={{ color: ORANGE }} />
              <h2 style={{ fontSize: 14, fontWeight: 700 }}>Top Stránky</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {topPages.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Žiadne dáta</p>}
              {topPages.map(({ path, visits }, idx) => (
                <div key={path} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 11, fontFamily: "monospace", minWidth: 14, textAlign: "right" }}>{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>{path || "/"}</p>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(visits / (topPages[0]?.visits || 1)) * 100}%`, background: `linear-gradient(90deg,${ORANGE},rgba(249,115,22,0.4))`, borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, whiteSpace: "nowrap" }}>{visits.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={CARD}>
            <TopLine color="#22c55e" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <Globe size={15} style={{ color: "#22c55e" }} />
              <h2 style={{ fontSize: 14, fontWeight: 700 }}>Krajiny</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {countries.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Žiadne dáta</p>}
              {countries.map(({ country, visits }) => (
                <div key={country} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{FLAGS[country] || "🌍"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{country}</p>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(visits / (countries[0]?.visits || 1)) * 100}%`, background: "linear-gradient(90deg,rgba(34,197,94,0.8),rgba(34,197,94,0.3))", borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{visits.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Devices + Browsers + Newsletter ── */}
        <div className="analytics-three-col">
          <div style={CARD}>
            <TopLine color="#a855f7" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <Smartphone size={15} style={{ color: "#a855f7" }} />
              <h2 style={{ fontSize: 14, fontWeight: 700 }}>Zariadenia</h2>
            </div>
            <BarList items={devices.map(d => [d.device, d.visits])} total={totalDevices} color="#a855f7" />
          </div>

          <div style={CARD}>
            <TopLine color="#3b82f6" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <Monitor size={15} style={{ color: "#3b82f6" }} />
              <h2 style={{ fontSize: 14, fontWeight: 700 }}>Prehliadače</h2>
            </div>
            <BarList items={browsers.map(b => [b.browser, b.visits])} total={totalBrowsers} color="#3b82f6" />
          </div>

          <div style={CARD}>
            <TopLine color="#ec4899" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <Mail size={15} style={{ color: "#ec4899" }} />
              <h2 style={{ fontSize: 14, fontWeight: 700 }}>Newsletter</h2>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: "#ec4899" }}>{newsletterCount}</span>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>aktívnych odberateľov</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {newsletterBySource.map(({ source, count }) => (
                <div key={source} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{SOURCE_LABELS[source] ?? source}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#ec4899" }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Registered Users Section ── */}
        <div style={{ ...CARD, marginBottom: 16 }}>
          <TopLine color="#a855f7" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Users size={16} style={{ color: "#a855f7" }} />
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Registrovaní Používatelia</h2>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 20, padding: "2px 10px" }}>
                {totalUsers} celkom
              </span>
            </div>

            {/* Role breakdown pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {usersByRole.map(({ role, count }) => (
                <div key={role} style={{ display: "flex", alignItems: "center", gap: 5, background: `${ROLE_COLORS[role] ?? "#fff"}12`, border: `1px solid ${ROLE_COLORS[role] ?? "#fff"}25`, borderRadius: 20, padding: "3px 10px" }}>
                  {role === "admin" && <Crown size={10} style={{ color: ROLE_COLORS.admin }} />}
                  {role === "user" && <User size={10} style={{ color: ROLE_COLORS.user }} />}
                  {role === "editor" && <UserCheck size={10} style={{ color: ROLE_COLORS.editor }} />}
                  <span style={{ fontSize: 10, fontWeight: 700, color: ROLE_COLORS[role] ?? "#fff", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {ROLE_LABELS[role] ?? role}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLORS[role] ?? "#fff" }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Users table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Používateľ", "Email", "Rola", "Registrácia"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "rgba(255,255,255,0.25)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registeredUsers.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "20px 12px", textAlign: "center", color: "rgba(255,255,255,0.2)" }}>Žiadni používatelia</td></tr>
                )}
                {registeredUsers.map((u) => {
                  const initials = (u.full_name || u.email || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                  const rc = ROLE_COLORS[u.role] ?? "#fff";
                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {u.avatar_url
                            ? <Image src={u.avatar_url} alt="" width={28} height={28} style={{ borderRadius: "50%", objectFit: "cover" }} unoptimized />
                            : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.4)" }}>{initials}</div>
                          }
                          <span style={{ fontWeight: 600 }}>{u.full_name || "—"}</span>
                          {u.role === "admin" && <Crown size={11} style={{ color: "#fbbf24" }} />}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{u.email}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: `${rc}12`, color: rc, border: `1px solid ${rc}25`, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                        {new Date(u.created_at).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recent Visits ── */}
        <div style={CARD}>
          <TopLine color={ORANGE} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Eye size={15} style={{ color: ORANGE }} />
            <h2 style={{ fontSize: 14, fontWeight: 700 }}>Posledné Návštevy</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Stránka", "Krajina", "Zariadenie", "Prehliadač", "Čas"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "7px 10px", color: "rgba(255,255,255,0.25)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentVisits.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "rgba(255,255,255,0.2)" }}>Žiadne návštevy</td></tr>
                )}
                {recentVisits.map((v, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                    <td style={{ padding: "9px 10px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.path || "/"}</td>
                    <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.45)" }}>{FLAGS[v.country] ?? "🌍"} {v.country}</td>
                    <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.45)", textTransform: "capitalize" }}>{v.device || "—"}</td>
                    <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.45)" }}>{v.browser || "—"}</td>
                    <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}>
                      {new Date(v.created_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
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
