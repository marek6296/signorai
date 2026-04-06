/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Zap,
  Clock,
  Image as ImageIcon,
  Type,
  Layers,
  Instagram,
  Facebook,
  Globe,
  Play,
  RefreshCw,
  Settings2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  FileText,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────── */
type BotSettings = {
  enabled: boolean;
  // Schedule
  run_times: string[];          // ["09:00", "15:00", "21:00"]
  // Content
  categories: string[];         // ["AI", "Tech"]
  // Social
  post_instagram: boolean;
  post_facebook: boolean;
  instagram_format: "image_text" | "text_only" | "article_bg";
  auto_publish_social: boolean;
  // Stats
  last_run: string | null;
  processed_count: number;
};

type HistoryItem = {
  id: string;
  title: string;
  slug: string;
  category: string;
  published_at: string;
  status: string;
};

const DEFAULT_SETTINGS: BotSettings = {
  enabled: false,
  run_times: ["09:00", "15:00", "21:00"],
  categories: ["AI"],
  post_instagram: true,
  post_facebook: true,
  instagram_format: "image_text",
  auto_publish_social: false,
  last_run: null,
  processed_count: 0,
};

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#ffffff",
};

/* ─── Toggle component ───────────────────────────────────────────── */
function Toggle({ enabled, onChange, size = "md" }: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "lg"
    ? { track: "w-14 h-7", thumb: "w-6 h-6", on: "calc(100% - 26px)", off: "2px" }
    : size === "sm"
    ? { track: "w-8 h-4", thumb: "w-3 h-3", on: "calc(100% - 14px)", off: "2px" }
    : { track: "w-11 h-6", thumb: "w-5 h-5", on: "calc(100% - 22px)", off: "2px" };

  return (
    <div
      className={`${dims.track} rounded-full relative cursor-pointer transition-all shrink-0`}
      style={{
        background: enabled ? "rgba(74,222,128,0.5)" : "rgba(255,255,255,0.1)",
        border: enabled ? "1px solid rgba(74,222,128,0.6)" : "1px solid rgba(255,255,255,0.15)",
        boxShadow: enabled ? "0 0 12px rgba(74,222,128,0.2)" : "none",
      }}
      onClick={() => onChange(!enabled)}
    >
      <div
        className={`${dims.thumb} absolute top-0.5 rounded-full transition-all`}
        style={{
          background: enabled ? "#4ade80" : "rgba(255,255,255,0.5)",
          left: enabled ? dims.on : dims.off,
          boxShadow: enabled ? "0 0 8px rgba(74,222,128,0.5)" : "none",
        }}
      />
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */
export default function AutopilotPage() {
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const categories = ["AI", "Tech", "Návody & Tipy"];

  const instagramFormats: { id: BotSettings["instagram_format"]; label: string; desc: string; icon: React.ElementType }[] = [
    { id: "image_text", label: "Generovaný obrázok", desc: "AI vytvorí obrázok s textom", icon: ImageIcon },
    { id: "article_bg", label: "Obrázok článku", desc: "Obrázok z článku + text overlay", icon: Layers },
    { id: "text_only", label: "Iba text", desc: "Klasický textový príspevok", icon: Type },
  ];

  useEffect(() => { fetchAll(); }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = async () => {
    const [botRes, histRes] = await Promise.all([
      supabase.from("site_settings").select("value").eq("key", "ai_content_bot").single(),
      supabase.from("articles").select("id,title,slug,category,published_at,status").order("published_at", { ascending: false }).limit(8),
    ]);

    if (botRes.data?.value) {
      try {
        const val = typeof botRes.data.value === "string" ? JSON.parse(botRes.data.value) : botRes.data.value;
        setSettings({ ...DEFAULT_SETTINGS, ...val });
      } catch { /* silent */ }
    }
    if (histRes.data) setHistory(histRes.data as HistoryItem[]);
  };

  const saveSettings = async (newSettings: BotSettings) => {
    setSaving(true);
    try {
      await supabase.from("site_settings").upsert({
        key: "ai_content_bot",
        value: JSON.stringify(newSettings),
      });
      // Also update legacy auto_pilot key for compatibility
      await supabase.from("site_settings").upsert({
        key: "auto_pilot",
        value: JSON.stringify({ enabled: newSettings.enabled, last_run: newSettings.last_run, processed_count: newSettings.processed_count }),
      });
      showToast("Nastavenia uložené ✓");
    } catch {
      showToast("Chyba pri ukladaní", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (patch: Partial<BotSettings>) => {
    const newSettings = { ...settings, ...patch };
    setSettings(newSettings);
  };

  const saveAndClose = () => saveSettings(settings);

  const toggleBot = async (enabled: boolean) => {
    const newSettings = { ...settings, enabled };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const runNow = async () => {
    setRunning(true);
    try {
      // 1. Find a topic
      const category = settings.categories[0] || "AI";
      const discoverRes = await fetch(
        `/api/admin/discover-news?categories=${category}&days=3&count=1&secret=make-com-webhook-secret`
      );
      if (!discoverRes.ok) throw new Error("Discovery failed");
      const discovered = await discoverRes.json();

      if (!discovered.items?.length) {
        showToast("Žiadne nové témy nenájdené", "error");
        return;
      }

      // 2. Generate + publish article
      const genRes = await fetch(`/api/admin/generate-article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: discovered.items[0].url,
          status: "published",
          secret: "make-com-webhook-secret",
        }),
      });
      if (!genRes.ok) throw new Error("Article generation failed");
      const article = await genRes.json();

      // 3. Generate social posts if enabled
      if (settings.post_instagram || settings.post_facebook) {
        const platforms = [
          ...(settings.post_instagram ? ["Instagram"] : []),
          ...(settings.post_facebook ? ["Facebook"] : []),
        ];
        for (const platform of platforms) {
          await fetch("/api/admin/generate-social-post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: article.title,
              excerpt: article.excerpt,
              url: `https://aiwai.news/clanky/${article.slug}`,
              platform,
              ...(platform === "Instagram" && {
                instagramFormat: settings.instagram_format,
                articleImage: article.main_image,
              }),
            }),
          });
        }
      }

      // Update stats
      const newSettings = {
        ...settings,
        last_run: new Date().toISOString(),
        processed_count: settings.processed_count + 1,
      };
      setSettings(newSettings);
      await saveSettings(newSettings);
      await fetchAll();

      showToast(`✓ Článok publikovaný: ${article.title?.substring(0, 40)}...`);
    } catch (e: any) {
      showToast(e.message || "Chyba pri spúšťaní bota", "error");
    } finally {
      setRunning(false);
    }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "Nikdy";
    return new Date(d).toLocaleDateString("sk-SK", {
      day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold"
          style={
            toast.type === "success"
              ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }
              : { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }
          }
        >
          {toast.msg}
        </div>
      )}

      <div className="p-5 md:p-7 space-y-5 pb-24">
        {/* Header */}
        <div>
          <h1
            className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-1"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.6) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AI Content Bot
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            Jeden bot — automaticky nájde tému, vytvorí článok, zverejní ho a postne na sociálne siete
          </p>
        </div>

        {/* ── Main Toggle Hero ── */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={
            settings.enabled
              ? {
                  background: "linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(74,222,128,0.03) 50%, rgba(0,0,0,0) 100%)",
                  border: "1px solid rgba(74,222,128,0.25)",
                  boxShadow: "0 0 60px rgba(74,222,128,0.06)",
                }
              : {
                  background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }
          }
        >
          {settings.enabled && (
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(to right, transparent, rgba(74,222,128,0.4), transparent)" }}
            />
          )}

          <div className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={
                    settings.enabled
                      ? { background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.35)", boxShadow: "0 0 30px rgba(74,222,128,0.2)" }
                      : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }
                  }
                >
                  <Zap
                    className="w-7 h-7"
                    style={{ color: settings.enabled ? "#4ade80" : "rgba(255,255,255,0.3)" }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <h2 className="text-lg font-black text-white">AI Content Bot</h2>
                    <span
                      className="text-[10px] font-black px-2.5 py-1 rounded-full"
                      style={
                        settings.enabled
                          ? { background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }
                          : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }
                      }
                    >
                      {settings.enabled ? "● AKTÍVNY" : "○ VYPNUTÝ"}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {settings.enabled
                      ? `Beží automaticky · ${settings.run_times.join(", ")}`
                      : "Zapni bota aby fungoval automaticky"}
                  </p>
                </div>
              </div>
              <Toggle enabled={settings.enabled} onChange={toggleBot} size="lg" />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "Posledný run", value: fmtDate(settings.last_run) },
                { label: "Spracované", value: `${settings.processed_count} článkov` },
                { label: "Naplánovaný", value: settings.run_times[0] ? `Dnes o ${settings.run_times[0]}` : "Nenastavený" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</p>
                  <p className="text-xs font-bold text-white">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Run Now button */}
            <button
              onClick={runNow}
              disabled={running}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-black transition-all disabled:opacity-40"
              style={
                settings.enabled
                  ? {
                      background: "linear-gradient(135deg, rgba(74,222,128,0.25) 0%, rgba(74,222,128,0.1) 100%)",
                      border: "1px solid rgba(74,222,128,0.4)",
                      color: "#4ade80",
                      boxShadow: "0 0 30px rgba(74,222,128,0.1)",
                    }
                  : {
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)",
                    }
              }
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Bot beží... Prosím čakaj
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Spustiť teraz manuálne
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Settings Card ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.2)" }}>
              <Settings2 className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <h2 className="text-sm font-black text-white uppercase tracking-wide flex-1">Nastavenia Bota</h2>
          </div>

          <div className="p-5 space-y-6">
            {/* Schedule */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-blue-400" />
                <label className="text-sm font-bold text-white">Automatické spúšťanie</label>
              </div>
              <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                Bot sa automaticky spustí v tieto časy každý deň a vygeneruje nový článok.
              </p>
              <div className="flex flex-wrap gap-2">
                {settings.run_times.map((time, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => {
                        const t = [...settings.run_times];
                        t[idx] = e.target.value;
                        updateSettings({ run_times: t });
                      }}
                      className="rounded-lg px-3 py-2 text-sm text-white outline-none font-mono"
                      style={inputStyle}
                    />
                    {settings.run_times.length > 1 && (
                      <button
                        onClick={() => updateSettings({ run_times: settings.run_times.filter((_, i) => i !== idx) })}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-xs"
                        style={{ color: "rgba(239,68,68,0.7)", background: "rgba(239,68,68,0.08)" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => updateSettings({ run_times: [...settings.run_times, "12:00"] })}
                  className="px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  + Pridať čas
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

            {/* Content categories */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-purple-400" />
                <label className="text-sm font-bold text-white">Kategória článkov</label>
              </div>
              <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                Bot bude hľadať a generovať obsah z týchto kategórií.
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const active = settings.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        if (active && settings.categories.length === 1) return;
                        updateSettings({
                          categories: active
                            ? settings.categories.filter((c) => c !== cat)
                            : [...settings.categories, cat],
                        });
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                      style={
                        active
                          ? { background: "rgba(192,132,252,0.15)", color: "#c084fc", border: "1px solid rgba(192,132,252,0.3)" }
                          : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }
                      }
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

            {/* Social posting */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-pink-400" />
                <label className="text-sm font-bold text-white">Sociálne siete</label>
              </div>
              <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
                Po publikovaní článku bot automaticky vytvorí príspevky na vybraných platformách.
              </p>

              {/* Platform toggles */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-2.5">
                    <Instagram className="w-4 h-4 text-pink-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">Instagram</p>
                      <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Post s obrázkom alebo textom</p>
                    </div>
                  </div>
                  <Toggle enabled={settings.post_instagram} onChange={(v) => updateSettings({ post_instagram: v })} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-2.5">
                    <Facebook className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">Facebook</p>
                      <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Klasický textový príspevok s odkazom</p>
                    </div>
                  </div>
                  <Toggle enabled={settings.post_facebook} onChange={(v) => updateSettings({ post_facebook: v })} />
                </div>
              </div>

              {/* Instagram format — shown only when Instagram is enabled */}
              {settings.post_instagram && (
                <div className="mt-1">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Instagram formát príspevku
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {instagramFormats.map((fmt) => {
                      const Icon = fmt.icon;
                      const active = settings.instagram_format === fmt.id;
                      return (
                        <button
                          key={fmt.id}
                          onClick={() => updateSettings({ instagram_format: fmt.id })}
                          className="flex flex-col items-center gap-2.5 p-4 rounded-xl text-center transition-all"
                          style={
                            active
                              ? { background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.35)" }
                              : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }
                          }
                        >
                          <Icon
                            className="w-5 h-5"
                            style={{ color: active ? "#f472b6" : "rgba(255,255,255,0.3)" }}
                          />
                          <span
                            className="text-[10px] font-bold leading-tight"
                            style={{ color: active ? "#f472b6" : "rgba(255,255,255,0.4)" }}
                          >
                            {fmt.label}
                          </span>
                          <span
                            className="text-[9px] leading-tight"
                            style={{ color: "rgba(255,255,255,0.2)" }}
                          >
                            {fmt.desc}
                          </span>
                          {active && (
                            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#f472b6" }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Auto-publish social posts */}
              {(settings.post_instagram || settings.post_facebook) && (
                <div className="flex items-center justify-between mt-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <p className="text-sm font-semibold text-white">Auto-publikovať social posty</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {settings.auto_publish_social
                        ? "Posty sa pošlú okamžite po vytvorení"
                        : "Posty pôjdu do draftu — môžeš ich skontrolovať"}
                    </p>
                  </div>
                  <Toggle enabled={settings.auto_publish_social} onChange={(v) => updateSettings({ auto_publish_social: v })} />
                </div>
              )}
            </div>
          </div>

          {/* Save button */}
          <div className="px-5 pb-5">
            <button
              onClick={saveAndClose}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, rgba(96,165,250,0.2) 0%, rgba(96,165,250,0.08) 100%)",
                border: "1px solid rgba(96,165,250,0.35)",
                color: "#60a5fa",
              }}
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
              {saving ? "Ukladám..." : "Uložiť nastavenia"}
            </button>
          </div>
        </div>

        {/* ── History ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center gap-3 px-5 py-4"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Clock className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.35)" }} />
            </div>
            <span className="text-sm font-black text-white uppercase tracking-wide flex-1 text-left">
              História Článkov
            </span>
            <span className="text-xs mr-1" style={{ color: "rgba(255,255,255,0.25)" }}>
              {history.length} posledných
            </span>
            {showHistory ? <ChevronUp className="w-4 h-4 text-white/25" /> : <ChevronDown className="w-4 h-4 text-white/25" />}
          </button>

          {showHistory && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {history.length === 0 ? (
                <p className="p-6 text-center text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>Žiadne články ešte</p>
              ) : (
                history.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3.5"
                    style={{ borderBottom: idx < history.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: item.status === "published" ? "#4ade80" : "#facc15" }}
                    />
                    <p className="flex-1 text-sm text-white truncate">{item.title}</p>
                    <span className="text-[10px] shrink-0 px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>
                      {item.category}
                    </span>
                    <span className="text-[10px] shrink-0" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {new Date(item.published_at).toLocaleDateString("sk-SK", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
