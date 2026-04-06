"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search,
  RefreshCw,
  Edit,
  ArrowDown,
  Globe,
  Trash2,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  ExternalLink,
  FileText,
  CheckCircle2,
  Clock,
} from "lucide-react";

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  main_image: string;
  category: string;
  source_url: string | null;
  ai_summary: string | null;
  published_at: string;
  status: "published" | "draft";
};

const ITEMS_PER_PAGE = 20;

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

function catStyle(cat: string) {
  if (cat === "AI") return { bg: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "rgba(59,130,246,0.25)" };
  if (cat === "Tech") return { bg: "rgba(168,85,247,0.12)", color: "#c4b5fd", border: "rgba(168,85,247,0.25)" };
  if (cat?.startsWith("Návody")) return { bg: "rgba(34,197,94,0.12)", color: "#86efac", border: "rgba(34,197,94,0.25)" };
  return { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.12)" };
}

/* ─── Article Preview Modal ─────────────────────────────────────── */
function ArticlePreviewModal({ article, onClose, onPublish, onUnpublish }: {
  article: Article;
  onClose: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const cat = catStyle(article.category);
  const isPublished = article.status === "published";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #111111 0%, #0c0c0c 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* Top inner glow */}
        <div
          className="absolute top-0 left-8 right-8 h-px"
          style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)" }}
        />

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2.5">
            <Eye className="w-4 h-4" style={{ color: "#60a5fa" }} />
            <span className="text-sm font-black text-white uppercase tracking-wide">Náhľad Článku</span>
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-full ml-1"
              style={
                isPublished
                  ? { background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }
                  : { background: "rgba(250,204,21,0.1)", color: "#facc15", border: "1px solid rgba(250,204,21,0.25)" }
              }
            >
              {isPublished ? "● Publikované" : "○ Draft"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Article Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero image */}
          {article.main_image && (
            <div className="w-full aspect-video overflow-hidden relative">
              <img
                src={article.main_image}
                alt={article.title}
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(17,17,17,0.8) 0%, transparent 50%)" }}
              />
            </div>
          )}

          <div className="px-6 py-6">
            {/* Category + date */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}
              >
                {article.category}
              </span>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                {formatDate(article.published_at)}
              </span>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                {article.slug}
              </span>
            </div>

            {/* Title */}
            <h1
              className="text-xl md:text-2xl font-black text-white leading-tight mb-3"
            >
              {article.title}
            </h1>

            {/* Excerpt */}
            {article.excerpt && (
              <p className="text-base leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.6)" }}>
                {article.excerpt}
              </p>
            )}

            {/* Divider */}
            <div className="h-px mb-5" style={{ background: "rgba(255,255,255,0.06)" }} />

            {/* Content preview */}
            {article.content && (
              <div
                className="text-sm leading-relaxed space-y-3"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                {article.content
                  .split("\n\n")
                  .filter((p) => p.trim())
                  .slice(0, 6)
                  .map((para, idx) => (
                    <p key={idx}>{para.replace(/^#{1,3}\s+/, "").replace(/\*\*/g, "")}</p>
                  ))}
                {article.content.split("\n\n").length > 6 && (
                  <p className="italic" style={{ color: "rgba(255,255,255,0.3)" }}>
                    ... (zvyšok článku na webe)
                  </p>
                )}
              </div>
            )}

            {/* Source link */}
            {article.source_url && (
              <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <a
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs transition-colors"
                  style={{ color: "rgba(96,165,250,0.8)" }}
                >
                  <ExternalLink className="w-3 h-3" />
                  Zdroj: {article.source_url}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="flex items-center gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <a
            href={`/admin/edit/${article.slug}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            <Edit className="w-3.5 h-3.5" /> Upraviť
          </a>

          <a
            href={`https://aiwai.news/article/${article.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: "rgba(96,165,250,0.08)",
              border: "1px solid rgba(96,165,250,0.2)",
              color: "#60a5fa",
            }}
          >
            <ExternalLink className="w-3.5 h-3.5" /> Otvoriť na webe
          </a>

          <div className="flex-1" />

          {isPublished ? (
            <button
              onClick={onUnpublish}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: "rgba(250,204,21,0.08)",
                border: "1px solid rgba(250,204,21,0.2)",
                color: "#facc15",
              }}
            >
              <ArrowDown className="w-3.5 h-3.5" /> Stiahnuť do draftu
            </button>
          ) : (
            <button
              onClick={onPublish}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all"
              style={{
                background: "linear-gradient(135deg, rgba(74,222,128,0.2) 0%, rgba(74,222,128,0.1) 100%)",
                border: "1px solid rgba(74,222,128,0.35)",
                color: "#4ade80",
                boxShadow: "0 0 20px rgba(74,222,128,0.1)",
              }}
            >
              <Globe className="w-3.5 h-3.5" /> Publikovať na web
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */
export default function ClankyPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);

  useEffect(() => { fetchArticles(); }, []);
  useEffect(() => { applyFilters(); }, [articles, searchTerm, statusFilter, categoryFilter]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .order("published_at", { ascending: false });
      if (error) throw error;
      setArticles(data || []);
    } catch {
      showToast("Chyba pri načítavaní", "error");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let f = articles;
    if (searchTerm) f = f.filter((a) => a.title.toLowerCase().includes(searchTerm.toLowerCase()));
    if (statusFilter !== "all") f = f.filter((a) => a.status === statusFilter);
    if (categoryFilter !== "all") f = f.filter((a) => a.category === categoryFilter);
    setFilteredArticles(f);
    setCurrentPage(1);
  };

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const revalidate = async () => {
    try { await fetch(`/api/revalidate?secret=make-com-webhook-secret`); } catch { /* silent */ }
  };

  const toggleStatus = async (article: Article) => {
    const newStatus = article.status === "published" ? "draft" : "published";
    await supabase.from("articles").update({ status: newStatus }).eq("id", article.id);
    await revalidate();
    await fetchArticles();
    if (previewArticle?.id === article.id) {
      setPreviewArticle({ ...previewArticle, status: newStatus });
    }
    showToast(newStatus === "published" ? "Článok publikovaný ✓" : "Stiahnutý do draftu");
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("Naozaj chcete zmazať tento článok?")) return;
    setDeletingId(id);
    await supabase.from("articles").delete().eq("id", id);
    await revalidate();
    await fetchArticles();
    setDeletingId(null);
    if (previewArticle?.id === id) setPreviewArticle(null);
    showToast("Článok zmazaný");
  };

  const generateImage = async (articleId: string) => {
    setGeneratingImages(new Set(Array.from(generatingImages).concat([articleId])));
    try {
      await fetch("/api/admin/article-image-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, secret: "make-com-webhook-secret" }),
      });
      await fetchArticles();
      showToast("Obrázok regenerovaný ✓");
    } catch {
      showToast("Chyba pri generovaní obrázka", "error");
    } finally {
      setGeneratingImages(new Set(Array.from(generatingImages).filter((id) => id !== articleId)));
    }
  };

  const bulkAction = async (action: "images" | "categories" | "delete") => {
    if (selectedArticles.size === 0) return;
    if (action === "delete" && !confirm(`Zmazať ${selectedArticles.size} článkov?`)) return;
    setRefreshing(true);
    try {
      if (action === "images") {
        await fetch("/api/admin/refresh-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleIds: Array.from(selectedArticles), secret: "make-com-webhook-secret" }),
        });
        showToast("Obrázky regenerované ✓");
      } else if (action === "categories") {
        await fetch("/api/admin/refresh-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleIds: Array.from(selectedArticles), secret: "make-com-webhook-secret" }),
        });
        showToast("Kategórie opravené ✓");
      } else {
        for (const id of Array.from(selectedArticles)) {
          await supabase.from("articles").delete().eq("id", id);
        }
        await revalidate();
        showToast("Články zmazané");
      }
      await fetchArticles();
      setSelectedArticles(new Set());
    } catch {
      showToast("Chyba pri hromadnej akcii", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const paginatedArticles = filteredArticles.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const totalPages = Math.ceil(filteredArticles.length / ITEMS_PER_PAGE);
  const uniqueCategories = Array.from(new Set(articles.map((a) => a.category)));
  const draftCount = articles.filter((a) => a.status === "draft").length;

  const inputStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#ffffff",
  };

  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      {/* Preview Modal */}
      {previewArticle && (
        <ArticlePreviewModal
          article={previewArticle}
          onClose={() => setPreviewArticle(null)}
          onPublish={() => toggleStatus(previewArticle)}
          onUnpublish={() => toggleStatus(previewArticle)}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div
          className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold"
          style={
            toastMsg.type === "success"
              ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }
              : { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }
          }
        >
          {toastMsg.text}
        </div>
      )}

      <div className="p-5 md:p-7 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h1
              className="text-2xl md:text-3xl font-black uppercase tracking-tight"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.6) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Články
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                {articles.length} celkovo
              </span>
              {draftCount > 0 && (
                <span
                  className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer"
                  style={{ background: "rgba(250,204,21,0.1)", color: "#facc15", border: "1px solid rgba(250,204,21,0.25)" }}
                  onClick={() => setStatusFilter("draft")}
                >
                  <Clock className="w-3 h-3" />
                  {draftCount} draft{draftCount !== 1 ? "y" : ""}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => { setRefreshing(true); fetchArticles().finally(() => setRefreshing(false)); }}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all self-start disabled:opacity-50"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? "animate-spin" : ""}`} />
            Aktualizovať
          </button>
        </div>

        {/* Filters */}
        <div
          className="rounded-2xl p-4 flex flex-col sm:flex-row gap-3"
          style={{
            background: "linear-gradient(145deg, #111111 0%, #0d0d0d 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
            <input
              type="text"
              placeholder="Hľadať podľa titulu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none placeholder:text-white/25 transition-all"
              style={inputStyle}
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "published" | "draft")}
            className="px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
            style={inputStyle}
          >
            <option value="all">Všetky stavy</option>
            <option value="published">Publikované</option>
            <option value="draft">Draft</option>
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
            style={inputStyle}
          >
            <option value="all">Všetky kategórie</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Count */}
          <div
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm shrink-0"
            style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.35)" }}
          >
            <FileText className="w-3.5 h-3.5" />
            {filteredArticles.length}
          </div>
        </div>

        {/* Articles Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-2xl animate-pulse"
                style={{ background: "rgba(255,255,255,0.03)" }}
              />
            ))}
          </div>
        ) : paginatedArticles.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
            <p style={{ color: "rgba(255,255,255,0.3)" }}>Žiadne články</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {paginatedArticles.map((article) => {
              const cat = catStyle(article.category);
              const isPublished = article.status === "published";

              return (
                <div
                  key={article.id}
                  className="group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                  onClick={() => setPreviewArticle(article)}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedArticles.has(article.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      const n = new Set(selectedArticles);
                      n.has(article.id) ? n.delete(article.id) : n.add(article.id);
                      setSelectedArticles(n);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded shrink-0 cursor-pointer"
                    style={{ accentColor: "rgba(255,255,255,0.5)" }}
                  />

                  {/* Status dot */}
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: isPublished ? "#4ade80" : "#facc15" }}
                  />

                  {/* Thumbnail */}
                  {article.main_image && (
                    <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 hidden sm:block">
                      <img src={article.main_image} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Title & slug */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-tight">{article.title}</p>
                    <p className="text-[10px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {article.slug}
                    </p>
                  </div>

                  {/* Category */}
                  <span
                    className="text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 hidden md:block"
                    style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}
                  >
                    {article.category}
                  </span>

                  {/* Status */}
                  <span
                    className="text-[9px] font-black px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 hidden sm:flex"
                    style={
                      isPublished
                        ? { background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }
                        : { background: "rgba(250,204,21,0.1)", color: "#facc15", border: "1px solid rgba(250,204,21,0.2)" }
                    }
                  >
                    {isPublished ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                    {isPublished ? "Pub." : "Draft"}
                  </span>

                  {/* Date */}
                  <span
                    className="text-[11px] shrink-0 w-20 text-right hidden lg:block"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    {formatDate(article.published_at)}
                  </span>

                  {/* Actions */}
                  <div
                    className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setPreviewArticle(article)}
                      className="p-2 rounded-lg transition-all"
                      style={{ color: "rgba(96,165,250,0.8)", background: "rgba(96,165,250,0.08)" }}
                      title="Náhľad"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => toggleStatus(article)}
                      className="p-2 rounded-lg transition-all"
                      style={
                        isPublished
                          ? { color: "rgba(250,204,21,0.8)", background: "rgba(250,204,21,0.08)" }
                          : { color: "rgba(74,222,128,0.8)", background: "rgba(74,222,128,0.08)" }
                      }
                      title={isPublished ? "Stiahnuť do draftu" : "Publikovať"}
                    >
                      {isPublished ? <ArrowDown className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => generateImage(article.id)}
                      disabled={generatingImages.has(article.id)}
                      className="p-2 rounded-lg transition-all disabled:opacity-40"
                      style={{ color: "rgba(192,132,252,0.8)", background: "rgba(192,132,252,0.08)" }}
                      title="Regenerovať obrázok"
                    >
                      <ImageIcon className={`w-3.5 h-3.5 ${generatingImages.has(article.id) ? "animate-spin" : ""}`} />
                    </button>

                    <button
                      onClick={() => deleteArticle(article.id)}
                      disabled={deletingId === article.id}
                      className="p-2 rounded-lg transition-all disabled:opacity-40"
                      style={{ color: "rgba(239,68,68,0.7)", background: "rgba(239,68,68,0.07)" }}
                      title="Zmazať"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl transition-all disabled:opacity-30"
              style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)" }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className="w-9 h-9 rounded-xl text-sm font-semibold transition-all"
                style={
                  currentPage === page
                    ? { background: "rgba(255,255,255,0.15)", color: "#ffffff" }
                    : { color: "rgba(255,255,255,0.35)", background: "transparent" }
                }
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl transition-all disabled:opacity-30"
              style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)" }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedArticles.size > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 md:left-[264px] px-5 py-4 flex items-center gap-3"
          style={{
            background: "rgba(10,10,10,0.95)",
            backdropFilter: "blur(12px)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span className="text-sm font-semibold text-white">{selectedArticles.size} vybraných</span>
          <div className="flex gap-2 flex-1">
            <button
              onClick={() => bulkAction("images")}
              disabled={refreshing}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", color: "#60a5fa" }}
            >
              Regenerovať obrázky
            </button>
            <button
              onClick={() => bulkAction("categories")}
              disabled={refreshing}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: "rgba(192,132,252,0.12)", border: "1px solid rgba(192,132,252,0.25)", color: "#c084fc" }}
            >
              Opraviť kategórie
            </button>
            <button
              onClick={() => bulkAction("delete")}
              disabled={refreshing}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
            >
              Zmazať
            </button>
          </div>
          <button
            onClick={() => setSelectedArticles(new Set())}
            className="p-2 rounded-xl transition-all"
            style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
