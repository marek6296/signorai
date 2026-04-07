"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Article } from "@/lib/data";
import { ArrowLeft, Sparkles, Loader2, Copy, Check, FileText, Wand2, Image as ImageIcon, Plus, Search, X } from "lucide-react";
import { useAdmin } from "@/app/admin/_context/AdminContext";

interface Props {
    params: { id: string };
}

// ── Reusable Image Generator Panel ─────────────────────────────────────────
function ImageGenerator({
    title,
    excerpt,
    label = "Obrázok",
    onGenerated,
}: {
    title: string;
    excerpt: string;
    label?: string;
    onGenerated: (url: string) => void;
}) {
    const [mode, setMode] = useState<"content" | "prompt">("content");
    const [customPrompt, setCustomPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const generate = async () => {
        if (mode === "content" && (!title || !excerpt)) {
            setError("Pre generovanie z obsahu je potrebný Nadpis a Perex.");
            return;
        }
        if (mode === "prompt" && !customPrompt.trim()) {
            setError("Zadaj prompt pre generovanie obrázka.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const body =
                mode === "prompt"
                    ? { customPrompt: customPrompt.trim() }
                    : { title, excerpt };

            const res = await fetch("/api/admin/article-image-generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Generovanie zlyhalo");
            if (data.imageUrl) onGenerated(data.imageUrl);
        } catch (e: any) {
            setError(e.message || "Chyba pri generovaní");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-2xl border border-border/50 bg-muted/10 overflow-hidden">
            {/* Mode tabs */}
            <div className="flex border-b border-border/40">
                <button
                    type="button"
                    onClick={() => setMode("content")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                        mode === "content"
                            ? "bg-primary/10 text-primary border-b-2 border-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                >
                    <FileText className="w-3.5 h-3.5" />
                    Z obsahu článku
                </button>
                <button
                    type="button"
                    onClick={() => setMode("prompt")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                        mode === "prompt"
                            ? "bg-primary/10 text-primary border-b-2 border-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                >
                    <Wand2 className="w-3.5 h-3.5" />
                    Vlastný prompt
                </button>
            </div>

            <div className="p-4 space-y-3">
                {mode === "content" && (
                    <p className="text-xs text-muted-foreground">
                        AI vygeneruje obrázok automaticky podľa nadpisu a perexu článku.
                    </p>
                )}

                {mode === "prompt" && (
                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        rows={3}
                        placeholder="Napr: A futuristic robot hand shaking a human hand, cinematic lighting, dark background, photorealistic..."
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/40"
                    />
                )}

                {error && (
                    <p className="text-xs text-red-500 font-medium">{error}</p>
                )}

                <button
                    type="button"
                    onClick={generate}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    {loading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Generujem {label}...</>
                    ) : (
                        <><Sparkles className="w-4 h-4" /> Generovať {label} cez AI</>
                    )}
                </button>

                {loading && (
                    <p className="text-[10px] text-center text-muted-foreground animate-pulse">
                        Generovanie môže trvať 15–30 sekúnd...
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Image Picker Modal ──────────────────────────────────────────────────────
function ImagePickerModal({
    query,
    onSelect,
    onClose,
}: {
    query: string;
    onSelect: (url: string) => void;
    onClose: () => void;
}) {
    const [images, setImages] = useState<{ url: string; title: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState(query);
    const [selected, setSelected] = useState<string | null>(null);

    const search = async (q: string) => {
        if (!q.trim()) return;
        setLoading(true);
        setError("");
        setImages([]);
        setSelected(null);
        try {
            const res = await fetch("/api/admin/search-images", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: q }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Chyba vyhľadávania");
            setImages((data.images || []).slice(0, 6));
        } catch (e: any) {
            setError(e.message || "Chyba pri vyhľadávaní obrázkov");
        } finally {
            setLoading(false);
        }
    };

    // Auto-search on mount
    useEffect(() => { search(query); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                    <h3 className="text-sm font-black uppercase tracking-widest">Nájsť obrázok</h3>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Search bar */}
                <div className="px-5 py-3 border-b border-border/40 flex gap-2">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && search(searchTerm)}
                        placeholder="Hľadaj obrázok..."
                        className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                        type="button"
                        onClick={() => search(searchTerm)}
                        disabled={loading}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        Hľadať
                    </button>
                </div>

                {/* Image grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Vyhľadávam obrázky...</p>
                        </div>
                    )}
                    {error && !loading && (
                        <p className="text-center text-sm text-red-500 py-8">{error}</p>
                    )}
                    {!loading && !error && images.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-8">Žiadne výsledky</p>
                    )}
                    {!loading && images.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {images.map((img, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setSelected(img.url)}
                                    className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all ${
                                        selected === img.url
                                            ? "border-primary ring-2 ring-primary/40"
                                            : "border-border/50 hover:border-primary/40"
                                    }`}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={img.url}
                                        alt={img.title}
                                        className="w-full h-full object-cover"
                                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                    {selected === img.url && (
                                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                                <Check className="w-4 h-4 text-primary-foreground" />
                                            </div>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-border/60 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-border text-sm font-bold hover:bg-muted/30 transition-colors"
                    >
                        Zrušiť
                    </button>
                    <button
                        type="button"
                        disabled={!selected}
                        onClick={() => { if (selected) { onSelect(selected); onClose(); } }}
                        className="flex-1 bg-primary text-primary-foreground rounded-xl text-sm font-black uppercase tracking-wider py-2.5 hover:opacity-90 disabled:opacity-40 transition-all"
                    >
                        Použiť vybraný obrázok
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Inline Image Section ────────────────────────────────────────────────────
function InlineImageGenerator({
    title,
    excerpt,
    content,
    onInsert,
}: {
    title: string;
    excerpt: string;
    content: string;
    onInsert: (html: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const [caption, setCaption] = useState("");
    const [copied, setCopied] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [showGen, setShowGen] = useState(false);

    const htmlSnippet = imageUrl
        ? `<figure class="my-8 mx-auto max-w-2xl">
  <img src="${imageUrl}" alt="${caption || "Obrázok"}" class="w-full rounded-2xl shadow-lg" />
  ${caption ? `<figcaption class="text-center text-sm text-muted-foreground mt-3">${caption}</figcaption>` : ""}
</figure>`
        : "";

    const copySnippet = async () => {
        if (!htmlSnippet) return;
        await navigator.clipboard.writeText(htmlSnippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const insertIntoContent = () => {
        if (!htmlSnippet) return;
        onInsert(htmlSnippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="rounded-2xl border border-dashed border-border/60 overflow-hidden">
            {/* Toggle header */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/20 transition-colors"
            >
                <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1 text-left">
                    <p className="text-sm font-black uppercase tracking-wider">Obrázok do textu</p>
                    <p className="text-xs text-muted-foreground">Voliteľné — vygeneruj obrázok na vloženie medzi odseky</p>
                </div>
                <Plus
                    className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
                        open ? "rotate-45" : "rotate-0"
                    }`}
                />
            </button>

            {open && (
                <div className="px-5 pb-5 space-y-4 border-t border-border/40 pt-4">
                    {/* Picker / Generator toggle buttons */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => { setShowPicker(true); setShowGen(false); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                        >
                            <Search className="w-3 h-3" />
                            Nájsť obrázok
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowGen(!showGen); setShowPicker(false); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                showGen
                                    ? "bg-primary/15 text-primary border border-primary/30"
                                    : "border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                            }`}
                        >
                            <Sparkles className="w-3 h-3" />
                            AI Generovať
                        </button>
                    </div>

                    {showGen && (
                        <ImageGenerator
                            title={title}
                            excerpt={excerpt}
                            label="obrázok do textu"
                            onGenerated={(url) => { setImageUrl(url); setShowGen(false); }}
                        />
                    )}

                    {showPicker && (
                        <ImagePickerModal
                            query={title || "technology AI"}
                            onSelect={(url) => { setImageUrl(url); }}
                            onClose={() => setShowPicker(false)}
                        />
                    )}

                    {imageUrl && (
                        <div className="space-y-3">
                            {/* Preview */}
                            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/50 bg-muted/20">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={imageUrl} alt="Inline preview" className="object-cover w-full h-full" />
                            </div>

                            {/* Caption input */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
                                    Popis obrázka (voliteľné)
                                </label>
                                <input
                                    type="text"
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    placeholder="Napr: Vizualizácia novej AI architektúry"
                                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            {/* HTML snippet preview */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
                                    HTML kód na vloženie
                                </label>
                                <pre className="bg-muted/40 rounded-xl px-4 py-3 text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all border border-border/40">
                                    {htmlSnippet}
                                </pre>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={copySnippet}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border border-border hover:bg-muted/30 transition-all"
                                >
                                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copied ? "Skopírované!" : "Kopírovať HTML"}
                                </button>
                                <button
                                    type="button"
                                    onClick={insertIntoContent}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Vložiť na koniec obsahu
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Edit Page ──────────────────────────────────────────────────────────
export default function EditArticlePage({ params }: Props) {
    const router = useRouter();
    const { isLoggedIn, isHydrated } = useAdmin();

    // Form state
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [excerpt, setExcerpt] = useState("");
    const [content, setContent] = useState("");
    const [category, setCategory] = useState("");
    const [aiSummary, setAiSummary] = useState("");
    const [mainImage, setMainImage] = useState("");
    const [showImageGen, setShowImageGen] = useState(false);
    const [showImagePicker, setShowImagePicker] = useState(false);

    const [status, setStatus] = useState<"loading" | "idle" | "saving" | "success" | "error">("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!isHydrated) return;
        if (!isLoggedIn) {
            router.push("/admin");
            return;
        }

        const fetchArticle = async () => {
            const { data, error } = await supabase
                .from("articles")
                .select("*")
                .eq("id", params.id)
                .single();

            if (error || !data) {
                setStatus("error");
                setMessage("Nepodarilo sa načítať článok: " + (error?.message || "Neznáma chyba"));
                return;
            }

            const article: Article = data;
            setTitle(article.title || "");
            setSlug(article.slug || "");
            setExcerpt(article.excerpt || "");
            setContent(article.content || "");
            setCategory(article.category || "");
            setAiSummary(article.ai_summary || "");
            setMainImage(article.main_image || "");
            setStatus("idle");
        };

        fetchArticle();
    }, [params.id, router, isLoggedIn, isHydrated]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("saving");
        setMessage("");

        const { error } = await supabase
            .from("articles")
            .update({ title, slug, excerpt, content, category, ai_summary: aiSummary, main_image: mainImage })
            .eq("id", params.id);

        if (error) {
            setStatus("error");
            setMessage("Chyba pri ukladaní: " + error.message);
        } else {
            setStatus("success");
            setMessage("Článok uložený. Zmeny by mali byť na webe hneď.");
            await fetch("/api/revalidate?secret=make-com-webhook-secret", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug }),
            });
            setTimeout(() => setStatus("idle"), 4000);
        }
    };

    if (!isHydrated || !isLoggedIn) return null;

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl flex-grow">
            {/* Back + header */}
            <div className="mb-5">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Späť
                </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h1 className="text-2xl sm:text-3xl font-black">Úprava článku</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <a
                        href={`/article/${slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 text-sm font-bold rounded-lg border border-border hover:bg-muted transition-colors flex items-center justify-center text-primary"
                    >
                        Náhľad na webe
                    </a>
                    <Link
                        href="/admin/clanky"
                        className="px-4 py-2 text-sm font-bold rounded-lg border border-border hover:bg-muted transition-colors flex items-center justify-center"
                    >
                        Späť na Články
                    </Link>
                </div>
            </div>

            {status === "loading" ? (
                <div className="bg-card border rounded-2xl p-8 shadow-sm text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                    <p className="text-muted-foreground">Načítavam článok...</p>
                </div>
            ) : (
                <form onSubmit={handleSave} className="space-y-5">
                    {/* Status message */}
                    {message && (
                        <div className={`p-4 rounded-2xl font-medium text-center text-sm ${
                            status === "error"
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                : "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                        }`}>
                            {message}
                        </div>
                    )}

                    {/* Title */}
                    <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                        <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground">Nadpis</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-background border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                            required
                        />
                    </div>

                    {/* Category + Slug */}
                    <div className="bg-card border rounded-2xl p-5 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground">Kategória</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full bg-background border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                                    required
                                >
                                    <option value="AI">AI</option>
                                    <option value="Tech">Tech</option>
                                    <option value="Návody & Tipy">Návody & Tipy</option>
                                    <option value="Newsletter">Newsletter</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground">URL Slug</label>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    className="w-full bg-background border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-muted-foreground"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Main Image */}
                    <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Hlavný Obrázok</label>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Find image button */}
                                <button
                                    type="button"
                                    onClick={() => { setShowImagePicker(true); setShowImageGen(false); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                                >
                                    <Search className="w-3 h-3" />
                                    Nájsť obrázok
                                </button>
                                {/* AI generate button */}
                                <button
                                    type="button"
                                    onClick={() => { setShowImageGen(!showImageGen); setShowImagePicker(false); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                        showImageGen
                                            ? "bg-primary/15 text-primary border border-primary/30"
                                            : "border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                                    }`}
                                >
                                    <Sparkles className="w-3 h-3" />
                                    AI Generovať
                                </button>
                            </div>
                        </div>

                        {/* Image preview */}
                        {mainImage && (
                            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/50 bg-muted/20">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={mainImage} alt="Hlavný obrázok" className="object-cover w-full h-full" />
                            </div>
                        )}

                        {/* URL input */}
                        <input
                            type="url"
                            value={mainImage}
                            onChange={(e) => setMainImage(e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-background border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                            required
                        />

                        {/* AI Generator panel — collapsible */}
                        {showImageGen && (
                            <ImageGenerator
                                title={title}
                                excerpt={excerpt}
                                label="hlavný obrázok"
                                onGenerated={(url) => {
                                    setMainImage(url);
                                    setShowImageGen(false);
                                }}
                            />
                        )}
                    </div>

                    {/* Image Picker Modal */}
                    {showImagePicker && (
                        <ImagePickerModal
                            query={title || "technology news"}
                            onSelect={(url) => { setMainImage(url); }}
                            onClose={() => setShowImagePicker(false)}
                        />
                    )}

                    {/* Perex */}
                    <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-2">
                        <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground">Perex (úvodný text)</label>
                        <textarea
                            value={excerpt}
                            onChange={(e) => setExcerpt(e.target.value)}
                            rows={3}
                            className="w-full bg-background border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary resize-y text-sm"
                            required
                        />
                    </div>

                    {/* AI Summary */}
                    <div className="bg-card border border-primary/20 rounded-2xl p-5 shadow-sm space-y-2">
                        <label className="block text-xs font-black uppercase tracking-widest text-primary/70">Zhrnutie od AI</label>
                        <textarea
                            value={aiSummary}
                            onChange={(e) => setAiSummary(e.target.value)}
                            rows={2}
                            className="w-full bg-background border border-primary/20 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary resize-y text-sm"
                        />
                    </div>

                    {/* Content */}
                    <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-2">
                        <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Kompletný Obsah (HTML)
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={18}
                            className="w-full bg-background border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm resize-y"
                            required
                        />
                    </div>

                    {/* ── Inline Image Generator ── */}
                    <InlineImageGenerator
                        title={title}
                        excerpt={excerpt}
                        content={content}
                        onInsert={(html) =>
                            setContent((prev) => prev + "\n\n" + html)
                        }
                    />

                    {/* Save bar */}
                    <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/40 z-10 -mx-4 px-4 py-3 flex flex-col sm:flex-row gap-3 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-border font-bold hover:bg-muted transition-colors text-sm shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Späť
                        </button>
                        <button
                            type="submit"
                            disabled={status === "saving"}
                            className="flex-1 bg-primary text-primary-foreground font-black text-sm rounded-xl px-4 py-3.5 transition-colors hover:bg-primary/90 disabled:opacity-50 uppercase tracking-wider"
                        >
                            {status === "saving" ? "Ukladám zmeny..." : "Uložiť zmeny v článku"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
