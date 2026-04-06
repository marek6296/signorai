"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowRight, RefreshCw, TrendingUp, Users, Eye, Zap, BarChart2 } from "lucide-react";

interface Article {
  id: string;
  title: string;
  status: string;
  published_at: string;
  category?: string;
  slug?: string;
}


export default function AdminDashboard() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [todayVisitsCount, setTodayVisitsCount] = useState(0);
  const [allVisitsCount, setAllVisitsCount] = useState(0);
  const [uniqueTodayVisitors, setUniqueTodayVisitors] = useState(0);
  const [uniqueAllVisitors, setUniqueAllVisitors] = useState(0);
  const [subscribers, setSubscribers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [time, setTime] = useState("");

  const published = articles.filter((a) => a.status === "published");
  const drafts = articles.filter((a) => a.status === "draft");
  const todayStr = new Date().toISOString().split("T")[0];
  const todayPublished = published.filter((a) => a.published_at?.startsWith(todayStr)).length;

  // 7-day stats (articles only — visits counted server-side)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const publishedLast7Days = published.filter((a) => {
    const d = new Date(a.published_at);
    return d >= sevenDaysAgo;
  }).length;

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0];
    const count = published.filter((a) => a.published_at?.startsWith(dateStr)).length;
    return {
      dateStr,
      label: d.toLocaleDateString("sk-SK", { weekday: "short" }).toUpperCase().substring(0, 2),
      count,
      isToday: i === 6,
    };
  });
  const maxDay = Math.max(...weekDays.map((d) => d.count), 1);

  const recent = [...published]
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, 8);

  const fetchData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
      const todayStart = today + "T00:00:00";

      const [
        articlesRes,
        todayCountRes,
        thirtyDayCountRes,
        todayUniqueRes,
        thirtyDayUniqueRes,
        subsRes,
      ] = await Promise.all([
        supabase.from("articles").select("id,title,status,published_at,category,slug").order("published_at", { ascending: false }).limit(500),
        // COUNT — nevraciaj riadky, len číslo (obchádza limit 1000)
        supabase.from("site_visits").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
        supabase.from("site_visits").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgoISO),
        // Unique visitors cez RPC (funguje na ľubovoľný objem)
        supabase.rpc("count_unique_visitors", { since: todayStart }).maybeSingle(),
        supabase.rpc("count_unique_visitors", { since: thirtyDaysAgoISO }).maybeSingle(),
        supabase.from("newsletter_subscribers").select("*", { count: "exact", head: true }),
      ]);

      if (articlesRes.error) throw articlesRes.error;

      const todayCount = todayCountRes.count ?? 0;
      const thirtyDayCount = thirtyDayCountRes.count ?? 0;
      const todayUnique = todayUniqueRes.data?.count ?? 0;
      const thirtyDayUnique = thirtyDayUniqueRes.data?.count ?? 0;

      console.log("[Dashboard] Articles:", articlesRes.data?.length || 0);
      console.log("[Dashboard] Today visits (exact count):", todayCount);
      console.log("[Dashboard] 30d visits (exact count):", thirtyDayCount);
      console.log("[Dashboard] Today unique:", todayUnique);
      console.log("[Dashboard] 30d unique:", thirtyDayUnique);

      setArticles(articlesRes.data || []);
      setTodayVisitsCount(todayCount);
      setAllVisitsCount(thirtyDayCount);
      setUniqueTodayVisitors(todayUnique);
      setUniqueAllVisitors(thirtyDayUnique);
      setSubscribers(subsRes.count || 0);
      setTime(new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      console.error("[Dashboard] Error fetching data:", e);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Načítavam dashboard...</p>
        </div>
      </div>
    );
  }

  const pipelinePct =
    published.length + drafts.length > 0
      ? Math.round((published.length / (published.length + drafts.length)) * 100)
      : 0;

  const QUICK_ACTIONS = [
    { label: "Vytvoriť článok", sub: "AI generovanie obsahu", path: "/admin/tvorba", icon: Zap, color: "from-purple-500 to-purple-600" },
    { label: "Správa článkov", sub: `${drafts.length} draft · ${published.length} live`, path: "/admin/clanky", icon: BarChart2, color: "from-green-500 to-green-600" },
    { label: "Sociálne siete", sub: "Instagram · Facebook", path: "/admin/socialne", icon: TrendingUp, color: "from-pink-500 to-pink-600" },
    { label: "AI Boty", sub: "Automatizácia obsahu", path: "/admin/autopilot", icon: Zap, color: "from-amber-500 to-amber-600" },
    { label: "Analytika", sub: `${todayVisitsCount} návštev dnes`, path: "/admin/analytika", icon: Eye, color: "from-orange-500 to-orange-600" },
    { label: "Chatbot", sub: "AI asistent nastavenia", path: "/admin/chatbot", icon: Users, color: "from-blue-500 to-blue-600" },
  ];

  interface StatBoxProps {
    label: string;
    value: string | number;
    sub?: string;
    icon: React.ReactNode;
    trend?: string;
  }

  const StatBox = ({ label, value, sub, icon, trend }: StatBoxProps) => (
    <div className="card-glass border border-accent rounded-2xl p-6 hover:border-amber-500/40 transition duration-500 group glow-border">
      <div className="flex items-start justify-between mb-4">
        <div className="text-xs font-black text-amber-400/70 uppercase tracking-widest">{label}</div>
        <div className="text-amber-500/20 group-hover:text-amber-500/40 transition">{icon}</div>
      </div>
      <div className="mb-3">
        <p className="text-5xl font-black text-transparent bg-gradient-to-r from-amber-300 via-white to-amber-200 bg-clip-text font-mono">{typeof value === 'number' ? value.toLocaleString('sk-SK') : value}</p>
        {sub && <p className="text-xs text-gray-400 mt-2 font-medium">{sub}</p>}
      </div>
      {trend && <p className="text-xs text-emerald-400 font-bold flex items-center gap-1">↗ {trend}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        @keyframes pulse-subtle { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(245,158,11,0.05); } 50% { box-shadow: 0 0 30px rgba(245,158,11,0.1); } }
        .pulse-subtle { animation: pulse-subtle 3s ease-in-out infinite; }
        .stat-trend { animation: pulse-subtle 2s ease-in-out infinite; }
        .glow-border { animation: glow 3s ease-in-out infinite; }
        .card-glass { background: rgba(20,20,20,0.6); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); }
        .border-accent { border-color: rgba(245,158,11,0.2); }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 sm:mb-12 pb-6 sm:pb-8 border-b border-amber-500/10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative w-10 h-10 sm:w-14 sm:h-14 shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-xl blur-lg" />
              <div className="relative w-full h-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-xl flex items-center justify-center">
                <BarChart2 className="w-5 h-5 sm:w-7 sm:h-7 text-amber-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">Dashboard</h1>
              <p className="text-amber-400/60 text-[10px] font-bold tracking-wider mt-0.5">{time ? `Sync: ${time}` : "ADMIN PANEL"}</p>
            </div>
          </div>
          <button
            onClick={() => { setRefreshing(true); fetchData(); }}
            className="flex items-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 card-glass border border-accent hover:border-amber-500/40 rounded-xl text-sm text-gray-300 hover:text-amber-300 transition duration-300 group shrink-0"
          >
            <RefreshCw className={`w-4 h-4 transition ${refreshing ? 'animate-spin' : 'group-hover:rotate-180'}`} />
            <span className="font-bold hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatBox
            label="Dnes"
            value={todayVisitsCount}
            sub={`${uniqueTodayVisitors} unikátnych`}
            icon={<Eye className="w-4 h-4" />}
            trend={todayPublished > 0 ? `+${todayPublished} nových` : undefined}
          />
          <StatBox
            label="30 dní"
            value={allVisitsCount}
            sub={`${uniqueAllVisitors} unikátnych`}
            icon={<TrendingUp className="w-4 h-4" />}
            trend={publishedLast7Days > 0 ? `+${publishedLast7Days} za 7 dní` : undefined}
          />
          <StatBox
            label="Články"
            value={published.length}
            sub={`${drafts.length} v príprave`}
            icon={<BarChart2 className="w-4 h-4" />}
          />
          <StatBox
            label="Newsletter"
            value={subscribers}
            sub={uniqueAllVisitors > 0 ? `${Math.round((subscribers / uniqueAllVisitors) * 100)}% konverzia` : "—"}
            icon={<Users className="w-4 h-4" />}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Publishing Pipeline */}
          <div className="lg:col-span-2 card-glass border border-accent rounded-2xl p-5 sm:p-8 glow-border">
            <div className="flex items-center justify-between mb-5 sm:mb-8">
              <h2 className="text-xs font-black text-amber-400/70 uppercase tracking-widest">Content Pipeline</h2>
              <span className="text-xs font-bold text-gray-500">{pipelinePct}% Ready</span>
            </div>
            <div className="flex gap-3 sm:gap-4 h-20 sm:h-24">
              <div className="flex-1 bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/20 rounded-xl p-5 flex flex-col justify-center group hover:border-amber-500/40 transition">
                <p className="text-3xl font-black text-amber-400">{drafts.length}</p>
                <p className="text-xs text-amber-300/60 mt-2 font-bold tracking-wider">DRAFTS</p>
              </div>
              <div className="flex-1 flex items-center px-6">
                <div className="w-full">
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500" style={{ width: `${pipelinePct}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-3 text-center font-bold">{pipelinePct}% PUBLISHED</p>
                </div>
              </div>
              <div className="flex-1 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 flex flex-col justify-center group hover:border-emerald-500/40 transition">
                <p className="text-3xl font-black text-emerald-400">{published.length}</p>
                <p className="text-xs text-emerald-300/60 mt-2 font-bold tracking-wider">LIVE</p>
              </div>
            </div>
          </div>

          {/* 7-Day Activity */}
          <div className="card-glass border border-accent rounded-2xl p-8 glow-border">
            <h2 className="text-xs font-black text-amber-400/70 uppercase tracking-widest mb-8">7-Day Activity</h2>
            <div className="flex items-flex-end gap-2 h-28">
              {weekDays.map((day) => {
                const heightPct = maxDay > 0 ? (day.count / maxDay) * 100 : 0;
                return (
                  <div
                    key={day.dateStr}
                    className="flex-1 flex flex-col items-center gap-3 cursor-pointer group"
                    title={`${day.count} články`}
                  >
                    <div className="w-full bg-gray-800 rounded-lg overflow-hidden h-full flex items-flex-end border border-gray-700 group-hover:border-amber-500/30 transition">
                      <div
                        className={`w-full transition-all duration-300 rounded-t-lg ${day.isToday ? 'bg-gradient-to-t from-amber-500 via-amber-400 to-amber-400 shadow-lg shadow-amber-500/30' : 'bg-gradient-to-t from-gray-600 to-gray-700 group-hover:from-gray-500 group-hover:to-gray-600'}`}
                        style={{ height: `${Math.max(heightPct, day.count > 0 ? 12 : 2)}%`, minHeight: day.count > 0 ? 6 : 2 }}
                      />
                    </div>
                    <span className={`text-xs font-black tracking-widest ${day.isToday ? 'text-amber-400' : 'text-gray-500 group-hover:text-gray-400'}`}>
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-10">
          <h2 className="text-xs font-black text-amber-400/70 uppercase tracking-widest mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {QUICK_ACTIONS.map((action) => {
              const IconComponent = action.icon;
              return (
                <button
                  key={action.path}
                  onClick={() => router.push(action.path)}
                  className="group card-glass border border-gray-800 hover:border-amber-500/30 rounded-xl p-5 text-left transition duration-300 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black opacity-0 group-hover:opacity-40 transition duration-300" />
                  <div className={`relative w-10 h-10 rounded-lg bg-gradient-to-br ${action.color} p-2 mb-4 group-hover:scale-110 transition duration-300 shadow-lg`}>
                    <IconComponent className="w-full h-full text-white" />
                  </div>
                  <p className="relative text-sm font-bold text-white mb-2 group-hover:text-amber-300 transition">{action.label}</p>
                  <p className="relative text-xs text-gray-400 line-clamp-2 group-hover:text-gray-300 transition">{action.sub}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Articles */}
        <div className="card-glass border border-accent rounded-2xl p-8 glow-border">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs font-black text-amber-400/70 uppercase tracking-widest">Latest Published</h2>
            <button
              onClick={() => router.push("/admin/clanky")}
              className="text-xs text-amber-400/60 hover:text-amber-300 transition flex items-center gap-2 font-bold group"
            >
              View All <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition" />
            </button>
          </div>

          {recent.length === 0 ? (
            <p className="text-gray-500 text-sm py-12 text-center font-medium">Žiadne publikované články</p>
          ) : (
            <div className="space-y-3">
              {recent.map((article, idx) => (
                <button
                  key={article.id}
                  onClick={() => router.push(`/admin/clanky`)}
                  className="w-full text-left p-4 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition border border-gray-800 hover:border-amber-500/20 group"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-xs font-black text-amber-400/50 mt-0.5 min-w-[24px] text-right">#{String(idx + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate group-hover:text-amber-300 transition">
                        {article.title}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        {article.category && (
                          <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                            {article.category}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 font-medium">
                          {new Date(article.published_at).toLocaleDateString("sk-SK", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1 shadow-lg shadow-emerald-500/50" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
