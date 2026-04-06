/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send,
  Zap,
  Globe,
  FileText,
  Link2,
  Sparkles,
  Bot,
  ExternalLink,
  X,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Portal } from "@/components/Portal";

type SuggestedNews = {
  id: string;
  url: string;
  title: string;
  summary: string;
  source: string;
  category?: string;
  status: "pending" | "processed" | "ignored";
  created_at: string;
};

type GeneratedArticle = {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  published_at: string;
};

/* ─── Shared input style ─────────────────────────────────────────── */
const inputCls = "w-full rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 transition-all";
const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

/* ─── Section card wrapper ─────────────────────────────────────── */
function Section({ icon: Icon, title, color, children }: {
  icon: React.ElementType;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      {/* Inner top glow */}
      <div
        className="absolute h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)" }}
      />
      {/* Section header */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <h2 className="text-sm font-black text-white uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

/* ─── Loading overlay ────────────────────────────────────────────── */
function LoadingOverlay({ stage }: { stage: string }) {
  return (
    <div
      className="fixed inset-x-0 top-0 z-[200] flex justify-center pt-5"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="rounded-2xl px-6 py-4 flex items-center gap-4"
        style={{
          background: "linear-gradient(145deg, #141414 0%, #0f0f0f 100%)",
          border: "1px solid rgba(96,165,250,0.3)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.8), 0 0 24px rgba(96,165,250,0.12)",
          minWidth: 300, maxWidth: 440,
          animation: "slideDown 0.3s ease",
        }}
      >
        <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-16px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div className="relative w-9 h-9 shrink-0">
          <div className="absolute inset-0 rounded-full" style={{ border: "2px solid rgba(255,255,255,0.06)" }} />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 border-r-blue-500/30 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
        </div>
        <div>
          <p className="text-white font-bold text-sm mb-0.5">AI pracuje...</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{stage}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Confirm Modal ─────────────────────────────────────────────── */
function ConfirmModal({ item, onConfirm, onCancel, isLoading }: {
  item: SuggestedNews;
  onConfirm: (asDraft: boolean) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl p-6 max-w-md w-full"
        style={{
          background: "linear-gradient(145deg, #111111 0%, #0c0c0c 100%)",
          border: "1px solid rgba(96,165,250,0.25)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.8), 0 0 24px rgba(96,165,250,0.10)",
          animation: "slideDownModal 0.3s ease",
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@keyframes slideDownModal { from { opacity:0; transform:translateY(-16px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)" }}
          >
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Generovať článok?</h3>
            <p className="text-xs mt-1 line-clamp-2" style={{ color: "rgba(255,255,255,0.45)" }}>
              {item.title}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => onConfirm(true)}
            disabled={isLoading}
            className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)" }}
          >
            <FileText className="w-5 h-5 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400">Uložiť do draftu</span>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Skontroluj pred publik.</span>
          </button>
          <button
            onClick={() => onConfirm(false)}
            disabled={isLoading}
            className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}
          >
            <Globe className="w-5 h-5 text-green-400" />
            <span className="text-xs font-bold text-green-400">Priamo publikovať</span>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Na web okamžite</span>
          </button>
        </div>

        <button
          onClick={onCancel}
          disabled={isLoading}
          className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}
        >
          Zrušiť
        </button>
      </div>
    </div>
  );
}

/* ─── Toast ─────────────────────────────────────────────────────── */
function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div
      className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold animate-in fade-in slide-in-from-top-2"
      style={
        type === "success"
          ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }
          : { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }
      }
    >
      {msg}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function TvorbaPage() {
  const [useRssForGemini, setUseRssForGemini] = useState(false);
  const [geminiQuery, setGeminiQuery] = useState("");
  const [discoveryCount, setDiscoveryCount] = useState(8);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["AI"]);
  const [suggestedNews, setSuggestedNews] = useState<SuggestedNews[]>([]);

  const [quickGenUrl, setQuickGenUrl] = useState("");
  const [synthesisUrls, setSynthesisUrls] = useState<string[]>(["", ""]);
  const [botPrompt, setBotPrompt] = useState("");
  const [postSocial, setPostSocial] = useState(false);
  const [publishStatus, setPublishStatus] = useState<"draft" | "published">("draft");

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [confirmModal, setConfirmModal] = useState<SuggestedNews | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [lastCreated, setLastCreated] = useState<GeneratedArticle | null>(null);

  const categories = ["AI", "Tech", "Návody & Tipy"];

  useEffect(() => { fetchSuggestedNews(); }, []);

  const fetchSuggestedNews = async () => {
    const { data } = await supabase
      .from("suggested_news")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setSuggestedNews(data as SuggestedNews[]);
  };

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* Discovery */
  const handleDiscoverNews = async () => {
    setLoading(true);
    setLoadingStage("Hľadám správy cez Gemini...");
    try {
      const params = new URLSearchParams({
        days: "3",
        count: discoveryCount.toString(),
        categories: selectedCategories.join(","),
        useRss: useRssForGemini.toString(),
        secret: "make-com-webhook-secret",
      });
      if (geminiQuery) params.append("query", geminiQuery);
      const response = await fetch(`/api/admin/discover-news?${params}`);
      if (!response.ok) throw new Error("Discovery failed");
      const data = await response.json();
      await fetchSuggestedNews();
      showToast(`Nájdených ${data.items?.length || 0} správ ✓`);
    } catch (e: any) {
      showToast(e.message || "Hľadanie zlyhalo", "error");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  const handleIgnore = async (id: string) => {
    await supabase.from("suggested_news").update({ status: "ignored" }).eq("id", id);
    setSuggestedNews(suggestedNews.filter((i) => i.id !== id));
  };

  const deleteAllTopics = async () => {
    if (!confirm(`Naozaj vymazať všetkých ${suggestedNews.length} nájdených tém?`)) return;
    await supabase.from("suggested_news").update({ status: "ignored" }).eq("status", "pending");
    setSuggestedNews([]);
    showToast("Všetky témy vymazané", "success");
  };

  const confirmProcess = async (asDraft: boolean) => {
    if (!confirmModal) return;
    const suggestion = confirmModal;
    setConfirmModal(null);
    setLoading(true);
    setLoadingStage("Generujem článok...");
    try {
      const res = await fetch(`/api/admin/generate-article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: suggestion.url,
          status: asDraft ? "draft" : "published",
          secret: "make-com-webhook-secret",
          fallbackTitle: suggestion.title || undefined,
          fallbackContent: suggestion.summary || undefined,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Chyba servera (${res.status})`);
      }
      const { article: data } = await res.json() as { article: GeneratedArticle };
      await supabase.from("suggested_news").update({ status: "processed" }).eq("id", suggestion.id);
      setSuggestedNews(suggestedNews.filter((i) => i.id !== suggestion.id));
      setLastCreated(data);
      showToast(asDraft ? `Draft vytvorený: ${data.title}` : `Publikované: ${data.title}`);
    } catch (e: any) {
      showToast(e.message || "Generovanie zlyhalo", "error");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  /* Quick Gen */
  const handleQuickGen = async () => {
    if (!quickGenUrl.trim()) { showToast("Zadajte URL", "error"); return; }
    setLoading(true);
    setLoadingStage("Generujem draft z URL...");
    try {
      const res = await fetch(`/api/admin/generate-article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: quickGenUrl, status: "draft", secret: "make-com-webhook-secret" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Chyba servera (${res.status})`);
      }
      const { article: data } = await res.json() as { article: GeneratedArticle };
      setQuickGenUrl("");
      setLastCreated(data);
      showToast(`Draft vytvorený ✓`);
    } catch (e: any) {
      showToast(e.message || "Generovanie zlyhalo", "error");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  /* Synthesis */
  const handleSynthesis = async () => {
    const validUrls = synthesisUrls.filter((u) => u.trim().startsWith("http"));
    if (validUrls.length < 2) { showToast("Zadajte aspoň 2 URL adresy", "error"); return; }
    setLoading(true);
    setLoadingStage("Syntetizujem z viacerých zdrojov...");
    try {
      const res = await fetch(`/api/admin/generate-article-multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: validUrls, secret: "make-com-webhook-secret" }),
      });
      if (!res.ok) throw new Error("Synthesis failed");
      const data = (await res.json()) as GeneratedArticle;
      setSynthesisUrls(["", ""]);
      setLastCreated(data);
      showToast(`Syntéza vytvorená ✓`);
    } catch (e: any) {
      showToast(e.message || "Syntéza zlyhala", "error");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  /* Manual Bot */
  const handleManualBot = async () => {
    if (!botPrompt.trim()) { showToast("Zadajte prompt", "error"); return; }
    setLoading(true);
    setLoadingStage("Spúšťam AI agenta...");
    try {
      const res = await fetch(`/api/admin/manual-custom-bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: botPrompt, postSocial, publishStatus, secret: "make-com-webhook-secret" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Chyba servera (${res.status})`);
      }
      const { article: data } = await res.json() as { article: GeneratedArticle };
      setBotPrompt("");
      setLastCreated(data);
      showToast(`Článok vytvorený ✓`);
    } catch (e: any) {
      showToast(e.message || "AI agent zlyhal", "error");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      <Portal>
        {loading && <LoadingOverlay stage={loadingStage} />}
        {confirmModal && (
          <ConfirmModal
            item={confirmModal}
            onConfirm={confirmProcess}
            onCancel={() => setConfirmModal(null)}
            isLoading={loading}
          />
        )}
        {toast && <Toast msg={toast.msg} type={toast.type} />}
      </Portal>

      <div className="p-5 md:p-7 space-y-5 pb-20">
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
            Tvorba Článkov
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            Objavovanie tém a generovanie obsahu
          </p>
        </div>

        {/* Last created banner */}
        {lastCreated && (
          <div
            className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)" }}
          >
            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-400 truncate">{lastCreated.title}</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Naposledy vytvorený článok</p>
            </div>
            <Link
              href="/admin/clanky"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0"
              style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}
            >
              Zobraziť <ArrowRight className="w-3 h-3" />
            </Link>
            <button onClick={() => setLastCreated(null)}>
              <X className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
            </button>
          </div>
        )}

        {/* ── Section 1: Gemini Discovery ── */}
        <Section icon={Search} title="Objavovanie tém" color="#60a5fa">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Source toggle */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                Zdroj
              </label>
              <div
                className="flex rounded-xl p-1"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                {["Gemini", "RSS"].map((src, i) => (
                  <button
                    key={src}
                    onClick={() => setUseRssForGemini(i === 1)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={
                      useRssForGemini === (i === 1)
                        ? { background: "rgba(96,165,250,0.2)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }
                        : { color: "rgba(255,255,255,0.35)" }
                    }
                  >
                    {src}
                  </button>
                ))}
              </div>
            </div>

            {/* Query */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                Voľný dotaz (nepovinné)
              </label>
              <input
                type="text"
                value={geminiQuery}
                onChange={(e) => setGeminiQuery(e.target.value)}
                placeholder="Napr. blockchain, kvantové počítače..."
                className={inputCls}
                style={inputStyle}
              />
            </div>

            {/* Count slider */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                Počet správ: <span className="text-white">{discoveryCount}</span>
              </label>
              <input
                type="range"
                min="1"
                max="15"
                value={discoveryCount}
                onChange={(e) => setDiscoveryCount(Number(e.target.value))}
                className="w-full h-1.5 rounded-full cursor-pointer"
                style={{ accentColor: "#60a5fa" }}
              />
              <div className="flex justify-between text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                <span>1</span><span>15</span>
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                Kategórie
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const active = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategories(
                        active
                          ? selectedCategories.filter((c) => c !== cat)
                          : [...selectedCategories, cat]
                      )}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={
                        active
                          ? { background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }
                          : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }
                      }
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={handleDiscoverNews}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, rgba(96,165,250,0.2) 0%, rgba(96,165,250,0.08) 100%)",
              border: "1px solid rgba(96,165,250,0.3)",
              color: "#60a5fa",
            }}
          >
            <Search className="w-4 h-4" />
            Hľadať cez Gemini
          </button>
        </Section>

        {/* ── Suggested News List ── */}
        {suggestedNews.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: "rgba(255,255,255,0.25)" }}>
                Nájdené témy
              </div>
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}
              >
                {suggestedNews.length}
              </span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
              <button
                onClick={deleteAllTopics}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
                title="Vymazať všetky témy"
              >
                <Trash2 className="w-3 h-3" />
                Vymazať všetky
              </button>
              <button
                onClick={fetchSuggestedNews}
                className="p-1.5 rounded-lg"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {suggestedNews.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-start gap-4"
                style={{
                  background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white line-clamp-2 mb-1">{item.title}</h3>
                  <p className="text-[11px] line-clamp-2 mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {item.summary}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.category && (
                      <span
                        className="text-[9px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(96,165,250,0.1)", color: "#93c5fd", border: "1px solid rgba(96,165,250,0.2)" }}
                      >
                        {item.category}
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{item.source}</span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px]"
                      style={{ color: "rgba(96,165,250,0.6)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-2.5 h-2.5" /> Zdroj
                    </a>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setConfirmModal(item)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-40"
                    style={{
                      background: "linear-gradient(135deg, rgba(74,222,128,0.15) 0%, rgba(74,222,128,0.06) 100%)",
                      border: "1px solid rgba(74,222,128,0.3)",
                      color: "#4ade80",
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Generovať
                  </button>
                  <button
                    onClick={() => handleIgnore(item.id)}
                    className="p-2 rounded-xl transition-all"
                    style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {suggestedNews.length === 0 && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)" }}
          >
            <Search className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.1)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
              Žiadne čakajúce témy · Spustite objavovanie vyššie
            </p>
          </div>
        )}

        {/* ── Section 2: Quick Gen ── */}
        <Section icon={Link2} title="Rýchly Draft z URL" color="#c084fc">
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
            Vložte odkaz na článok a AI vygeneruje draft na základe obsahu.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={quickGenUrl}
              onChange={(e) => setQuickGenUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuickGen()}
              placeholder="https://techcrunch.com/..."
              className={`${inputCls} flex-1`}
              style={inputStyle}
            />
            <button
              onClick={handleQuickGen}
              disabled={loading || !quickGenUrl.trim()}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-black transition-all disabled:opacity-40 shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(192,132,252,0.2) 0%, rgba(192,132,252,0.08) 100%)",
                border: "1px solid rgba(192,132,252,0.3)",
                color: "#c084fc",
              }}
            >
              <Plus className="w-4 h-4" /> Draft
            </button>
          </div>
        </Section>

        {/* ── Section 3: Synthesis ── */}
        <Section icon={Zap} title="Synthesis Studio" color="#fb923c">
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
            Skombinuj viacero zdrojov do jedného originálneho článku.
          </p>
          <div className="space-y-2 mb-4">
            {synthesisUrls.map((url, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    const n = [...synthesisUrls];
                    n[idx] = e.target.value;
                    setSynthesisUrls(n);
                  }}
                  placeholder={`URL zdroj ${idx + 1}...`}
                  className={`${inputCls} flex-1`}
                  style={inputStyle}
                />
                {synthesisUrls.length > 2 && (
                  <button
                    onClick={() => setSynthesisUrls(synthesisUrls.filter((_, i) => i !== idx))}
                    className="p-3 rounded-xl"
                    style={{ background: "rgba(239,68,68,0.08)", color: "#f87171" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSynthesisUrls([...synthesisUrls, ""])}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
            >
              + Pridať URL
            </button>
            <button
              onClick={handleSynthesis}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, rgba(251,146,60,0.15) 0%, rgba(251,146,60,0.06) 100%)",
                border: "1px solid rgba(251,146,60,0.3)",
                color: "#fb923c",
              }}
            >
              <Zap className="w-3.5 h-3.5" /> Spustiť Synthesis
            </button>
          </div>
        </Section>

        {/* ── Section 4: Manual AI Bot ── */}
        <Section icon={Bot} title="Manuálny AI Agent" color="#a78bfa">
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
            Popíšte tému alebo zadajte inštrukcie — AI vytvorí kompletný článok.
          </p>
          <textarea
            value={botPrompt}
            onChange={(e) => setBotPrompt(e.target.value)}
            placeholder="Napr: Napíš článok o najnovších trendoch v oblasti generatívnej AI v roku 2025, zameraj sa na podnikateľské využitie..."
            rows={4}
            className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 resize-none mb-4"
            style={inputStyle}
          />
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Status toggle */}
            <div
              className="flex rounded-xl p-1 gap-1"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {(["draft", "published"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPublishStatus(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={
                    publishStatus === s
                      ? s === "draft"
                        ? { background: "rgba(250,204,21,0.15)", color: "#facc15", border: "1px solid rgba(250,204,21,0.3)" }
                        : { background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }
                      : { color: "rgba(255,255,255,0.3)" }
                  }
                >
                  {s === "draft" ? "Draft" : "Publikovať"}
                </button>
              ))}
            </div>

            {/* Social toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                className={`w-8 h-4 rounded-full relative transition-all cursor-pointer ${postSocial ? "" : ""}`}
                style={{
                  background: postSocial ? "rgba(244,114,182,0.5)" : "rgba(255,255,255,0.1)",
                  border: postSocial ? "1px solid rgba(244,114,182,0.5)" : "1px solid rgba(255,255,255,0.15)",
                }}
                onClick={() => setPostSocial(!postSocial)}
              >
                <div
                  className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
                  style={{
                    background: postSocial ? "#f472b6" : "rgba(255,255,255,0.4)",
                    left: postSocial ? "calc(100% - 14px)" : "2px",
                  }}
                />
              </div>
              <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
                Aj social post
              </span>
            </label>
          </div>
          <button
            onClick={handleManualBot}
            disabled={loading || !botPrompt.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, rgba(167,139,250,0.2) 0%, rgba(167,139,250,0.08) 100%)",
              border: "1px solid rgba(167,139,250,0.3)",
              color: "#a78bfa",
            }}
          >
            <Send className="w-4 h-4" />
            Spustiť AI Agenta
          </button>
        </Section>
      </div>
    </div>
  );
}
