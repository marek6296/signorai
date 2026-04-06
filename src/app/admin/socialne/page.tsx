"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { InstagramPreview } from "@/components/InstagramPreview";
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
  CheckCircle2,
  X,
  ExternalLink,
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
  external_id: string | null;
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

type PendingPost = { platform: string; content: string; article: Article };

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
  const [generatingProgress, setGeneratingProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Pending (preview before save)
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);
  // Editable pending content
  const [pendingIgContent, setPendingIgContent] = useState("");
  const [pendingFbContent, setPendingFbContent] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishingPlatform, setPublishingPlatform] = useState<string | null>(null);

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
    setTimeout(() => setToast(null), type === "error" ? 7000 : 3500);
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

  const publishPost = async (id: string, platform?: string) => {
    setPublishingId(id);
    setPublishingPlatform(platform || null);
    const imageVariant = platform === "Instagram" ? "photo" : "studio";
    try {
      const res = await fetch("/api/admin/publish-social-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, secret: "make-com-webhook-secret", variant: imageVariant }),
      });
      if (res.ok) {
        await fetchPosts();
        showToast(`${platform || "Príspevok"} publikovaný ✓`);
      } else {
        const data = await res.json().catch(() => ({}));
        const errMsg = data?.error || "Chyba pri publikovaní";
        showToast(errMsg.slice(0, 120), "error");
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Sieťová chyba", "error");
    } finally {
      setPublishingId(null);
      setPublishingPlatform(null);
    }
  };

  const socialAction = async (action: string, postId: string, platform: string, message?: string) => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/social-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, postId, platform, message, secret: "make-com-webhook-secret" }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Akcia úspešná ✓");
        await fetchPosts();
      } else {
        showToast(data.error || "Chyba pri akcii", "error");
      }
    } catch (e: unknown) {
      showToast("Chyba pripojenia", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: Generate text only → show in preview, do NOT save to DB yet ──
  const generatePosts = async () => {
    if (selectedArticles.size === 0 || selectedPlatforms.size === 0) {
      showToast("Vyberte aspoň jeden článok a platformu", "error");
      return;
    }
    setGenerating(true);
    setPendingPosts([]);
    setPreviewArticle(null);

    const articlesToProcess = articles.filter((a) => selectedArticles.has(a.id));
    const platforms = Array.from(selectedPlatforms);
    const total = articlesToProcess.length * platforms.length;
    let current = 0;
    const generated: PendingPost[] = [];

    try {
      for (const article of articlesToProcess) {
        for (const platform of platforms) {
          current++;
          setGeneratingProgress({
            current,
            total,
            label: `${article.title.slice(0, 45)}${article.title.length > 45 ? "…" : ""} → ${platform}`,
          });

          const textRes = await fetch("/api/admin/generate-social-post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: article.title,
              excerpt: article.excerpt,
              url: `https://aiwai.news/article/${article.slug}`,
              platform,
            }),
          });
          if (!textRes.ok) throw new Error("Text generation failed");
          const { socialPost } = await textRes.json();
          generated.push({ platform, content: socialPost || "", article });
        }
      }

      setPendingPosts(generated);

      // Set preview to the first article that has an Instagram post
      const firstIg = generated.find((p) => p.platform === "Instagram");
      const firstArticle = firstIg?.article || generated[0]?.article || null;
      setPreviewArticle(firstArticle || null);

      // Initialize editable content (for the first article)
      const igPost = generated.find((p) => p.platform === "Instagram" && p.article.id === firstArticle?.id);
      const fbPost = generated.find((p) => p.platform === "Facebook" && p.article.id === firstArticle?.id);
      setPendingIgContent(igPost?.content || "");
      setPendingFbContent(fbPost?.content || "");

      setSelectedArticles(new Set());
      showToast("Texty vygenerované — skontroluj a potvrď");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Chyba";
      showToast(`Chyba: ${msg}`, "error");
    } finally {
      setGenerating(false);
      setGeneratingProgress(null);
    }
  };

  // ── Step 2: Confirm → save to DB + pre-render image ──
  const confirmAndSave = async () => {
    if (!pendingPosts.length || !previewArticle) return;
    setConfirming(true);

    try {
      const savedIds: { platform: string; id: string }[] = [];

      // Sync editable content back to pendingPosts before saving
      const toSave = pendingPosts.map((p) => {
        if (p.platform === "Instagram" && p.article.id === previewArticle.id) {
          return { ...p, content: pendingIgContent };
        }
        if (p.platform === "Facebook" && p.article.id === previewArticle.id) {
          return { ...p, content: pendingFbContent };
        }
        return p;
      });

      for (const pending of toSave) {
        const saveRes = await fetch("/api/admin/social-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{
            article_id: pending.article.id,
            platform: pending.platform,
            content: pending.content,
            status: "draft",
          }]),
        });
        if (!saveRes.ok) throw new Error("Save failed");
        const savedArr = await saveRes.json();
        const savedPost = savedArr?.[0];
        if (savedPost?.id) {
          savedIds.push({ platform: pending.platform, id: savedPost.id });
        }
      }

      // Render Instagram image directly (no self-referencing HTTP call — just use the preview route)
      const igSaved = savedIds.find((s) => s.platform === "Instagram");
      if (igSaved) {
        try {
          const articleImageUrl = previewArticle?.main_image || "";
          const previewParams = new URLSearchParams({ title: previewArticle!.title, variant: "photo", date: new Date().toISOString() });
          if (articleImageUrl) previewParams.set("imageUrl", articleImageUrl);

          const pngRes = await fetch(`/api/social-image/preview?${previewParams.toString()}`);
          if (pngRes.ok) {
            const pngBlob = await pngRes.blob();
            const pngBuffer = await pngBlob.arrayBuffer();
            const fileName = `pre-render-${igSaved.id}-${Date.now()}.png`;

            const { error: uploadError } = await supabase.storage
              .from("social-images")
              .upload(fileName, pngBuffer, { contentType: "image/png", upsert: true });

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage.from("social-images").getPublicUrl(fileName);
              await supabase.from("social_posts").update({ image_url: publicUrl }).eq("id", igSaved.id);
            }
          }
        } catch { /* non-fatal — post saved, image can be regenerated */ }
      }

      await fetchPosts();
      setPendingPosts([]);
      setPreviewArticle(null);
      setPendingIgContent("");
      setPendingFbContent("");
      setActiveTab("draft");
      showToast(`${toSave.length} príspevkov uložených do draftov ✓`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Chyba";
      showToast(`Chyba: ${msg}`, "error");
    } finally {
      setConfirming(false);
    }
  };

  // ── Save button in preview → server-render to local route (no DB save) ──
  const handlePreviewSaveRender = async (variant: "studio" | "photo", currentImageUrl: string): Promise<string | null> => {
    if (!previewArticle) return null;
    const params = new URLSearchParams({ title: previewArticle.title, variant });
    if (currentImageUrl && !currentImageUrl.startsWith('data:')) {
      params.set('imageUrl', currentImageUrl);
    } else if (previewArticle.main_image) {
      // currentImg is base64 (proxy'd), fall back to the raw article image URL
      params.set('imageUrl', previewArticle.main_image);
    }
    params.set('date', new Date().toISOString());
    return `/api/social-image/preview?${params.toString()}`;
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
    const { error } = await supabase.from("site_settings").upsert({ key: "social_bot", value: botSettings }, { onConflict: "key" });
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

  const hasPendingPreview = pendingPosts.length > 0 && !!previewArticle;
  const pendingIgPost = pendingPosts.find((p) => p.platform === "Instagram");
  const pendingFbPost = pendingPosts.find((p) => p.platform === "Facebook");

  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      {/* ── Fixed generating overlay (top-center) ── */}
      {(generating && generatingProgress) && (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center pt-5" style={{ pointerEvents: "none" }}>
          <div
            className="rounded-2xl px-5 py-4 flex items-center gap-4"
            style={{
              background: "linear-gradient(145deg, #141414 0%, #0f0f0f 100%)",
              border: "1px solid rgba(244,114,182,0.35)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.8), 0 0 24px rgba(244,114,182,0.12)",
              minWidth: 340, maxWidth: 500,
              animation: "slideDownGen 0.3s ease",
            }}
          >
            <style>{`@keyframes slideDownGen { from { opacity:0; transform:translateY(-16px); } to { opacity:1; transform:translateY(0); } }`}</style>
            <div className="relative w-9 h-9 shrink-0">
              <div className="absolute inset-0 rounded-full" style={{ border: "2px solid rgba(255,255,255,0.06)" }} />
              <div className="absolute inset-0 rounded-full animate-spin" style={{ border: "2px solid transparent", borderTopColor: "#f472b6", borderRightColor: "rgba(244,114,182,0.3)" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-4 h-4" style={{ color: "#f472b6" }} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-black text-white">Generujem texty...</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(244,114,182,0.12)", border: "1px solid rgba(244,114,182,0.3)", color: "#f472b6" }}>
                  {generatingProgress.current}/{generatingProgress.total}
                </span>
              </div>
              <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{generatingProgress.label}</p>
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(generatingProgress.current / generatingProgress.total) * 100}%`, background: "linear-gradient(to right, #f472b6, #e879f9)" }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Fixed confirming overlay ── */}
      {confirming && (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center pt-5" style={{ pointerEvents: "none" }}>
          <div
            className="rounded-2xl px-5 py-4 flex items-center gap-4"
            style={{
              background: "linear-gradient(145deg, #141414 0%, #0f0f0f 100%)",
              border: "1px solid rgba(74,222,128,0.35)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.8), 0 0 24px rgba(74,222,128,0.12)",
              minWidth: 280,
              animation: "slideDownGen 0.3s ease",
            }}
          >
            <div className="relative w-9 h-9 shrink-0">
              <div className="absolute inset-0 rounded-full animate-spin" style={{ border: "2px solid transparent", borderTopColor: "#4ade80", borderRightColor: "rgba(74,222,128,0.3)" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" style={{ color: "#4ade80" }} />
              </div>
            </div>
            <div>
              <span className="text-sm font-black text-white">Ukladám do draftov...</span>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Renderujem Instagram obrázok</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Publishing overlay ── */}
      {publishingId && (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center pt-5" style={{ pointerEvents: "none" }}>
          <div
            className="rounded-2xl px-5 py-4 flex items-center gap-4"
            style={{
              background: "linear-gradient(145deg, #141414 0%, #0f0f0f 100%)",
              border: publishingPlatform === "Instagram"
                ? "1px solid rgba(244,114,182,0.45)"
                : "1px solid rgba(59,130,246,0.45)",
              boxShadow: publishingPlatform === "Instagram"
                ? "0 8px 40px rgba(0,0,0,0.8), 0 0 24px rgba(244,114,182,0.15)"
                : "0 8px 40px rgba(0,0,0,0.8), 0 0 24px rgba(59,130,246,0.15)",
              minWidth: 320,
              animation: "slideDownGen 0.3s ease",
            }}
          >
            {/* Platform icon spinner */}
            <div className="relative w-9 h-9 shrink-0">
              <div className="absolute inset-0 rounded-full" style={{ border: "2px solid rgba(255,255,255,0.06)" }} />
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  border: "2px solid transparent",
                  borderTopColor: publishingPlatform === "Instagram" ? "#f472b6" : "#60a5fa",
                  borderRightColor: publishingPlatform === "Instagram" ? "rgba(244,114,182,0.3)" : "rgba(96,165,250,0.3)",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {publishingPlatform === "Instagram"
                  ? <Instagram className="w-4 h-4" style={{ color: "#f472b6" }} />
                  : <Facebook className="w-4 h-4" style={{ color: "#60a5fa" }} />
                }
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-black text-white">
                  Publikujem na {publishingPlatform || "sociálnu sieť"}...
                </span>
              </div>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                {publishingPlatform === "Instagram"
                  ? "Renderujem obrázok → nahrávam na Meta API"
                  : "Odosielam link post → Meta Graph API"}
              </p>
              {/* Indeterminate progress bar */}
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: "40%",
                    background: publishingPlatform === "Instagram"
                      ? "linear-gradient(to right, #f472b6, #e879f9)"
                      : "linear-gradient(to right, #60a5fa, #818cf8)",
                    animation: "publishSlide 1.4s ease-in-out infinite",
                  }}
                />
              </div>
              <style>{`
                @keyframes publishSlide {
                  0%   { margin-left: 0;   width: 35%; }
                  50%  { margin-left: 55%; width: 45%; }
                  100% { margin-left: 0;   width: 35%; }
                }
              `}</style>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold cursor-pointer"
          style={
            toast.type === "success"
              ? { background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.35)", color: "#4ade80", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", maxWidth: 380 }
              : { background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.45)", color: "#fca5a5", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", maxWidth: 380 }
          }
          onClick={() => setToast(null)}
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
          <div className="flex items-center gap-1 p-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
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
                  const isIg = post.platform === "Instagram";
                  return (
                    <div
                      key={post.id}
                      className="rounded-xl flex flex-col overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      {/* Platform badge */}
                      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        {isIg
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

                      {/* Instagram: show 1:1 styled image */}
                      {isIg && post.image_url && (
                        <div className="w-full aspect-square overflow-hidden">
                          <img
                            src={post.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Facebook: show link-card style preview (FB generates OG from article URL) */}
                      {!isIg && post.articles?.title && (
                        <div
                          className="mx-3 mt-3 rounded-xl overflow-hidden"
                          style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}
                        >
                          {post.articles?.main_image && (
                            <img src={post.articles.main_image} alt="" className="w-full h-24 object-cover opacity-80" />
                          )}
                          <div className="px-3 py-2">
                            <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                              aiwai.news
                            </div>
                            <div className="text-[11px] font-semibold leading-tight line-clamp-2" style={{ color: "rgba(255,255,255,0.7)" }}>
                              {post.articles.title}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Content text */}
                      <div className="px-4 py-3 flex-1">
                        <p className="text-xs line-clamp-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {post.content}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        {post.status === "draft" ? (() => {
                          const isPublishing = publishingId === post.id;
                          return (
                            <div className="flex gap-2">
                                <button
                                onClick={() => !isPublishing && publishPost(post.id, post.platform)}
                                disabled={isPublishing || !!publishingId}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-60"
                                style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}
                                >
                                {isPublishing
                                    ? <><RefreshCw className="w-3 h-3 animate-spin" /> Publikujem...</>
                                    : <><Send className="w-3 h-3" /> Publikovať</>
                                }
                                </button>
                                <button
                                onClick={() => deletePost(post.id)}
                                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all"
                                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#f87171" }}
                                >
                                <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                          );
                        })() : (
                            <div className="space-y-3">
                                {/* Comment Section for Posted Items */}
                                <div className="flex gap-1.5">
                                    <input 
                                        type="text" 
                                        id={`comment-${post.id}`}
                                        placeholder="Nový komentár..."
                                        className="flex-1 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = (e.target as HTMLInputElement).value;
                                                if (val) {
                                                    socialAction('comment', post.id, post.platform, val);
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }
                                        }}
                                    />
                                    <button 
                                        onClick={() => {
                                            const el = document.getElementById(`comment-${post.id}`) as HTMLInputElement;
                                            if (el.value) {
                                                socialAction('comment', post.id, post.platform, el.value);
                                                el.value = '';
                                            }
                                        }}
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold"
                                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                                    >
                                        OK
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    {isIg && post.articles?.slug && (
                                    <a
                                        href={`https://aiwai.news/article/${post.articles.slug}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition-all"
                                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
                                    >
                                        <ExternalLink className="w-3 h-3" /> Web
                                    </a>
                                    )}
                                    {post.platform === 'Facebook' ? (
                                        <button
                                            onClick={() => {
                                                if (confirm("Naozaj vymazať príspevok z Facebooku?")) {
                                                    socialAction('delete_social', post.id, post.platform);
                                                }
                                            }}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition-all"
                                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#f87171" }}
                                        >
                                            <Trash2 className="w-3 h-3" /> Zmazať FB
                                        </button>
                                    ) : (
                                        <div className="flex-1 text-[9px] text-center opacity-30 px-2 py-2 border border-white/5 rounded-lg flex items-center justify-center leading-tight">
                                            IG mazanie len v appke
                                        </div>
                                    )}
                                    <button
                                        onClick={() => deletePost(post.id)}
                                        className="p-2 rounded-lg transition-all"
                                        style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.2)" }}
                                        title="Zmazať len z Admina"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        )}
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
          className="rounded-2xl"
          style={{
            background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(244,114,182,0.12)", border: "1px solid rgba(244,114,182,0.2)" }}
            >
              <Zap className="w-3.5 h-3.5 text-pink-400" />
            </div>
            <h2 className="text-sm font-black text-white uppercase tracking-wide">Generovať Príspevky</h2>
          </div>

          {/* Two-column layout: form left, preview right */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px]">

            {/* LEFT: form */}
            <div className="p-5 space-y-5 min-w-0">
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
                          <Icon className="w-4 h-4" style={{ color: active ? "#f472b6" : "rgba(255,255,255,0.3)" }} />
                          <span className="text-[10px] font-bold leading-tight" style={{ color: active ? "#f472b6" : "rgba(255,255,255,0.4)" }}>
                            {fmt.label}
                          </span>
                          <span className="text-[9px] leading-tight" style={{ color: "rgba(255,255,255,0.2)" }}>
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

            {/* RIGHT: preview + confirm panel */}
            <div className="p-4 flex flex-col gap-4 min-w-0" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)" }}>

              {hasPendingPreview ? (
                <>
                  {/* Panel header */}
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Náhľad · Potvrď pred uložením
                    </div>
                    <button
                      onClick={() => { setPendingPosts([]); setPreviewArticle(null); }}
                      className="p-1.5 rounded-lg transition-all"
                      style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)" }}
                      title="Zahodiť"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Instagram image preview */}
                  {pendingIgPost && (
                    <InstagramPreview
                      title={previewArticle!.title}
                      articleImage={previewArticle!.main_image}
                      category={previewArticle!.category}
                      articleId={previewArticle!.id}
                      id="socialne-preview"
                      onImageUpdate={(url) => {
                        // Keep previewArticle in sync so pre-render picks up the new image
                        setPreviewArticle((prev) => prev ? { ...prev, main_image: url } : prev);
                      }}
                      // Server-render Save: calls /api/social-image/preview (no DB save, just downloads)
                      onSaveAndRender={handlePreviewSaveRender}
                    />
                  )}

                  {/* Instagram text (editable) */}
                  {pendingIgPost && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Instagram className="w-3.5 h-3.5" style={{ color: "#f9a8d4" }} />
                        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#f9a8d4" }}>Instagram príspevok</span>
                      </div>
                      <textarea
                        value={pendingIgContent}
                        onChange={(e) => setPendingIgContent(e.target.value)}
                        rows={5}
                        className="w-full rounded-xl p-3 text-xs leading-relaxed resize-none outline-none focus:ring-1 focus:ring-pink-400/30 transition-all"
                        style={{ background: "rgba(236,72,153,0.05)", border: "1px solid rgba(236,72,153,0.2)", color: "rgba(255,255,255,0.75)" }}
                      />
                    </div>
                  )}

                  {/* Facebook text (editable) */}
                  {pendingFbPost && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Facebook className="w-3.5 h-3.5" style={{ color: "#93c5fd" }} />
                        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#93c5fd" }}>Facebook príspevok</span>
                      </div>
                      <textarea
                        value={pendingFbContent}
                        onChange={(e) => setPendingFbContent(e.target.value)}
                        rows={5}
                        className="w-full rounded-xl p-3 text-xs leading-relaxed resize-none outline-none focus:ring-1 focus:ring-blue-400/30 transition-all"
                        style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)", color: "rgba(255,255,255,0.75)" }}
                      />
                    </div>
                  )}

                  {/* Confirm button */}
                  <button
                    onClick={confirmAndSave}
                    disabled={confirming}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, rgba(74,222,128,0.2) 0%, rgba(74,222,128,0.08) 100%)",
                      border: "1px solid rgba(74,222,128,0.35)",
                      color: "#4ade80",
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {confirming ? "Ukladám..." : "Potvrdiť & Uložiť do draftu"}
                  </button>
                </>
              ) : (
                /* Empty state */
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(244,114,182,0.08)", border: "1px solid rgba(244,114,182,0.12)" }}>
                    <ImageIcon className="w-6 h-6" style={{ color: "rgba(244,114,182,0.4)" }} />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Náhľad príspevku
                    </p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.15)" }}>
                      Vygeneruj príspevky a tu uvidíš náhľad
                    </p>
                  </div>
                </div>
              )}
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
            <div className="px-5 pb-5 space-y-5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
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
                  onClick={async () => {
                    const updated = { ...botSettings, enabled: !botSettings.enabled };
                    setBotSettings(updated);
                    await supabase.from("site_settings").upsert({ key: "social_bot", value: updated }, { onConflict: "key" });
                    showToast(updated.enabled ? "Social Bot zapnutý ✓" : "Social Bot vypnutý");
                  }}
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
