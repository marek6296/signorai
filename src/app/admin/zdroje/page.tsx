"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Plus,
  Trash2,
  Search,
  Zap,
  CheckCircle,
  AlertCircle,
  Edit2,
  X,
  Radio,
  Rss,
  Globe,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";

interface DiscoverySource {
  id: string;
  source_name: string;
  feed_url: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

interface Toast {
  message: string;
  type: "success" | "error" | "info";
}

const BLUE = "#3b82f6";
const BLUE_DIM = "rgba(59,130,246,0.1)";
const BLUE_BORDER = "rgba(59,130,246,0.2)";

const CATEGORIES = ["AI", "Tech", "Návody & Tipy"];

const getCategoryStyle = (category: string) => {
  switch (category?.toLowerCase()) {
    case "ai":
      return { background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" };
    case "tech":
      return { background: "rgba(168,85,247,0.12)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.25)" };
    default:
      return { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" };
  }
};

function Toast({ toast }: { toast: { message: string; type: string } }) {
  const colors = {
    success: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", dot: "#22c55e" },
    error: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", dot: "#ef4444" },
    info: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)", dot: "#3b82f6" },
  };
  const c = colors[toast.type as keyof typeof colors] || colors.info;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 1000,
      display: "flex", alignItems: "center", gap: 10,
      background: c.bg, border: `1px solid ${c.border}`,
      backdropFilter: "blur(12px)", borderRadius: 12,
      padding: "12px 18px", fontSize: 13, fontWeight: 500, color: "#fff",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {toast.message}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ElementType; accent: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 500 }}>{label}</p>
          <p style={{ fontSize: 28, fontWeight: 700 }}>{value}</p>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}

