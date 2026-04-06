"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Plus, X, Zap, FileText, Layers, Play, Edit2, Trash2,
  Clock, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type BotType = "article_only" | "full";
type InstagramFormat = "image_text" | "text_only" | "article_bg";

interface Bot {
  id: string;
  name: string;
  type: BotType;
  enabled: boolean;
  run_times: string[];
  categories: string[];
  post_instagram?: boolean;
  post_facebook?: boolean;
  instagram_format?: InstagramFormat;
  auto_publish_social?: boolean;
  last_run?: string | null;
  processed_count?: number;
}

type RunStep = { label: string; status: "pending" | "running" | "done" | "error" };

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ["AI", "Tech", "Návody & Tipy"];
const TIME_OPTIONS = ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];
const INSTAGRAM_FORMATS: { id: InstagramFormat; label: string; desc: string }[] = [
  { id: "image_text", label: "Obrázok + Text", desc: "AI generovaný obrázok" },
  { id: "text_only", label: "Iba Text", desc: "Klasický textový post" },
  { id: "article_bg", label: "Foto článku", desc: "Obrázok z článku ako pozadie" },
];

const BOT_COLORS: Record<BotType, { primary: string; dim: string; border: string }> = {
  article_only: { primary: "#f59e0b", dim: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
  full: { primary: "#8b5cf6", dim: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.2)" },
};

function makeId() { return `bot_${Date.now()}`; }

function defaultBot(type: BotType): Bot {
  return {
    id: makeId(),
    name: type === "article_only" ? "Článkový Bot" : "Sociálny Bot",
    type,
    enabled: false,
    run_times: ["09:00"],
    categories: ["AI"],
    post_instagram: true,
    post_facebook: false,
    instagram_format: "image_text",
    auto_publish_social: true,
    last_run: null,
    processed_count: 0,
  };
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "Nikdy";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Práve teraz";
  if (mins < 60) return `pred ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `pred ${hrs}h`;
  return `pred ${Math.floor(hrs / 24)}d`;
}

// ─── Mini Toggle ──────────────────────────────────────────────────────────────
function Toggle({ value, onChange, color = "#22c55e" }: { value: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? color : "rgba(255,255,255,0.1)",
        border: `1px solid ${value ? color + "60" : "rgba(255,255,255,0.08)"}`,
        position: "relative", cursor: "pointer", transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3,
        left: value ? 22 : 3,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      }} />
    </button>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "success" | "error" | "info" }) {
  const c = { success: "#22c55e", error: "#ef4444", info: "#3b82f6" }[type];
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      display: "flex", alignItems: "center", gap: 10,
      background: `${c}18`, border: `1px solid ${c}40`,
      backdropFilter: "blur(12px)", borderRadius: 12,
      padding: "12px 18px", color: "#fff", fontSize: 13, fontWeight: 500,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
      {msg}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<Bot | null>(null);
  const [runningBotId, setRunningBotId] = useState<string | null>(null);
  const [runSteps, setRunSteps] = useState<RunStep[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load bots from Supabase ──
  const loadBots = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "bots")
        .single();

      if (data?.value) {
        const parsed: Bot[] = JSON.parse(data.value);
        setBots(parsed);
      } else {
        // migrate from legacy ai_content_bot if exists
        const { data: legacy } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", "ai_content_bot")
          .single();
        if (legacy?.value) {
          const old = JSON.parse(legacy.value);
          const migrated: Bot = {
            id: makeId(),
            name: "AI Content Bot",
            type: "full",
            enabled: old.enabled ?? false,
            run_times: old.run_times ?? ["09:00"],
            categories: old.categories ?? ["AI"],
            post_instagram: old.post_instagram ?? true,
            post_facebook: old.post_facebook ?? false,
            instagram_format: old.instagram_format ?? "image_text",
            auto_publish_social: old.auto_publish_social ?? true,
            last_run: old.last_run ?? null,
            processed_count: old.processed_count ?? 0,
          };
          setBots([migrated]);
          await saveBots([migrated]);
        } else {
          setBots([]);
        }
      }
    } catch {
      setBots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBots(); }, [loadBots]);

  // ── Save bots to Supabase ──
  const saveBots = async (updated: Bot[]) => {
    await supabase.from("site_settings").upsert({
      key: "bots",
      value: JSON.stringify(updated),
    });
    // also write legacy auto_pilot key from first enabled full bot
    const fullBot = updated.find((b) => b.type === "full" && b.enabled) ?? updated.find((b) => b.type === "full");
    if (fullBot) {
      await supabase.from("site_settings").upsert({
        key: "auto_pilot",
        value: JSON.stringify({ enabled: fullBot.enabled, run_times: fullBot.run_times, categories: fullBot.categories }),
      });
      await supabase.from("site_settings").upsert({
        key: "ai_content_bot",
        value: JSON.stringify(fullBot),
      });
    }
  };

  // ── Toggle bot enabled ──
  const toggleBot = async (id: string) => {
    const updated = bots.map((b) => b.id === id ? { ...b, enabled: !b.enabled } : b);
    setBots(updated);
    await saveBots(updated);
    const bot = updated.find((b) => b.id === id);
    showToast(bot?.enabled ? "Bot aktivovaný" : "Bot deaktivovaný", "info");
  };

  // ── Delete bot ──
  const deleteBot = async (id: string) => {
    const updated = bots.filter((b) => b.id !== id);
    setBots(updated);
    await saveBots(updated);
    setDeleteConfirmId(null);
    showToast("Bot vymazaný", "success");
  };

  // ── Save bot (create or edit) ──
  const saveBot = async (bot: Bot) => {
    let updated: Bot[];
    if (bots.find((b) => b.id === bot.id)) {
      updated = bots.map((b) => b.id === bot.id ? bot : b);
    } else {
      updated = [...bots, bot];
    }
    setBots(updated);
    await saveBots(updated);
    setModalOpen(false);
    setEditingBot(null);
    showToast("Bot uložený", "success");
  };

  // ── Run bot now ──
  const runBot = async (bot: Bot) => {
    setRunningBotId(bot.id);
    const steps: RunStep[] = [
      { label: "Hľadám tému...", status: "pending" },
      { label: "Generujem článok...", status: "pending" },
      { label: "Publikujem na stránku...", status: "pending" },
      ...(bot.type === "full"
        ? [{ label: "Zverejňujem na soc. siete...", status: "pending" as const }]
        : []),
    ];
    setRunSteps(steps);

    const setStep = (i: number, status: RunStep["status"]) => {
      setRunSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, status } : s));
    };

    try {
      // Step 0: discover topic
      setStep(0, "running");
      const topicsRes = await fetch(
        `/api/admin/gemini-topics?count=1&categories=${bot.categories.join(",")}&secret=make-com-webhook-secret`
      );
      if (!topicsRes.ok) throw new Error("Chyba pri hľadaní tém");
      const topicsData = await topicsRes.json();
      const topic = (topicsData.topics || topicsData.suggestions || topicsData.items || topicsData.suggested || [])[0];
      if (!topic) throw new Error("Žiadne témy nenájdené");
      setStep(0, "done");

      // Step 1: generate article
      setStep(1, "running");
      // generate-article expects a URL to fetch & process
      const topicUrl = typeof topic === "string"
        ? `https://www.google.com/search?q=${encodeURIComponent(topic)}`
        : (topic.url && topic.url.startsWith("http") ? topic.url : `https://www.google.com/search?q=${encodeURIComponent(topic.title || topic.topic || "AI news")}`);
      const articleRes = await fetch("/api/admin/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: "make-com-webhook-secret",
          url: topicUrl,
          status: "draft",
          model: "gemini",
        }),
      });
      if (!articleRes.ok) {
        const errData = await articleRes.json().catch(() => ({}));
        throw new Error(errData.message || "Chyba pri generovaní článku");
      }
      const articleData = await articleRes.json();
      const articleId = articleData.article?.id || articleData.id;
      setStep(1, "done");

      // Step 2: publish article
      setStep(2, "running");
      if (articleId) {
        await supabase.from("articles").update({ status: "published" }).eq("id", articleId);
      }
      setStep(2, "done");

      // Step 3 (full only): social posts
      if (bot.type === "full") {
        setStep(3, "running");
        const platforms: string[] = [];
        if (bot.post_instagram) platforms.push("instagram");
        if (bot.post_facebook) platforms.push("facebook");
        if (platforms.length > 0 && articleData.article) {
          await fetch("/api/admin/generate-social-post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: "make-com-webhook-secret",
              articleId: articleId,
              platforms,
              instagramFormat: bot.instagram_format || "image_text",
              autoPublish: bot.auto_publish_social,
            }),
          });
        }
        setStep(3, "done");
      }

      // Update last_run and processed_count
      const updated = bots.map((b) =>
        b.id === bot.id
          ? { ...b, last_run: new Date().toISOString(), processed_count: (b.processed_count || 0) + 1 }
          : b
      );
      setBots(updated);
      await saveBots(updated);
      showToast("Bot úspešne dokončil beh", "success");
    } catch (err) {
      const failIdx = runSteps.findIndex((s) => s.status === "running");
      if (failIdx >= 0) setStep(failIdx, "error");
      showToast(err instanceof Error ? err.message : "Chyba pri spúšťaní bota", "error");
    } finally {
      setTimeout(() => {
        setRunningBotId(null);
        setRunSteps([]);
      }, 3000);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 36, height: 36, border: "2px solid rgba(245,158,11,0.2)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 32px 64px" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 48 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginBottom: 12 }}>
              Automatizácia
            </p>
            <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 8 }}>AI Boty</h1>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
              Každý bot beží nezávisle podľa vlastného plánu a nastavení
            </p>
          </div>
          <button
            onClick={() => { setEditingBot(null); setModalOpen(true); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "11px 20px", borderRadius: 10,
              background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
              color: "#f59e0b", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            <Plus size={15} />
            Nový Bot
          </button>
        </div>

        {/* ── BOTS GRID ── */}
        {bots.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "80px 0",
            border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 16,
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Zap size={24} style={{ color: "#f59e0b" }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Žiadne boty</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 24 }}>Vytvor prvého bota pre automatizáciu obsahu</p>
            <button
              onClick={() => { setEditingBot(null); setModalOpen(true); }}
              style={{ padding: "10px 24px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, color: "#f59e0b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Vytvoriť prvého bota
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 20 }}>
            {bots.map((bot) => {
              const C = BOT_COLORS[bot.type];
              const isRunning = runningBotId === bot.id;
              return (
                <div
                  key={bot.id}
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: `1px solid ${bot.enabled ? C.border : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 16,
                    overflow: "hidden",
                    position: "relative",
                    animation: "fadeIn 0.3s ease",
                    transition: "border-color 0.3s",
                  }}
                >
                  {/* Top stripe */}
                  <div style={{ height: 3, background: bot.enabled ? C.primary : "rgba(255,255,255,0.08)" }} />

                  <div style={{ padding: 24 }}>
                    {/* Bot header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          {/* Type icon */}
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: C.dim, border: `1px solid ${C.border}`,
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            {bot.type === "article_only"
                              ? <FileText size={15} style={{ color: C.primary }} />
                              : <Layers size={15} style={{ color: C.primary }} />
                            }
                          </div>
                          <div>
                            <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{bot.name}</p>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: C.primary, textTransform: "uppercase", marginTop: 2 }}>
                              {bot.type === "article_only" ? "Iba Obsah" : "Obsah + Sociálne"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ON/OFF toggle */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <Toggle value={bot.enabled} onChange={() => toggleBot(bot.id)} color={C.primary} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: bot.enabled ? C.primary : "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>
                          {bot.enabled ? "AKTÍVNY" : "VYPNUTÝ"}
                        </span>
                      </div>
                    </div>

                    {/* Schedule & Categories */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "6px 10px" }}>
                        <Clock size={11} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
                          {bot.run_times.join(" · ")}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {bot.categories.map((cat) => (
                          <span key={cat} style={{
                            padding: "4px 8px", background: C.dim, border: `1px solid ${C.border}`,
                            borderRadius: 6, fontSize: 10, fontWeight: 700, color: C.primary,
                            letterSpacing: "0.06em",
                          }}>
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Social info (full only) */}
                    {bot.type === "full" && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {bot.post_instagram && (
                          <span style={{ padding: "4px 10px", background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.2)", borderRadius: 6, fontSize: 10, fontWeight: 700, color: "#ec4899" }}>
                            Instagram
                          </span>
                        )}
                        {bot.post_facebook && (
                          <span style={{ padding: "4px 10px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, fontSize: 10, fontWeight: 700, color: "#3b82f6" }}>
                            Facebook
                          </span>
                        )}
                        {!bot.post_instagram && !bot.post_facebook && (
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Žiadne soc. siete vybrané</span>
                        )}
                      </div>
                    )}

                    {/* Stats row */}
                    <div style={{ display: "flex", gap: 20, padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                          {bot.processed_count ?? 0}
                        </p>
                        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginTop: 2 }}>
                          Spracovaných
                        </p>
                      </div>
                      <div style={{ width: 1, background: "rgba(255,255,255,0.05)" }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
                          {timeAgo(bot.last_run)}
                        </p>
                        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginTop: 2 }}>
                          Posledný beh
                        </p>
                      </div>
                      {bot.enabled && (
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary, animation: "pulse 2s infinite" }} />
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: C.primary }}>BEží</span>
                        </div>
                      )}
                    </div>

                    {/* Run steps (when running) */}
                    {isRunning && runSteps.length > 0 && (
                      <div style={{ marginBottom: 16, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                        {runSteps.map((step, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                            {step.status === "done" && <CheckCircle size={12} style={{ color: "#22c55e", flexShrink: 0 }} />}
                            {step.status === "running" && <div style={{ width: 12, height: 12, border: `2px solid ${C.border}`, borderTopColor: C.primary, borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />}
                            {step.status === "error" && <AlertCircle size={12} style={{ color: "#ef4444", flexShrink: 0 }} />}
                            {step.status === "pending" && <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.12)", flexShrink: 0 }} />}
                            <span style={{ fontSize: 11, color: step.status === "running" ? "#fff" : step.status === "done" ? "#22c55e" : step.status === "error" ? "#ef4444" : "rgba(255,255,255,0.3)" }}>
                              {step.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => runBot(bot)}
                        disabled={isRunning}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          padding: "9px 0", borderRadius: 9,
                          background: isRunning ? "rgba(255,255,255,0.03)" : C.dim,
                          border: `1px solid ${isRunning ? "rgba(255,255,255,0.06)" : C.border}`,
                          color: isRunning ? "rgba(255,255,255,0.3)" : C.primary,
                          fontSize: 12, fontWeight: 700, cursor: isRunning ? "not-allowed" : "pointer",
                        }}
                      >
                        {isRunning
                          ? <><div style={{ width: 11, height: 11, border: `2px solid ${C.border}`, borderTopColor: C.primary, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Beží...</>
                          : <><Play size={12} /> Spustiť</>
                        }
                      </button>
                      <button
                        onClick={() => { setEditingBot(bot); setModalOpen(true); }}
                        style={{ padding: "9px 14px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                      >
                        <Edit2 size={13} />
                      </button>
                      {deleteConfirmId === bot.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => deleteBot(bot.id)}
                            style={{ padding: "9px 10px", borderRadius: 9, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                          >
                            Zmazať
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            style={{ padding: "9px 10px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(bot.id)}
                          style={{ padding: "9px 12px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)", cursor: "pointer" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Bot card */}
            <button
              onClick={() => { setEditingBot(null); setModalOpen(true); }}
              style={{
                minHeight: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
                background: "rgba(255,255,255,0.01)", border: "1px dashed rgba(255,255,255,0.1)",
                borderRadius: 16, cursor: "pointer", color: "rgba(255,255,255,0.3)", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,158,11,0.3)"; (e.currentTarget as HTMLButtonElement).style.color = "#f59e0b"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"; }}
            >
              <Plus size={24} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Pridať nového bota</span>
            </button>
          </div>
        )}
      </div>

      {/* ── CREATE/EDIT MODAL ── */}
      {modalOpen && (
        <BotModal
          bot={editingBot}
          onSave={saveBot}
          onClose={() => { setModalOpen(false); setEditingBot(null); }}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ─── Bot Modal ────────────────────────────────────────────────────────────────
function BotModal({
  bot,
  onSave,
  onClose,
}: {
  bot: Bot | null;
  onSave: (bot: Bot) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"type" | "config">(bot ? "config" : "type");
  const [form, setForm] = useState<Bot>(bot ?? defaultBot("article_only"));

  const C = BOT_COLORS[form.type];

  const toggleTime = (t: string) => {
    setForm((f) => ({
      ...f,
      run_times: f.run_times.includes(t)
        ? f.run_times.filter((x) => x !== t)
        : [...f.run_times, t].sort(),
    }));
  };

  const toggleCategory = (cat: string) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((x) => x !== cat)
        : [...f.categories, cat],
    }));
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20,
        width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
      }}>
        {/* Modal header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700 }}>{bot ? "Upraviť bota" : "Nový Bot"}</p>
            {step === "type" && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Vyber typ bota</p>}
            {step === "config" && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Nastav plán a kategórie</p>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {/* STEP 1: Type selection */}
          {step === "type" && (
            <div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 16, fontWeight: 500 }}>
                Aký typ obsahu má bot vytvárať?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {([
                  {
                    type: "article_only" as BotType,
                    icon: FileText,
                    title: "Iba Obsah",
                    desc: "Bot nájde tému, vygeneruje a publikuje článok na stránku. Bez postov na sociálne siete.",
                    color: BOT_COLORS.article_only,
                  },
                  {
                    type: "full" as BotType,
                    icon: Layers,
                    title: "Obsah + Sociálne",
                    desc: "Bot nájde tému, vygeneruje článok a automaticky ho postne na Instagram a/alebo Facebook.",
                    color: BOT_COLORS.full,
                  },
                ] as { type: BotType; icon: React.ElementType; title: string; desc: string; color: typeof BOT_COLORS.article_only }[]).map((opt) => {
                  const Icon = opt.icon;
                  const selected = form.type === opt.type;
                  return (
                    <button
                      key={opt.type}
                      onClick={() => {
                        setForm((f) => ({ ...defaultBot(opt.type), id: f.id }));
                        setStep("config");
                      }}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 16,
                        padding: 20, borderRadius: 14, cursor: "pointer", textAlign: "left",
                        background: selected ? opt.color.dim : "rgba(255,255,255,0.02)",
                        border: `1px solid ${selected ? opt.color.border : "rgba(255,255,255,0.07)"}`,
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = opt.color.border;
                        (e.currentTarget as HTMLButtonElement).style.background = opt.color.dim;
                      }}
                      onMouseLeave={(e) => {
                        if (!selected) {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)";
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.02)";
                        }
                      }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: opt.color.dim, border: `1px solid ${opt.color.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={18} style={{ color: opt.color.primary }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: "#fff" }}>{opt.title}</p>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Config */}
          {step === "config" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Bot name */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                  Názov bota
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  style={inputStyle}
                  placeholder="napr. Ranný Bot"
                  onFocus={(e) => (e.target.style.borderColor = C.primary)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>

              {/* Type badge (readonly, change via back button) */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ padding: "6px 12px", background: C.dim, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {form.type === "article_only" ? "Iba Obsah" : "Obsah + Sociálne"}
                </div>
                {!bot && (
                  <button onClick={() => setStep("type")} style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>
                    Zmeniť typ
                  </button>
                )}
              </div>

              {/* Schedule */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>
                  Časy spustenia
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TIME_OPTIONS.map((t) => {
                    const active = form.run_times.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTime(t)}
                        style={{
                          padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          background: active ? C.dim : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? C.border : "rgba(255,255,255,0.07)"}`,
                          color: active ? C.primary : "rgba(255,255,255,0.35)",
                          transition: "all 0.12s",
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Categories */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>
                  Kategórie obsahu
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {CATEGORIES.map((cat) => {
                    const active = form.categories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        style={{
                          padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          background: active ? C.dim : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? C.border : "rgba(255,255,255,0.07)"}`,
                          color: active ? C.primary : "rgba(255,255,255,0.35)",
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Full bot social settings */}
              {form.type === "full" && (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", display: "block", marginBottom: 12 }}>
                      Sociálne siete
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>Instagram</p>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>Publikovanie príspevkov</p>
                        </div>
                        <Toggle value={form.post_instagram ?? false} onChange={(v) => setForm((f) => ({ ...f, post_instagram: v }))} color="#ec4899" />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>Facebook</p>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>Textový príspevok</p>
                        </div>
                        <Toggle value={form.post_facebook ?? false} onChange={(v) => setForm((f) => ({ ...f, post_facebook: v }))} color="#3b82f6" />
                      </div>
                    </div>
                  </div>

                  {form.post_instagram && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>
                        Instagram formát
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {INSTAGRAM_FORMATS.map((fmt) => {
                          const active = form.instagram_format === fmt.id;
                          return (
                            <button
                              key={fmt.id}
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, instagram_format: fmt.id }))}
                              style={{
                                flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                                background: active ? "rgba(236,72,153,0.1)" : "rgba(255,255,255,0.03)",
                                border: `1px solid ${active ? "rgba(236,72,153,0.3)" : "rgba(255,255,255,0.07)"}`,
                                color: active ? "#ec4899" : "rgba(255,255,255,0.35)",
                              }}
                            >
                              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{fmt.label}</p>
                              <p style={{ fontSize: 10, opacity: 0.7 }}>{fmt.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>Auto-publikovanie soc. sietí</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>Okamžité zverejnenie bez kontroly</p>
                    </div>
                    <Toggle value={form.auto_publish_social ?? true} onChange={(v) => setForm((f) => ({ ...f, auto_publish_social: v }))} color="#22c55e" />
                  </div>
                </>
              )}

              {/* Save */}
              <div style={{ display: "flex", gap: 10, paddingTop: 8 }}>
                <button
                  onClick={() => onSave(form)}
                  disabled={!form.name || form.categories.length === 0 || form.run_times.length === 0}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 10,
                    background: C.dim, border: `1px solid ${C.border}`,
                    color: C.primary, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    opacity: (!form.name || form.categories.length === 0 || form.run_times.length === 0) ? 0.4 : 1,
                  }}
                >
                  {bot ? "Uložiť zmeny" : "Vytvoriť bota"}
                </button>
                <button
                  onClick={onClose}
                  style={{ padding: "12px 20px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                >
                  Zrušiť
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
