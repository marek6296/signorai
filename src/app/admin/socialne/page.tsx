"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Trash2,
  Send,
  Search,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Instagram,
  Facebook,
  Image as ImageIcon,
  Type,
  Layers,
  Zap,
  Settings,
  RefreshCw,
} from "lucide-react";

type SocialPost = {
  id: string;
  article_id: string;
  platform: "Instagram" | "Facebook";
  content: string;
  status: "draft" | "posted";
  image_url: string | null;
  created_at: string;
  posted_at: string | null;
  articles?: { title: string; slug: string; category: string; main_image?: string };
};

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  status: string;
  main_image: string;
};

type SocialBotSettings = {
  enabled: boolean;
  interval_hours: number;
  posting_times: string[];
  auto_publish: boolean;
  target_categories: string[];
};

type InstagramFormat = "image_text" | "text_only" | "article_bg";

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#ffffff",
};

function platformStyle(p: string) {
  if (p === "Instagram") return { bg: "rgba(236,72,153,0.12)", color: "#f9a8d4", border: "rgba(236,72,153,0.25)" };
  return { bg: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "rgba(59,130,246,0.25)" };
}

export default function SocialnePage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"draft" | "posted">("draft");

  // Generate section
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set(["Instagram", "Facebook"]));
  const [instagramFormat, setInstagramFormat] = useState<InstagramFormat>("image_text");
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Bot settings
  const [showSettings, setShowSettings] = useState(false);
  const [botSettings, setBotSettings] = useState<SocialBotSettings>({
    enabled: false,
    interval_hours: 4,
    posting_times: ["09:00", "14:00", "19:00"],
    auto_publish: false,
    target_categories: [],
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchPosts(), fetchArticles(), fetchBotSettings()]);
      setLoading(false);
    };
    load();
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPosts = async () => {
    const res = await fetch("/api/admin/social-posts");
    const data = await res.json();
    setPosts(data || []);
  };

  const fetchArticles = async () => {
    const { data } = await supabase
      .from("articles")
      .select("id, title, slug, excerpt, category, status, main_image")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    setArticles(data || []);
  };

  const fetchBotSettings = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "social_bot")
      .single();
    if (data?.value) setBotSettings(data.value);
  };

  const deletePost = async (id: string) => {
    if (!confirm("Zmazať príspevok?")) return;
    await fetch("/api/admin/social-posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchPosts();
    showToast("Príspevok zmazaný");
  };

  const deleteAllDrafts = async () => {
    const count = posts.filter((p) => p.status === "draft").length;
    if (!confirm(`Naozaj vymazať všetkých ${count} draftov? Táto akcia sa nedá vrátiť.`)) return;
    setLoading(true);
    await fetch("/api/admin/social-posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteAllDrafts: true }),
    });
    await fetchPosts();
    setLoading(false);
    showToast(`Vymazaných ${count} draftov`, "success");
  };

  const publishPost = async (id: string) => {
    const res = await fetch("/api/admin/publish-social-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, secret: "make-com-webhook-secret" }),
    });
    if (res.ok) {
      await fetchPosts();
      showToast("Príspevok publikovaný ✓");
    } else {
      showToast("Chyba pri publikovaní", "error");
    }
  };

  const generatePosts = async () => {
    if (selectedArticles.size === 0 || selectedPlatforms.size === 0) {
      showToast("Vyberte aspoň jeden článok a platformu", "error");
      return;
    }
    setGenerating(true);
    try {
      const articlesToProcess = articles.filter((a) => selectedArticles.has(a.id));
      for (const article of articlesToProcess) {
        for (const platform of Array.from(selectedPlatforms)) {
          await fetch("/api/admin/generate-social-post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: article.title,
              excerpt: article.excerpt,
              url: `https://aiwai.news/clanky/${article.slug}`,
              platform,
              // Instagram-specific format
              ...(platform === "Instagram" && {
                instagramFormat,
                articleImage: article.main_image,
              }),
            }),
          });
        }
      }
      await fetchPosts();
      setSelectedArticles(new Set());
      showToast(`${articlesToProcess.length * selectedPlatforms.size} príspevkov generovaných ✓`);
    } catch {
      showToast("Chyba pri generovaní", "error");
    } finally {
      setGenerating(false);
    }
  };

  const runAutopilot = async () => {
    if (!selectedPlatforms.size) { showToast("Vyberte platformy", "error"); return; }
    setGenerating(true);
    try {
      await fetch("/api/admin/social-autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: Array.from(selectedPlatforms) }),
      });
      await fetchPosts();
      showToast("Autopilot spustený ✓");
    } catch {
      showToast("Chyba pri autopilote", "error");
    } finally {
      setGenerating(false);
    }
  };

  const saveBotSettings = async () => {
    setSavingSettings(true);
    const { error } = await supabase.from("site_settings").upsert({ key: "social_bot", value: botSettings });
    setSavingSettings(false);
    if (error) showToast("Chyba pri ukladaní", "error");
    else showToast("Nastavenia uložené ✓");
  };

  const filteredArticles = articles.filter((a) =>
    a.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const draftPosts = posts.filter((p) => p.status === "draft");
  const postedPosts = posts.filter((p) => p.status === "posted");
  const displayPosts = activeTab === "draft" ? draftPosts : postedPosts;

  const instagramFormats: { id: InstagramFormat; label: string; desc: string; icon: React.ElementType }[] = [
    { id: "image_text", label: "Obrázok + Text", desc: "Generovaný obrázok s textom", icon: ImageIcon },
    { id: "text_only", label: "Iba Text", desc: "Klasický textový príspevok", icon: Type },
    { id: "article_bg", label: "Obrázok článku", desc: "Obrázok z článku ako pozadie", icon: Layers },
  ];

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

      <div className="p-5 md:p-7 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl md:text-3xl font-black uppercase tracking-tight"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.6) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Sociálne Siete
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              Správa a publikovanie príspevkov
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); Promise.all([fetchPosts(), fetchArticles()]).finally(() => setLoading(false)); }}
            className="p-2.5 rounded-xl transition-all"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Drafty", value: draftPosts.length, color: "#facc15", bg: "rgba(250,204,21,0.08)", border: "rgba(250,204,21,0.15)" },
            { label: "Publikované", value: postedPosts.length, color: "#4ade80", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.15)" },
            { label: "Instagram", value: posts.filter((p) => p.platform === "Instagram").length, color: "#f9a8d4", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.15)" },
            { label: "Facebook", value: posts.filter((p) => p.platform === "Facebook").length, color: "#93c5fd", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.15)" },
          ].map((s) => (
            <div
              key={s.label}
              className="relative rounded-2xl p-4 overflow-hidden"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}
            >
              <div className="text-2xl font-black" style={{ color: "#ffffff" }}>{s.value}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tab + Posts */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Tab header */}
          <div
            className="flex items-center gap-1 p-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            {(["draft", "posted"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                style={
                  activeTab === tab
                    ? { background: "rgba(255,255,255,0.1)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.12)" }
                    : { color: "rgba(255,255,255,0.35)" }
                }
              >
                {tab === "draft" ? `Drafty (${draftPosts.length})` : `Publikované (${postedPosts.length})`}
              </button>
            ))}
            {activeTab === "draft" && draftPosts.length > 0 && (
              <button
                onClick={deleteAllDrafts}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ml-1"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", whiteSpace: "nowrap" }}
                title="Vymazať všetky drafty"
              >
                <Trash2 className="w-3 h-3" />
                Vymazať všetky
              </button>
            )}
          </div>

          {/* Posts grid */}
          <div className="p-4">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
                ))}
              </div>
            ) : displayPosts.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-4xl mb-3">{activeTab === "draft" ? "✍️" : "📤"}</div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {activeTab === "draft" ? "Žiadne drafty · Generujte príspevky nižšie" : "Žiadne publikované príspevky"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayPosts.map((post) => {
                  const pl = platformStyle(post.platform);
                  return (
                    <div
                      key={post.id}
                      className="rounded-xl flex flex-col overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      {/* Platform badge */}
                      <div
                        className="flex items-center gap-2 px-4 py-3"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        {post.platform === "Instagram"
                          ? <Instagram className="w-3.5 h-3.5" style={{ color: pl.color }} />
                          : <Facebook className="w-3.5 h-3.5" style={{ color: pl.color }} />
                        }
                        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: pl.color }}>
                          {post.platform}
                        </span>
                        <span className="ml-auto text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                          {new Date(post.created_at).toLocaleDateString("sk-SK")}
                        </span>
                      </div>

                      {/* Image if present */}
                      {post.image_url && (
                        <img
                          src={post.image_url}
                          alt=""
                          className="w-full h-28 object-cover"
                        />
                      )}

                      {/* Content */}
                      <div className="px-4 py-3 flex-1">
                        {post.articles?.title && (
                          <p className="text-[10px] font-semibold mb-1 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                            {post.articles.title}
                          </p>
                        )}
                        <p className="text-xs line-clamp-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                          {post.content}
                        </p>
                      </div>

                      {/* Actions */}
                      <div
                        className="flex gap-2 px-4 py-3"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        {post.status === "draft" && (
                          <button
                            onClick={() => publishPost(post.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
                            style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}
                          >
                            <Send className="w-3 h-3" /> Publikovať
                          </button>
                        )}
                        <button
                          onClick={() => deletePost(post.id)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all"
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#f87171" }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Generate Posts Section */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(244,114,182,0.12)", border: "1px solid rgba(244,114,182,0.2)" }}
            >
              <Zap className="w-3.5 h-3.5 text-pink-400" />
            </div>
            <h2 className="text-sm font-black text-white uppercase tracking-wide">Generovať Príspevky</h2>
          </div>

          <div className="p-5 space-y-5">
            {/* Platform Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                Platformy
              </label>
              <div className="flex gap-2">
                {(["Instagram", "Facebook"] as const).map((p) => {
                  const active = selectedPlatforms.has(p);
                  const pl = platformStyle(p);
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        const n = new Set(selectedPlatforms);
                        n.has(p) ? n.delete(p) : n.add(p);
                        setSelectedPlatforms(n);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex-1 justify-center"
                      style={
                        active
                          ? { background: pl.bg, border: `1px solid ${pl.border}`, color: pl.color }
                          : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }
                      }
                    >
                      {p === "Instagram" ? <Instagram className="w-4 h-4" /> : <Facebook className="w-4 h-4" />}
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Instagram Format Options */}
            {selectedPlatforms.has("Instagram") && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Instagram formát
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {instagramFormats.map((fmt) => {
                    const Icon = fmt.icon;
                    const active = instagramFormat === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        onClick={() => setInstagramFormat(fmt.id)}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all"
                        style={
                          active
                            ? { background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.3)" }
                            : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }
                        }
                      >
                        <Icon
                          className="w-4 h-4"
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
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Article Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                Vybrať článok{selectedArticles.size > 0 && ` (${selectedArticles.size} vybraných)`}
              </label>
              {/* Search */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                <input
                  type="text"
                  placeholder="Hľadať článok..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none placeholder:text-white/20"
                  style={inputStyle}
                />
              </div>
              {/* Article list */}
              <div
                className="rounded-xl overflow-y-auto max-h-52"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {filteredArticles.length === 0 ? (
                  <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>Žiadne publikované články</div>
                ) : (
                  filteredArticles.map((a) => {
                    const selected = selectedArticles.has(a.id);
                    return (
                      <label
                        key={a.id}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all"
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.03)",
                          background: selected ? "rgba(244,114,182,0.06)" : "transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            const n = new Set(selectedArticles);
                            n.has(a.id) ? n.delete(a.id) : n.add(a.id);
                            setSelectedArticles(n);
                          }}
                          className="w-4 h-4 rounded shrink-0"
                          style={{ accentColor: "#f472b6" }}
                        />
                        {a.main_image && (
                          <img src={a.main_image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{a.title}</p>
                          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{a.category}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={generatePosts}
                disabled={generating || selectedArticles.size === 0 || selectedPlatforms.size === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, rgba(244,114,182,0.2) 0%, rgba(244,114,182,0.08) 100%)",
                  border: "1px solid rgba(244,114,182,0.3)",
                  color: "#f472b6",
                }}
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {generating ? "Generujem..." : "Generovať príspevky"}
              </button>
              <button
                onClick={runAutopilot}
                disabled={generating || selectedPlatforms.size === 0}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{
                  background: "rgba(167,139,250,0.1)",
                  border: "1px solid rgba(167,139,250,0.25)",
                  color: "#a78bfa",
                }}
              >
                <Zap className="w-4 h-4" /> Autopilot
              </button>
            </div>
          </div>
        </div>

        {/* Bot Settings */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center gap-3 px-5 py-4 transition-all"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.2)" }}
            >
              <Settings className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-sm font-black text-white uppercase tracking-wide flex-1 text-left">Social Bot Nastavenia</span>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={
                  botSettings.enabled
                    ? { background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }
                }
              >
                {botSettings.enabled ? "Aktívny" : "Vypnutý"}
              </span>
              {showSettings ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
            </div>
          </button>

          {showSettings && (
            <div
              className="px-5 pb-5 space-y-5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              {/* Enable toggle */}
              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-sm font-semibold text-white">Zapnúť Social Bot</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Automatické generovanie a publikovanie</p>
                </div>
                <div
                  className="w-10 h-5 rounded-full relative cursor-pointer transition-all"
                  style={{
                    background: botSettings.enabled ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.1)",
                    border: botSettings.enabled ? "1px solid rgba(74,222,128,0.5)" : "1px solid rgba(255,255,255,0.15)",
                  }}
                  onClick={() => setBotSettings({ ...botSettings, enabled: !botSettings.enabled })}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                    style={{
                      background: botSettings.enabled ? "#4ade80" : "rgba(255,255,255,0.4)",
                      left: botSettings.enabled ? "calc(100% - 18px)" : "2px",
                    }}
                  />
                </div>
              </div>

              {/* Interval */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Interval (hodiny)
                </label>
                <input
                  type="number"
                  min="1"
                  value={botSettings.interval_hours}
                  onChange={(e) => setBotSettings({ ...botSettings, interval_hours: parseInt(e.target.value) })}
                  className="w-24 rounded-xl px-3 py-2 text-sm text-white outline-none"
                  style={inputStyle}
                />
              </div>

              {/* Posting times */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Časy publikovania
                </label>
                <div className="flex flex-wrap gap-2">
                  {botSettings.posting_times.map((time, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => {
                          const t = [...botSettings.posting_times];
                          t[idx] = e.target.value;
                          setBotSettings({ ...botSettings, posting_times: t });
                        }}
                        className="rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                        style={inputStyle}
                      />
                      <button
                        onClick={() => setBotSettings({ ...botSettings, posting_times: botSettings.posting_times.filter((_, i) => i !== idx) })}
                        className="p-1 rounded"
                        style={{ color: "rgba(239,68,68,0.6)" }}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setBotSettings({ ...botSettings, posting_times: [...botSettings.posting_times, "12:00"] })}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
                  >
                    <Plus className="w-3 h-3" /> Pridať
                  </button>
                </div>
              </div>

              {/* Auto publish */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Automaticky publikovať</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Publikovať bez ručného schválenia</p>
                </div>
                <div
                  className="w-10 h-5 rounded-full relative cursor-pointer transition-all"
                  style={{
                    background: botSettings.auto_publish ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.1)",
                    border: botSettings.auto_publish ? "1px solid rgba(74,222,128,0.5)" : "1px solid rgba(255,255,255,0.15)",
                  }}
                  onClick={() => setBotSettings({ ...botSettings, auto_publish: !botSettings.auto_publish })}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                    style={{
                      background: botSettings.auto_publish ? "#4ade80" : "rgba(255,255,255,0.4)",
                      left: botSettings.auto_publish ? "calc(100% - 18px)" : "2px",
                    }}
                  />
                </div>
              </div>

              <button
                onClick={saveBotSettings}
                disabled={savingSettings}
                className="w-full py-3 rounded-xl text-sm font-black transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, rgba(96,165,250,0.15) 0%, rgba(96,165,250,0.06) 100%)",
                  border: "1px solid rgba(96,165,250,0.25)",
                  color: "#60a5fa",
                }}
              >
                {savingSettings ? "Ukladám..." : "Uložiť Nastavenia"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