export default function SourcesPage() {
  const [sources, setSources] = useState<DiscoverySource[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState<{ title?: string; source?: string; category?: string }[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);

  const [formData, setFormData] = useState({
    source_name: "",
    feed_url: "",
    category: "AI",
    is_active: true,
  });

  const [discoveryForm, setDiscoveryForm] = useState({
    categories: ["AI"],
    count: 8,
    days: 3,
    query: "",
    useRss: true,
  });

  const [stats, setStats] = useState({
    totalSources: 0,
    activeSources: 0,
    pendingNews: 0,
    processedNews: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/discovery-sources");
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      } else {
        const { data } = await supabase.from("discovery_sources").select("*");
        setSources(data || []);
      }

      const { count: totalCount } = await supabase.from("discovery_sources").select("*", { count: "exact", head: true });
      const { count: activeCount } = await supabase.from("discovery_sources").select("*", { count: "exact", head: true }).eq("is_active", true);
      const { data: newsData } = await supabase.from("suggested_news").select("status");

      setStats({
        totalSources: totalCount || 0,
        activeSources: activeCount || 0,
        pendingNews: newsData?.filter((n) => n.status === "pending").length || 0,
        processedNews: newsData?.filter((n) => n.status === "processed").length || 0,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      showToast("Chyba pri načítavaní údajov", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const res = await fetch("/api/admin/discovery-sources", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: "make-com-webhook-secret", id: editingId, updates: formData }),
        });
        if (res.ok) {
          showToast("Zdroj aktualizovaný", "success");
          setEditingId(null);
          setShowAddForm(false);
          setFormData({ source_name: "", feed_url: "", category: "AI", is_active: true });
          fetchData();
        } else {
          showToast("Chyba pri aktualizácii", "error");
        }
      } else {
        const res = await fetch("/api/admin/discovery-sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: "make-com-webhook-secret", source: formData }),
        });
        if (res.ok) {
          showToast("Zdroj pridaný", "success");
          setFormData({ source_name: "", feed_url: "", category: "AI", is_active: true });
          setShowAddForm(false);
          fetchData();
        } else {
          showToast("Chyba pri pridávaní", "error");
        }
      }
    } catch {
      showToast("Chyba pri ukladaní", "error");
    }
  };

  const handleEdit = (source: DiscoverySource) => {
    setEditingId(source.id);
    setFormData({ source_name: source.source_name, feed_url: source.feed_url, category: source.category, is_active: source.is_active });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAddForm(false);
    setFormData({ source_name: "", feed_url: "", category: "AI", is_active: true });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete vymazať tento zdroj?")) return;
    try {
      const res = await fetch(`/api/admin/discovery-sources?id=${id}&secret=make-com-webhook-secret`, { method: "DELETE" });
      if (res.ok) {
        showToast("Zdroj vymazaný", "success");
        fetchData();
      } else {
        showToast("Chyba pri mazaní", "error");
      }
    } catch {
      showToast("Chyba pri mazaní", "error");
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch("/api/admin/discovery-sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: "make-com-webhook-secret", id, updates: { is_active: !currentActive } }),
      });
      if (res.ok) fetchData();
    } catch {
      // silent
    }
  };

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setDiscovering(true);
      const params = new URLSearchParams({
        categories: discoveryForm.categories.join(","),
        count: discoveryForm.count.toString(),
        days: discoveryForm.days.toString(),
        query: discoveryForm.query,
        useRss: discoveryForm.useRss.toString(),
        secret: "make-com-webhook-secret",
      });
      const res = await fetch(`/api/admin/discover-news?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDiscoveryResults(data.found || []);
        showToast(`Nájdené ${(data.found || []).length} článkov`, "success");
      } else {
        showToast("Chyba pri objavovaní", "error");
      }
    } catch {
      showToast("Chyba pri objavovaní", "error");
    } finally {
      setDiscovering(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 500,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff" }}>
      <div style={{ padding: 32 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 40, gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Radio size={20} style={{ color: BLUE }} />
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Zdroje</h1>
            </div>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Spravovanie RSS zdrojov a objavovanie článkov</p>
          </div>
          <button
            onClick={() => { setShowAddForm(!showAddForm); if (editingId) handleCancel(); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 18px", borderRadius: 10,
              background: showAddForm ? "rgba(255,255,255,0.06)" : BLUE_DIM,
              border: `1px solid ${showAddForm ? "rgba(255,255,255,0.1)" : BLUE_BORDER}`,
              color: showAddForm ? "rgba(255,255,255,0.6)" : BLUE,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {showAddForm ? <X size={14} /> : <Plus size={14} />}
            {showAddForm ? "Zrušiť" : "Pridať zdroj"}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          <StatCard label="Celkové zdroje" value={stats.totalSources} icon={Search} accent={BLUE} />
          <StatCard label="Aktívne" value={stats.activeSources} icon={CheckCircle} accent="#22c55e" />
          <StatCard label="Čakajúce správy" value={stats.pendingNews} icon={AlertCircle} accent="#f59e0b" />
          <StatCard label="Spracované" value={stats.processedNews} icon={Zap} accent="#a855f7" />
        </div>

        {/* Add/Edit Form (collapsible) */}
        {showAddForm && (
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, marginBottom: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${BLUE}, transparent)` }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>
              {editingId ? "Upraviť zdroj" : "Pridať nový zdroj"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Meno zdroja</label>
                  <input
                    type="text"
                    value={formData.source_name}
                    onChange={(e) => setFormData({ ...formData, source_name: e.target.value })}
                    style={inputStyle}
                    placeholder="napr. TechCrunch"
                    required
                    onFocus={e => (e.target as HTMLInputElement).style.borderColor = BLUE}
                    onBlur={e => (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Feed URL</label>
                  <input
                    type="url"
                    value={formData.feed_url}
                    onChange={(e) => setFormData({ ...formData, feed_url: e.target.value })}
                    style={inputStyle}
                    placeholder="https://..."
                    required
                    onFocus={e => (e.target as HTMLInputElement).style.borderColor = BLUE}
                    onBlur={e => (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Kategória</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ ...inputStyle, cursor: "pointer" }}
                    onFocus={e => (e.target as HTMLSelectElement).style.borderColor = BLUE}
                    onBlur={e => (e.target as HTMLSelectElement).style.borderColor = "rgba(255,255,255,0.1)"}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, color: "#fff" }}
                  >
                    <div style={{
                      width: 40, height: 22, borderRadius: 11,
                      background: formData.is_active ? "#22c55e" : "rgba(255,255,255,0.1)",
                      position: "relative", transition: "background 0.2s", flexShrink: 0,
                      border: `1px solid ${formData.is_active ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.1)"}`,
                    }}>
                      <div style={{
                        position: "absolute", top: 2,
                        left: formData.is_active ? 20 : 2,
                        width: 16, height: 16, borderRadius: "50%",
                        background: "#fff", transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                      }} />
                    </div>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Aktívny zdroj</span>
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="submit"
                  style={{ padding: "10px 20px", background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}`, borderRadius: 10, color: BLUE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  {editingId ? "Aktualizovať" : "Pridať zdroj"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    style={{ padding: "10px 20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                  >
                    Zrušiť
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Sources Table */}
        <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, marginBottom: 24, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${BLUE}, transparent)` }} />
          <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Rss size={16} style={{ color: BLUE }} />
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>RSS Zdroje</h2>
              <div style={{ marginLeft: 4, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                {sources.length}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Načítavam zdroje...</div>
          ) : sources.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <Rss size={32} style={{ color: "rgba(255,255,255,0.1)", margin: "0 auto 12px" }} />
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Žiadne zdroje. Pridajte prvý zdroj.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Zdroj", "Feed URL", "Kategória", "Stav", "Akcie"].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i === 3 ? "center" : i === 4 ? "right" : "left",
                        padding: "10px 16px",
                        color: "rgba(255,255,255,0.3)",
                        fontWeight: 500, fontSize: 11,
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr
                      key={source.id}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                    >
                      <td style={{ padding: "12px 16px", fontWeight: 500 }}>{source.source_name}</td>
                      <td style={{ padding: "12px 16px", maxWidth: 280 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {source.feed_url.length > 40 ? source.feed_url.substring(0, 40) + "..." : source.feed_url}
                          </span>
                          <a href={source.feed_url} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ ...getCategoryStyle(source.category), borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                          {source.category}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <button
                          onClick={() => handleToggleActive(source.id, source.is_active)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                          title={source.is_active ? "Deaktivovať" : "Aktivovať"}
                        >
                          <div style={{
                            width: 32, height: 18, borderRadius: 9,
                            background: source.is_active ? "#22c55e" : "rgba(255,255,255,0.1)",
                            position: "relative", transition: "background 0.2s",
                            border: `1px solid ${source.is_active ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.08)"}`,
                          }}>
                            <div style={{
                              position: "absolute", top: 2,
                              left: source.is_active ? 14 : 2,
                              width: 12, height: 12, borderRadius: "50%",
                              background: "#fff", transition: "left 0.2s",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                            }} />
                          </div>
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                          <button
                            onClick={() => handleEdit(source)}
                            style={{ padding: "5px 10px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 7, color: BLUE, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <Edit2 size={11} />
                            Upraviť
                          </button>
                          <button
                            onClick={() => handleDelete(source.id)}
                            style={{ padding: "5px 10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, color: "#f87171", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <Trash2 size={11} />
                            Zmazať
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Discovery Section */}
        <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)" }} />

          {/* Header toggle */}
          <button
            onClick={() => setShowDiscovery(!showDiscovery)}
            style={{
              width: "100%", padding: "20px 24px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "none", border: "none", cursor: "pointer", color: "#fff",
              borderBottom: showDiscovery ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={16} style={{ color: "#fbbf24" }} />
              </div>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontSize: 15, fontWeight: 600 }}>Spustiť Objavovanie</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Nájsť nové články z RSS zdrojov</p>
              </div>
            </div>
            {showDiscovery ? <ChevronUp size={16} style={{ color: "rgba(255,255,255,0.4)" }} /> : <ChevronDown size={16} style={{ color: "rgba(255,255,255,0.4)" }} />}
          </button>

          {showDiscovery && (
            <div style={{ padding: 24 }}>
              <form onSubmit={handleDiscover}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                  {/* Categories */}
                  <div>
                    <label style={labelStyle}>Kategórie</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {CATEGORIES.map((cat) => {
                        const active = discoveryForm.categories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              if (active) {
                                setDiscoveryForm({ ...discoveryForm, categories: discoveryForm.categories.filter((c) => c !== cat) });
                              } else {
                                setDiscoveryForm({ ...discoveryForm, categories: [...discoveryForm.categories, cat] });
                              }
                            }}
                            style={{
                              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              background: active ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                              border: active ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.08)",
                              color: active ? BLUE : "rgba(255,255,255,0.4)",
                              transition: "all 0.15s",
                            }}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Days */}
                  <div>
                    <label style={labelStyle}>Časové okno</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[1, 3, 7].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setDiscoveryForm({ ...discoveryForm, days })}
                          style={{
                            flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                            background: discoveryForm.days === days ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                            border: discoveryForm.days === days ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.08)",
                            color: discoveryForm.days === days ? BLUE : "rgba(255,255,255,0.4)",
                            transition: "all 0.15s",
                          }}
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Count */}
                  <div>
                    <label style={labelStyle}>Počet článkov: <span style={{ color: "#fbbf24" }}>{discoveryForm.count}</span></label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="range" min="1" max="15" value={discoveryForm.count}
                        onChange={(e) => setDiscoveryForm({ ...discoveryForm, count: parseInt(e.target.value) })}
                        style={{ width: "100%", accentColor: "#fbbf24" }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>1</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>15</span>
                    </div>
                  </div>

                  {/* Query */}
                  <div>
                    <label style={labelStyle}>Vyhľadávací dotaz (voliteľný)</label>
                    <input
                      type="text" value={discoveryForm.query}
                      onChange={(e) => setDiscoveryForm({ ...discoveryForm, query: e.target.value })}
                      style={inputStyle}
                      placeholder="napr. machine learning, GPT-5..."
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#fbbf24"}
                      onBlur={e => (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.1)"}
                    />
                  </div>
                </div>

                {/* Source type toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <button
                    type="button"
                    onClick={() => setDiscoveryForm({ ...discoveryForm, useRss: !discoveryForm.useRss })}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <div style={{
                      width: 40, height: 22, borderRadius: 11,
                      background: discoveryForm.useRss ? "#fbbf24" : "rgba(255,255,255,0.1)",
                      position: "relative", transition: "background 0.2s",
                    }}>
                      <div style={{
                        position: "absolute", top: 3,
                        left: discoveryForm.useRss ? 20 : 3,
                        width: 16, height: 16, borderRadius: "50%",
                        background: "#fff", transition: "left 0.2s",
                      }} />
                    </div>
                  </button>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>
                      {discoveryForm.useRss ? "RSS Feed" : "Google Search"}
                    </p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                      {discoveryForm.useRss ? "Prehľadáva nakonfigurované RSS zdroje" : "Vyhľadáva cez Google News"}
                    </p>
                  </div>
                  {discoveryForm.useRss ? <Rss size={16} style={{ color: "#fbbf24", marginLeft: "auto" }} /> : <Globe size={16} style={{ color: "rgba(255,255,255,0.3)", marginLeft: "auto" }} />}
                </div>

                <button
                  type="submit"
                  disabled={discovering}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 10,
                    background: discovering ? "rgba(251,191,36,0.05)" : "rgba(251,191,36,0.12)",
                    border: "1px solid rgba(251,191,36,0.3)",
                    color: discovering ? "rgba(251,191,36,0.4)" : "#fbbf24",
                    fontSize: 13, fontWeight: 700, cursor: discovering ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.2s",
                  }}
                >
                  {discovering ? (
                    <>
                      <div style={{ width: 14, height: 14, border: "2px solid rgba(251,191,36,0.3)", borderTopColor: "#fbbf24", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      Objavovanie prebieha...
                    </>
                  ) : (
                    <>
                      <Search size={14} />
                      Spustiť Objavovanie
                    </>
                  )}
                </button>
              </form>

              {/* Discovery Results */}
              {discoveryResults.length > 0 && (
                <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <CheckCircle size={15} style={{ color: "#22c55e" }} />
                    <h4 style={{ fontSize: 14, fontWeight: 600 }}>Nájdených {discoveryResults.length} článkov</h4>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                    {discoveryResults.map((item, idx) => (
                      <div
                        key={idx}
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}
                      >
                        <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || "Bez názvu"}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{item.source || "Neznámy zdroj"}</span>
                          {item.category && (
                            <span style={{ ...getCategoryStyle(item.category), borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>{item.category}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast toast={toast} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
