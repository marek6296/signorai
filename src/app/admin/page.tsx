"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { Article } from "@/lib/data";
import Link from "next/link";
import { Edit, ArrowDown, Trash2, Sparkles, Plus, Globe, Search, CheckCircle2, XCircle, RefreshCw, Zap, Play, History, RotateCcw, BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArticleCard } from "@/components/ArticleCard";
import Image from "next/image";

type SuggestedNews = {
    id: string;
    url: string;
    title: string;
    summary: string;
    source: string;
    category?: string;
    status: 'pending' | 'processed' | 'ignored';
    created_at: string;
};

type AutopilotHistoryItem = {
    title: string;
    url: string;
    category: string;
    created_at: string;
};

type AutopilotSettings = {
    enabled: boolean;
    last_run: string | null;
    processed_count: number;
};

export default function AdminPage() {
    const [url, setUrl] = useState("");
    const [synthesisUrls, setSynthesisUrls] = useState<string[]>([""]);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [articles, setArticles] = useState<Article[]>([]);
    const [suggestions, setSuggestions] = useState<SuggestedNews[]>([]);
    const [loadingArticles, setLoadingArticles] = useState(true);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [autopilotSettings, setAutopilotSettings] = useState<AutopilotSettings>({ enabled: false, last_run: null, processed_count: 0 });
    const [analytics, setAnalytics] = useState<{ totalVisits: number, topPages: { path: string, count: number }[], recentVisits: { path: string, created_at: string, referrer: string | null }[] }>({ totalVisits: 0, topPages: [], recentVisits: [] });
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    // Tab control
    const [activeTab, setActiveTab] = useState<"create" | "manage" | "discovery" | "analytics">("manage");

    // Authentication state
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [selectedDiscoveryCategory, setSelectedDiscoveryCategory] = useState("Všetky");
    const [selectedPublishedCategory, setSelectedPublishedCategory] = useState("Všetky");
    const [discoveryDays, setDiscoveryDays] = useState("3");
    const [discoveryTargetCategories, setDiscoveryTargetCategories] = useState<string[]>([]);

    // Discovery Loading Modal states
    const [isDiscoveringModalOpen, setIsDiscoveringModalOpen] = useState(false);
    const [discoveryStage, setDiscoveryStage] = useState("Inicializácia umelej inteligencie...");

    // Generating Loading Modal states
    const [isGeneratingModalOpen, setIsGeneratingModalOpen] = useState(false);
    const [generatingStage, setGeneratingStage] = useState("Inicializácia AI modelov...");

    // Autopilot Loading Modal states
    const [isAutopilotLoadingModalOpen, setIsAutopilotLoadingModalOpen] = useState(false);
    const [autopilotLoadingStage, setAutopilotLoadingStage] = useState("Inicializácia Autopilota...");

    const [isAutopilotHistoryOpen, setIsAutopilotHistoryOpen] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [autopilotHistory, setAutopilotHistory] = useState<AutopilotHistoryItem[]>([]);

    const [isBulkCategoryMode, setIsBulkCategoryMode] = useState(false);
    const [bulkSelectedArticles, setBulkSelectedArticles] = useState<string[]>([]);
    const [refreshingType, setRefreshingType] = useState<"none" | "bulk" | "recent" | "all">("none");

    const fetchArticles = async () => {
        setLoadingArticles(true);
        const { data, error } = await supabase
            .from("articles")
            .select("*")
            .order("published_at", { ascending: false });

        if (!error && data) {
            setArticles(data);
        }
        setLoadingArticles(false);
    };

    const fetchSuggestions = async () => {
        setLoadingSuggestions(true);
        const { data, error } = await supabase
            .from("suggested_news")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: false });

        if (!error && data) {
            setSuggestions(data);
        }
        setLoadingSuggestions(false);
    };

    const fetchAutopilotSettings = async () => {
        const { data, error } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'auto_pilot')
            .single();

        if (!error && data) {
            setAutopilotSettings(data.value as AutopilotSettings);
        }
    };

    const fetchAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            const { count: totalCount } = await supabase
                .from('site_visits')
                .select('*', { count: 'exact', head: true });

            const { data: pageData } = await supabase
                .from('site_visits')
                .select('path');

            const counts: Record<string, number> = {};
            pageData?.forEach(v => {
                counts[v.path] = (counts[v.path] || 0) + 1;
            });
            const topPages = Object.entries(counts)
                .map(([path, count]) => ({ path, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            const { data: recentVisits } = await supabase
                .from('site_visits')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            setAnalytics({
                totalVisits: totalCount || 0,
                topPages,
                recentVisits: recentVisits || []
            });
        } catch (err) {
            console.error("Analytics fetch error:", err);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            const loggedInUser = localStorage.getItem("admin_logged_in");
            if (loggedInUser === "true") {
                setIsLoggedIn(true);
                fetchArticles();
                fetchSuggestions();
                fetchAutopilotSettings();
                fetchAnalytics();
            }
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsAutopilotHistoryOpen(false);
                setIsDiscoveringModalOpen(false);
                setIsGeneratingModalOpen(false);
                setIsAutopilotLoadingModalOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError("");

        if (email === "cmelo.marek@gmail.com" && password === "Marek6296") {
            setIsLoggedIn(true);
            localStorage.setItem("admin_logged_in", "true");
            window.dispatchEvent(new Event('storage'));
            fetchArticles();
            fetchSuggestions();
        } else {
            setLoginError("Nesprávny e-mail alebo heslo");
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        localStorage.removeItem("admin_logged_in");
        window.dispatchEvent(new Event('storage'));
        setArticles([]);
    };

    const handleSynthesis = async (e: React.FormEvent) => {
        e.preventDefault();
        const validUrls = synthesisUrls.filter(u => u.trim());
        if (validUrls.length === 0) return;

        setStatus("loading");
        setIsGeneratingModalOpen(true);
        setGeneratingStage("Príprava Synthesis Studia...");

        const stages = [
            "Sťahujem dáta z URL adries...",
            "Analyzujem texty zdrojov...",
            "Porovnávam fakty z viacerých zdrojov...",
            "OpenAI navrhuje najlepší nadpis...",
            "Generujem pútavý slovenský článok...",
            "Sťahujem a optimalizujem obrázky...",
            "Dokončujem ukladanie článku..."
        ];

        let stageIdx = 0;
        const interval = setInterval(() => {
            stageIdx = (stageIdx + 1) % stages.length;
            setGeneratingStage(stages[stageIdx]);
        }, 4000);

        try {
            const res = await fetch("/api/admin/generate-article-multi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: validUrls, secret: "make-com-webhook-secret" })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Nepodarilo sa vykonať syntézu");
            setStatus("success");
            setMessage(`Úspech! Syntéza "${data.article?.title}" bola uložená ako DRAFT.`);
            setSynthesisUrls([""]);
            fetchArticles();
            setActiveTab("manage");
        } catch (error: unknown) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Chyba pri syntéze");
        } finally {
            clearInterval(interval);
            setIsGeneratingModalOpen(false);
        }
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setStatus("loading");
        setIsGeneratingModalOpen(true);
        setGeneratingStage("Sťahovanie zdrojového článku...");

        const stages = [
            "Analyzujem obsah pomocou AI...",
            "Prekladám do profesionálnej slovenčiny...",
            "Ladím štýl a formátovanie článku...",
            "Sťahujem a optimalizujem obrázky...",
            "Finálne úpravy a ukladanie..."
        ];

        let stageIdx = 0;
        const interval = setInterval(() => {
            stageIdx = (stageIdx + 1) % stages.length;
            setGeneratingStage(stages[stageIdx]);
        }, 3500);

        try {
            const res = await fetch("/api/admin/generate-article", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, secret: "make-com-webhook-secret" })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Nepodarilo sa vygenerovať článok");
            setStatus("success");
            setMessage(`Úspech! Článok "${data.article?.title}" bol prijatý ako DRAFT.`);
            setUrl("");
            fetchArticles();
            setActiveTab("manage");
        } catch (error: unknown) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Chyba pri generovaní");
        } finally {
            clearInterval(interval);
            setIsGeneratingModalOpen(false);
        }
    };

    const handlePublish = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === "published" ? "draft" : "published";
        const { error } = await supabase.from("articles").update({ status: newStatus }).eq("id", id);
        if (!error) {
            fetchArticles();
            await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
        } else {
            alert("Chyba pri zmene statusu: " + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Naozaj vymazať článok?")) return;
        const { error } = await supabase.from("articles").delete().eq("id", id);
        if (!error) {
            fetchArticles();
            await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
        } else {
            alert("Chyba pri mazaní: " + error.message);
        }
    };

    const toggleBulkSelection = (id: string) => {
        setBulkSelectedArticles(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const handleRefreshCategories = async () => {
        if (bulkSelectedArticles.length === 0) return;
        setRefreshingType("bulk");
        setStatus("loading");
        try {
            const response = await fetch("/api/admin/refresh-categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: 'make-com-webhook-secret',
                    articleIds: bulkSelectedArticles
                })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                setIsBulkCategoryMode(false);
                setBulkSelectedArticles([]);
                fetchArticles();
                await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
            } else {
                alert("Chyba: " + data.message);
            }
        } catch (e: unknown) {
            const error = e as Error;
            alert("API chyba: " + error.message);
        } finally {
            setRefreshingType("none");
            setStatus("idle");
        }
    };

    const handleRefreshRecentCategories = async () => {
        const recentIds = articles
            .filter(a => a.status === 'published')
            .slice(0, 20)
            .map(a => a.id);

        if (recentIds.length === 0) {
            alert("Nájdených 0 článkov na opravu.");
            return;
        }

        if (!confirm(`AI teraz preanalyzuje a opraví kategórie pre ${recentIds.length} posledných článkov. Pokračovať?`)) return;

        setRefreshingType("recent");
        setStatus("loading");
        try {
            const response = await fetch("/api/admin/refresh-categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: 'make-com-webhook-secret',
                    articleIds: recentIds
                })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                fetchArticles();
                await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
            } else {
                alert("Chyba: " + data.message);
            }
        } catch (e: unknown) {
            const error = e as Error;
            alert("API chyba: " + error.message);
        } finally {
            setRefreshingType("none");
            setStatus("idle");
        }
    };

    const handleRefreshAllCategories = async () => {
        const allIds = articles
            .filter(a => a.status === 'published')
            .map(a => a.id);

        if (allIds.length === 0) {
            alert("Nájdených 0 článkov na opravu.");
            return;
        }

        if (!confirm(`POZOR: AI teraz preanalyzuje a opraví kategórie pre VŠETKÝCH ${allIds.length} článkov v databáze. Toto môže trvať dlhšie. Pokračovať?`)) return;

        setRefreshingType("all");
        setStatus("loading");
        try {
            const response = await fetch("/api/admin/refresh-categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: 'make-com-webhook-secret',
                    articleIds: allIds
                })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                fetchArticles();
                await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
            } else {
                alert("Chyba: " + data.message);
            }
        } catch (e: unknown) {
            const error = e as Error;
            alert("API chyba: " + error.message);
        } finally {
            setRefreshingType("none");
            setStatus("idle");
        }
    };

    const handleDiscoverNews = async () => {
        setStatus("loading");
        setIsDiscoveringModalOpen(true);
        setDiscoveryStage("Pripájam sa na zdroje dát...");

        const stages = [
            "Pripájam sa na zdroje dát...",
            "Prehľadávam najlepšie technologické weby a RSS kanály...",
            "Sťahujem stovky najnovších článkov z posledných dní...",
            "AI asistent analyzuje titulky a porovnáva obsah...",
            "Oddeľuje absolútne klenoty od zbytočného šumu...",
            "Extrahuje kľúčové informácie a obohacuje detaily...",
            "Pripravujem konečný zoznam tých najlepších tém...",
            "Čakám na finálnu odpoveď od OpenAI serverov..."
        ];

        let currentStageIdx = 0;
        const progressInterval = setInterval(() => {
            currentStageIdx = (currentStageIdx + 1) % stages.length;
            setDiscoveryStage(stages[currentStageIdx]);
        }, 4000);

        try {
            const params = new URLSearchParams({
                secret: "make-com-webhook-secret",
                days: discoveryDays,
            });
            if (discoveryTargetCategories.length > 0) {
                params.append("categories", discoveryTargetCategories.join(","));
            }
            const res = await fetch(`/api/admin/discover-news?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setStatus("success");
            setMessage(data.message || "Boli objavené nové témy!");
            fetchSuggestions();
        } catch (error: unknown) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Chyba pri objavovaní správ");
        } finally {
            clearInterval(progressInterval);
            setIsDiscoveringModalOpen(false);
        }
    };

    const handleIgnoreSuggestion = async (id: string) => {
        const { error } = await supabase.from("suggested_news").update({ status: 'ignored' }).eq("id", id);
        if (!error) fetchSuggestions();
    };

    const handleClearAllSuggestions = async () => {
        if (!confirm("Naozaj chcete zmazať VŠETKY navrhované témy? Táto akcia je nevratná.")) return;

        setStatus("loading");
        setMessage("Mažem všetky návrhy...");

        const { error } = await supabase
            .from("suggested_news")
            .update({ status: 'ignored' })
            .eq("status", "pending");

        if (!error) {
            setStatus("success");
            setMessage("Všetky návrhy boli odstránené.");
            fetchSuggestions();
        } else {
            setStatus("error");
            setMessage("Chyba pri mazaní: " + error.message);
        }
    };

    const handleProcessSuggestion = async (suggestion: SuggestedNews) => {
        setActiveTab("create");
        setUrl(suggestion.url);
        await supabase.from("suggested_news").update({ status: 'processed' }).eq("id", suggestion.id);
        fetchSuggestions();
    };

    const executeAutopilotRun = async () => {
        setStatus("loading");
        setIsAutopilotLoadingModalOpen(true);
        setAutopilotLoadingStage("Štartujem Autopilota: Príprava zdrojov...");

        const stages = [
            "Analyzujem navrhované témy...",
            "Vyberám najlepšie správy z kategórií...",
            "Paralelné generovanie článkov (môže trvať 30-60s)...",
            "Prekladám do profesionálnej slovenčiny...",
            "Sťahujem a optimalizujem obrázky...",
            "Publikujem články na portál...",
            "Aktualizujem štatistiky Autopilota..."
        ];

        let stageIdx = 0;
        const interval = setInterval(() => {
            stageIdx = (stageIdx + 1) % stages.length;
            setAutopilotLoadingStage(stages[stageIdx]);
        }, 5000);

        try {
            console.log(">>> [UI] Starting Manual Autopilot Run...");
            const res = await fetch("/api/admin/auto-pilot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secret: "make-com-webhook-secret", mode: 'manual' })
            });

            const data = await res.json();
            console.log(">>> [UI] Autopilot Response:", data);
            if (!res.ok) throw new Error(data.message);

            setStatus("success");
            setMessage(data.message);
            fetchSuggestions();
            fetchArticles();
            fetchAutopilotSettings();
        } catch (error: unknown) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Chyba Autopilota");
        } finally {
            clearInterval(interval);
            setIsAutopilotLoadingModalOpen(false);
        }
    };

    const handleToggleAutopilot = async () => {
        const newState = !autopilotSettings.enabled;
        const newSettings = { ...autopilotSettings, enabled: newState };

        setAutopilotSettings(newSettings);
        const { error } = await supabase
            .from('site_settings')
            .update({ value: newSettings })
            .eq('key', 'auto_pilot');

        if (!error) {
            setStatus("success");
            setMessage(newState ? "Autopilot bol zapnutý. Odteraz bude automaticky spracovávať novinky." : "Autopilot bol vypnutý.");

            if (newState) {
                if (confirm("Autopilot je aktivovaný! Chcete ho teraz spustiť, aby hneď vyhľadal a publikoval najnovšie správy? (Potom bude pokračovať automaticky každých 24h)")) {
                    await executeAutopilotRun();
                }
            }

            fetchAutopilotSettings();
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
        }
    };

    const handleRunAutopilotNow = async () => {
        if (confirm("Spustiť AI Autopilota teraz? Spracuje jeden článok z každej kategórie a publikuje ich.")) {
            await executeAutopilotRun();
        }
    };

    const handleOpenAutopilotHistory = async () => {
        setIsAutopilotHistoryOpen(true);
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('suggested_news')
                .select('title, url, category, created_at')
                .eq('status', 'processed')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching autopilot history:", error);
                throw error;
            }

            console.log("Fetched autopilot history items:", data?.length, data);
            setAutopilotHistory(data || []);
        } catch (err) {
            console.error("Autopilot history catch:", err);
            // Fallback to empty to at least show the modal
            setAutopilotHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleResetAutopilotCount = async () => {
        if (!confirm("Vynulovať počítadlo spracovaných článkov?")) return;
        const newSettings = { ...autopilotSettings, processed_count: 0 };
        setAutopilotSettings(newSettings);
        await supabase
            .from('site_settings')
            .update({ value: newSettings })
            .eq('key', 'auto_pilot');
    };

    if (!isLoggedIn) {
        return (
            <div className="container mx-auto px-4 py-20 max-w-md flex-grow">
                <div className="bg-card border rounded-2xl p-8 shadow-sm">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-black mb-2 uppercase tracking-widest">Postovinky</h1>
                        <p className="text-muted-foreground">Len pre autorizovaných redaktorov</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-foreground/70">E-mail</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-foreground/70">Heslo</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary" required />
                        </div>
                        {loginError && <div className="p-3 rounded-lg bg-red-500/10 text-red-600 text-sm font-medium text-center">{loginError}</div>}
                        <button type="submit" className="w-full bg-primary text-primary-foreground font-bold rounded-lg px-4 py-4 mt-4 transition-colors hover:bg-primary/90">Prihlásiť sa do redakcie</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="container mx-auto px-4 py-12 max-w-5xl flex-grow">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-12 bg-card border p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm ring-1 ring-border/50">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black mb-1 md:mb-2 uppercase tracking-tight">Redakčný Systém</h1>
                        <p className="text-sm md:text-base text-muted-foreground font-medium">Správa obsahu a generovanie noviniek pomocou AI</p>
                    </div>
                    <button onClick={handleLogout} className="text-[10px] md:text-sm font-black text-muted-foreground hover:text-red-500 uppercase tracking-widest transition-colors flex items-center gap-2 w-fit">
                        Odhlásiť sa <XCircle className="w-4 h-4" />
                    </button>
                </div>

                {/* Premium Admin Tabs */}
                <div className="flex items-center justify-center mb-10 md:mb-12">
                    <div className="flex w-full md:w-fit p-1 md:p-1.5 bg-muted/30 rounded-2xl md:rounded-[28px] border border-border/40 backdrop-blur-md shadow-inner overflow-x-auto no-scrollbar">
                        {[
                            { id: "discovery", label: "Discovery", icon: Search, badge: suggestions.length },
                            { id: "create", label: "Tvorba", icon: Sparkles },
                            { id: "manage", label: "Správa", icon: Edit },
                            { id: "analytics", label: "Navštevnosť", icon: BarChart3 }
                        ].map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as "create" | "manage" | "discovery")}
                                    className={cn(
                                        "relative flex-1 md:flex-none px-4 md:px-10 py-3 md:py-4 flex items-center justify-center gap-2 md:gap-3 rounded-xl md:rounded-[22px] font-black text-[10px] md:text-xs uppercase tracking-[0.1em] transition-all duration-500 overflow-hidden group min-w-fit",
                                        isActive
                                            ? "bg-foreground text-background shadow-lg md:shadow-2xl md:scale-[1.05] z-10 shadow-black/20"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    )}
                                >
                                    <tab.icon className={cn("w-3.5 h-3.5 md:w-4 h-4 transition-transform duration-500", isActive && "scale-110")} />
                                    <span className="whitespace-nowrap">{tab.label}</span>

                                    {tab.badge !== undefined && tab.badge > 0 && (
                                        <span className={cn(
                                            "ml-1 text-[8px] md:text-[9px] px-1.5 md:px-2 py-0.5 rounded-full font-black",
                                            isActive ? "bg-background text-foreground" : "bg-primary text-primary-foreground"
                                        )}>
                                            {tab.badge}
                                        </span>
                                    )}

                                    {/* Hover Glow */}
                                    {!isActive && (
                                        <span className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* CREATE TAB */}
                {activeTab === "create" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-card border rounded-[40px] p-10 shadow-sm flex flex-col relative overflow-hidden h-full ring-1 ring-border/50">
                            <div className="h-[200px] flex flex-col">
                                <div className="bg-primary/10 text-primary p-4 rounded-2xl w-fit mb-6">
                                    <Sparkles className="w-8 h-8" />
                                </div>
                                <h2 className="text-3xl font-black uppercase tracking-tight mb-3">Synthesis Studio</h2>
                                <p className="text-muted-foreground text-sm font-medium leading-relaxed">Syntéza viacerých zdrojov do jedného článku.</p>
                            </div>
                            <div className="space-y-4 mb-8 flex-grow">
                                {synthesisUrls.map((sUrl, idx) => (
                                    <div key={idx} className="flex gap-2 group">
                                        <input
                                            type="url"
                                            value={sUrl}
                                            onChange={(e) => {
                                                const newUrls = [...synthesisUrls];
                                                newUrls[idx] = e.target.value;
                                                setSynthesisUrls(newUrls);
                                            }}
                                            placeholder="https://example.com/article..."
                                            className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all font-medium"
                                        />
                                        {synthesisUrls.length > 1 && (
                                            <button onClick={() => setSynthesisUrls(synthesisUrls.filter((_, i) => i !== idx))} className="p-3 text-muted-foreground hover:text-red-500 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => setSynthesisUrls([...synthesisUrls, ""])} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80 transition-opacity mt-2">
                                    <Plus className="w-4 h-4" /> Pridať zdroj
                                </button>
                            </div>
                            <button
                                onClick={handleSynthesis}
                                disabled={status === "loading" || synthesisUrls.filter(u => u.trim()).length === 0}
                                className="block w-full bg-primary text-primary-foreground text-center py-5 rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                            >
                                {status === "loading" ? "Generujem..." : "Spustiť Synthesis"}
                            </button>
                        </div>

                        <div className="bg-card border rounded-[40px] p-10 shadow-sm flex flex-col h-full ring-1 ring-border/50">
                            <div className="h-[200px] flex flex-col">
                                <div className="bg-muted text-foreground p-4 rounded-2xl w-fit mb-6">
                                    <Edit className="w-8 h-8" />
                                </div>
                                <h2 className="text-3xl font-black uppercase tracking-tight mb-3">Quick Gen</h2>
                                <p className="text-muted-foreground text-sm font-medium leading-relaxed">Rýchla adaptácia jedného článku.</p>
                            </div>
                            <form onSubmit={handleGenerate} className="flex flex-col flex-grow">
                                <div className="mb-8 flex-grow">
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://techcrunch.com/..."
                                        required
                                        className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all font-medium"
                                    />
                                </div>
                                <button type="submit" disabled={status === "loading" || !url} className="w-full bg-foreground text-background py-5 rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                                    {status === "loading" ? "Generujem..." : "Vygenerovať Draft"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* DISCOVERY TAB */}
                {activeTab === "discovery" && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h2 className="text-3xl font-black uppercase tracking-tight">Navrhované témy</h2>
                                <p className="text-muted-foreground font-medium">AI hľadá trendy na globálnych a lokálnych portáloch.</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleClearAllSuggestions}
                                    disabled={status === "loading" || suggestions.length === 0}
                                    className="bg-red-500/10 text-red-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center gap-3"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Vymazať všetko
                                </button>
                                <button
                                    onClick={handleDiscoverNews}
                                    disabled={status === "loading" || loadingSuggestions || discoveryTargetCategories.length === 0}
                                    className={cn(
                                        "bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 shadow-lg shadow-primary/20",
                                        (status === "loading" || loadingSuggestions || discoveryTargetCategories.length === 0) ? "opacity-50 cursor-not-allowed" : "hover:opacity-90 active:scale-95"
                                    )}
                                >
                                    {status === "loading" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    Hľadať nové témy
                                </button>
                            </div>
                        </div>

                        {/* Discovery Settings Panel */}
                        <div className="bg-card border border-border/50 p-8 rounded-[40px] shadow-sm ring-1 ring-border/50 grid grid-cols-1 lg:grid-cols-2 gap-10">
                            {/* Max Age Column */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Stárosť správ (Max Age)</label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { value: "1", label: "Posledných 24h" },
                                        { value: "3", label: "3 dni" },
                                        { value: "7", label: "Týždeň" },
                                        { value: "30", label: "Všetko (Mesiac)" }
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setDiscoveryDays(opt.value)}
                                            className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${discoveryDays === opt.value
                                                ? "bg-foreground border-foreground text-background shadow-lg"
                                                : "bg-background border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Target Categories Column */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Cieliť na sekcie (Viacero možností)</label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(() => {
                                        const allCats = ["Novinky SK/CZ", "Umelá Inteligencia", "Tech", "Biznis", "Krypto", "Svet", "Politika", "Gaming", "Veda", "Návody & Tipy"];
                                        const isAllSelected = discoveryTargetCategories.length === allCats.length;

                                        return (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        if (isAllSelected) {
                                                            setDiscoveryTargetCategories([]);
                                                        } else {
                                                            setDiscoveryTargetCategories(allCats);
                                                        }
                                                    }}
                                                    className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center gap-2 ${isAllSelected
                                                        ? "bg-primary border-primary text-primary-foreground shadow-xl scale-[1.05]"
                                                        : "bg-background border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                                                        }`}
                                                >
                                                    {isAllSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                    VŠETKY
                                                </button>

                                                {allCats.map((cat) => {
                                                    const isSelected = discoveryTargetCategories.includes(cat);
                                                    return (
                                                        <button
                                                            key={cat}
                                                            onClick={() => {
                                                                setDiscoveryTargetCategories(prev =>
                                                                    prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                                                                );
                                                            }}
                                                            className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center gap-2 ${isSelected
                                                                ? "bg-foreground border-foreground text-background shadow-xl scale-[1.05]"
                                                                : "bg-background border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                                                                }`}
                                                        >
                                                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                            {cat}
                                                        </button>
                                                    );
                                                })}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* AI Autopilot Panel */}
                        <div className="bg-gradient-to-br from-primary/10 via-background to-background border-2 border-primary/20 p-10 rounded-[40px] shadow-2xl relative overflow-hidden group/auto">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover/auto:opacity-20 transition-opacity">
                                <Sparkles className="w-32 h-32 text-primary" />
                            </div>

                            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                                <div className="max-w-xl">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="bg-primary text-primary-foreground p-3 rounded-2xl">
                                            <Zap className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-3xl font-black uppercase tracking-tight">AI Autopilot</h3>
                                        {autopilotSettings.enabled ? (
                                            <span className="bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">Aktívny</span>
                                        ) : (
                                            <span className="bg-muted text-muted-foreground text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Vypnutý</span>
                                        )}
                                    </div>
                                    <p className="text-muted-foreground font-medium text-lg leading-relaxed mb-8">
                                        <strong className="text-foreground">Zapnutý autopilot:</strong> Každých 24 hodín automaticky vyhľadá najlepšie svetové trendy, spracuje ich a publikuje.<br />
                                        <strong className="text-foreground">Manuálny štart:</strong> Okamžite spracuje tie témy, ktoré už máš pripravené v zozname nižšie (jednu z každej sekcie).
                                    </p>

                                    <div className="flex flex-wrap gap-6 text-sm font-bold uppercase tracking-widest">
                                        <div className="flex flex-col">
                                            <span className="text-muted-foreground text-[10px] mb-1">Posledný beh</span>
                                            <span className="text-foreground">{autopilotSettings.last_run ? new Date(autopilotSettings.last_run).toLocaleString('sk-SK') : 'Nikdy'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex flex-col group/count relative">
                                                <span className="text-muted-foreground text-[10px] mb-1">Spracovaných článkov</span>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={handleOpenAutopilotHistory}
                                                        className="text-foreground hover:text-primary transition-colors flex items-center gap-2 group-hover/count:underline decoration-primary/30"
                                                    >
                                                        {autopilotSettings.processed_count}
                                                        <History className="w-3 h-3 opacity-30" />
                                                    </button>
                                                    <button
                                                        onClick={handleResetAutopilotCount}
                                                        className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover/count:opacity-100"
                                                        title="Vynulovať počítadlo"
                                                    >
                                                        <RotateCcw className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 min-w-[240px]">
                                    <button
                                        onClick={handleToggleAutopilot}
                                        disabled={status === "loading"}
                                        className={cn(
                                            "w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 shadow-xl",
                                            autopilotSettings.enabled
                                                ? "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
                                                : "bg-green-500 text-white hover:bg-green-600 shadow-green-500/20"
                                        )}
                                    >
                                        {status === "loading" && isGeneratingModalOpen ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : null}
                                        {autopilotSettings.enabled ? "Vypnúť Autopilota" : "Zapnúť Autopilota"}
                                    </button>
                                    <button
                                        onClick={handleRunAutopilotNow}
                                        disabled={status === "loading"}
                                        className="w-full bg-foreground text-background py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {status === "loading" && isAutopilotLoadingModalOpen ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Štartujem...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4 fill-current" /> Spustiť manuálne
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {suggestions.length === 0 ? (
                            <div className="bg-card border border-dashed rounded-[40px] p-24 text-center">
                                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-8 text-3xl">✨</div>
                                <h3 className="text-2xl font-black uppercase mb-3 text-foreground/80">Všetko je spracované</h3>
                                <p className="text-muted-foreground font-medium">Momentálne nemáte žiadne nové návrhy.</p>
                            </div>
                        ) : (
                            <div className="space-y-10">
                                <div className="flex flex-wrap gap-2 p-1.5 bg-muted/30 rounded-2xl w-fit border border-border/50">
                                    <button onClick={() => setSelectedDiscoveryCategory("Všetky")} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedDiscoveryCategory === "Všetky" ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-muted text-muted-foreground"}`}>Všetky ({suggestions.length})</button>
                                    {Object.entries(suggestions.reduce((acc, curr) => { const cat = curr.category || "Nezaradené"; acc[cat] = (acc[cat] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([cat, count]) => (
                                        <button key={cat} onClick={() => setSelectedDiscoveryCategory(cat)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedDiscoveryCategory === cat ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-muted text-muted-foreground"}`}>{cat} ({count})</button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {suggestions.filter(s => {
                                        const itemCat = s.category || "Nezaradené";
                                        return selectedDiscoveryCategory === "Všetky" || itemCat === selectedDiscoveryCategory;
                                    }).map((suggestion) => (
                                        <div key={suggestion.id} className="bg-card border rounded-[40px] p-10 shadow-md hover:border-primary/40 transition-all group flex flex-col h-full ring-1 ring-border/50">
                                            <div className="flex items-start justify-between mb-8">
                                                <div className="flex flex-wrap gap-3">
                                                    <span className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">{suggestion.source}</span>
                                                    <span className="bg-muted text-muted-foreground px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-border/50">{suggestion.category || "Nezaradené"}</span>
                                                </div>
                                                <button onClick={() => handleIgnoreSuggestion(suggestion.id)} className="p-3 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><XCircle className="w-6 h-6" /></button>
                                            </div>
                                            <h3 className="text-2xl font-black leading-tight mb-6 group-hover:text-primary transition-colors">{suggestion.title}</h3>
                                            <p className="text-base text-muted-foreground mb-10 line-clamp-4 leading-relaxed font-medium">{suggestion.summary}</p>
                                            <div className="mt-auto pt-8 border-t border-border/50 flex items-center justify-between">
                                                <a href={suggestion.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black text-muted-foreground hover:text-foreground flex items-center gap-2 uppercase tracking-widest transition-colors"><Globe className="w-4 h-4" /> Zdroj</a>
                                                <button onClick={() => handleProcessSuggestion(suggestion)} className="bg-foreground text-background px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center gap-3 shadow-xl">Spracovať článok</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* MANAGE TAB */}
                {activeTab === "manage" && (
                    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-12">
                            {/* DRAFTS */}
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-widest mb-10 flex items-center gap-4">
                                    <span className="w-3 h-10 bg-yellow-500 rounded-full"></span> Koncepty (DRAFT)
                                    <span className="text-sm bg-muted px-3 py-1 rounded-full text-muted-foreground ml-auto">{articles.filter(a => a.status === 'draft').length}</span>
                                </h3>
                                {loadingArticles ? <div className="p-20 text-center animate-pulse font-black uppercase tracking-widest text-muted-foreground">Načítavam...</div> :
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {articles.filter(a => a.status === 'draft').map((article) => (
                                            <div key={article.id} className="bg-card border rounded-[32px] overflow-hidden flex flex-col h-full shadow-sm hover:shadow-xl transition-all ring-1 ring-border/50">
                                                <div className="relative w-full h-44 border-b overflow-hidden">
                                                    {article.main_image && (
                                                        <Image
                                                            src={article.main_image}
                                                            alt=""
                                                            fill
                                                            className="object-cover"
                                                            unoptimized
                                                        />
                                                    )}
                                                </div>
                                                <div className="p-6 flex-grow">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-primary mb-5 block">{article.category}</span>
                                                    <h4 className="text-lg font-black leading-tight mb-3 line-clamp-2">{article.title}</h4>
                                                    <p className="text-sm text-muted-foreground line-clamp-3 font-medium">{article.excerpt}</p>
                                                </div>
                                                <div className="p-6 pt-0 mt-auto flex flex-wrap gap-2">
                                                    <Link
                                                        href={`/article/${article.slug}?preview=make-com-webhook-secret`}
                                                        target="_blank"
                                                        className="flex-1 min-w-[80px] bg-muted hover:bg-primary/10 hover:text-primary p-3 rounded-xl text-center text-[10px] font-black uppercase tracking-widest transition-all border border-transparent hover:border-primary/20"
                                                    >
                                                        Náhľad
                                                    </Link>
                                                    <Link href={`/admin/edit/${article.id}`} className="flex-1 min-w-[80px] bg-muted hover:bg-primary/10 hover:text-primary p-3 rounded-xl text-center text-[10px] font-black uppercase tracking-widest transition-all border border-transparent hover:border-primary/20">Upraviť</Link>
                                                    <button onClick={() => handlePublish(article.id, article.status)} className="flex-1 min-w-[100px] bg-green-500 text-white p-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-green-500/20">Publikovať</button>
                                                    <button onClick={() => handleDelete(article.id)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {articles.filter(a => a.status === 'draft').length === 0 && <div className="col-span-full p-20 text-center border-2 border-dashed rounded-[32px] text-muted-foreground font-bold uppercase tracking-widest opacity-50">Žiadne koncepty</div>}
                                    </div>
                                }
                            </div>

                            {/* PUBLISHED */}
                            <div className="pt-8 border-t border-border/50">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                    <h3 className="text-2xl font-black uppercase tracking-widest flex items-center gap-4 text-foreground/70">
                                        <span className="w-3 h-10 bg-green-500 rounded-full opacity-50"></span> Online na webe
                                        <span className="text-sm bg-muted px-3 py-1 rounded-full text-muted-foreground ml-2">{articles.filter(a => a.status === 'published').length}</span>
                                    </h3>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleRefreshRecentCategories}
                                            disabled={refreshingType !== "none"}
                                            className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2 border-2 border-primary/20"
                                        >
                                            <RefreshCw className={cn("w-3 h-3", refreshingType === "recent" && "animate-spin")} />
                                            AI opraviť 20
                                        </button>
                                        <button
                                            onClick={handleRefreshAllCategories}
                                            disabled={refreshingType !== "none"}
                                            className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center gap-2 border-2 border-red-500/20"
                                        >
                                            <RefreshCw className={cn("w-3 h-3", refreshingType === "all" && "animate-spin")} />
                                            AI opraviť VŠETKO
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsBulkCategoryMode(!isBulkCategoryMode);
                                                setBulkSelectedArticles([]);
                                            }}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isBulkCategoryMode ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-muted hover:bg-muted/80 text-muted-foreground border-2 border-transparent hover:border-primary/20"}`}
                                        >
                                            {isBulkCategoryMode ? "Zrušiť hromadnú úpravu" : "Hromadná oprava kategórií"}
                                        </button>
                                    </div>
                                </div>

                                {isBulkCategoryMode && (
                                    <div className="w-full bg-primary/10 border border-primary/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                                        <div className="flex items-center gap-3 text-primary">
                                            <RefreshCw className={`w-5 h-5 ${refreshingType === "bulk" ? "animate-spin" : ""}`} />
                                            <span className="font-bold text-sm tracking-wide">
                                                Vybraných článkov pre AI kontrolu: <span className="text-lg font-black">{bulkSelectedArticles.length}</span>
                                            </span>
                                        </div>
                                        <button
                                            onClick={handleRefreshCategories}
                                            disabled={bulkSelectedArticles.length === 0 || refreshingType !== "none"}
                                            className="w-full md:w-auto px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                                        >
                                            {refreshingType === "bulk" ? "AI analyzuje články..." : "Zistiť a opraviť kategórie s AI"}
                                        </button>
                                    </div>
                                )}

                                {/* Category Filter for Published Articles */}
                                {articles.filter(a => a.status === 'published').length > 0 && (
                                    <div className="flex flex-wrap gap-2 p-1.5 bg-muted/30 rounded-2xl w-fit border border-border/50 mb-8">
                                        <button
                                            onClick={() => setSelectedPublishedCategory("Všetky")}
                                            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedPublishedCategory === "Všetky" ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-muted text-muted-foreground"}`}
                                        >
                                            Všetky ({articles.filter(a => a.status === 'published').length})
                                        </button>
                                        {Array.from(new Set(articles.filter(a => a.status === 'published').map(a => a.category || "Nezaradené"))).map(cat => {
                                            const count = articles.filter(a => a.status === 'published' && (a.category || "Nezaradené") === cat).length;
                                            return (
                                                <button
                                                    key={cat}
                                                    onClick={() => setSelectedPublishedCategory(cat)}
                                                    className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedPublishedCategory === cat ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-muted text-muted-foreground"}`}
                                                >
                                                    {cat} ({count})
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {articles.filter(a => a.status === 'published' && (selectedPublishedCategory === "Všetky" || (a.category || "Nezaradené") === selectedPublishedCategory)).map((article) => (
                                        <div key={article.id} className="relative group/admin">
                                            <div className={isBulkCategoryMode ? "pointer-events-none" : ""}>
                                                <ArticleCard article={article} />
                                            </div>

                                            {isBulkCategoryMode && (
                                                <div
                                                    onClick={() => toggleBulkSelection(article.id)}
                                                    className={`absolute inset-0 z-40 rounded-[2rem] cursor-pointer transition-all ${bulkSelectedArticles.includes(article.id)
                                                        ? "bg-primary/20 ring-4 ring-inset ring-primary"
                                                        : "bg-black/50 hover:bg-black/30"
                                                        }`}
                                                >
                                                    {bulkSelectedArticles.includes(article.id) && (
                                                        <div className="absolute top-6 right-6 bg-primary text-white p-2 rounded-full shadow-2xl shadow-black">
                                                            <CheckCircle2 className="w-8 h-8" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Admin Overlay Actions */}
                                            {!isBulkCategoryMode && (
                                                <div className="absolute top-6 right-6 z-30 flex flex-col gap-2 opacity-0 group-hover/admin:opacity-100 transition-opacity duration-300">
                                                    <Link
                                                        href={`/admin/edit/${article.id}`}
                                                        className="p-3 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-all border border-white/20 shadow-2xl flex items-center gap-2 group/btn"
                                                    >
                                                        <Edit className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                    </Link>
                                                    <button
                                                        onClick={() => handlePublish(article.id, article.status)}
                                                        title="Stiahnuť z webu (Zmeniť na DRAFT)"
                                                        className="p-3 bg-white/20 hover:bg-yellow-500/80 backdrop-blur-md rounded-full text-white transition-all border border-white/20 shadow-2xl flex items-center gap-2 group/btn"
                                                    >
                                                        <ArrowDown className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(article.id)}
                                                        title="Zmazať navždy"
                                                        className="p-3 bg-white/20 hover:bg-red-500/90 backdrop-blur-md rounded-full text-white transition-all border border-white/20 shadow-2xl flex items-center gap-2 group/btn"
                                                    >
                                                        <Trash2 className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {articles.filter(a => a.status === 'published').length === 0 && (
                                        <div className="col-span-full py-20 text-center border-2 border-dashed rounded-[32px] text-muted-foreground font-bold uppercase tracking-widest opacity-30 italic">
                                            Zatiaľ žiadne články vonku
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "analytics" && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-card border rounded-[32px] p-8 shadow-sm flex flex-col gap-2">
                                <div className="flex items-center gap-3 text-muted-foreground mb-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Celkový počet videní</span>
                                </div>
                                <div className="text-4xl font-black">{analytics.totalVisits.toLocaleString('sk-SK')}</div>
                            </div>
                            <button
                                onClick={fetchAnalytics}
                                disabled={loadingAnalytics}
                                className="md:col-span-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-[32px] p-8 flex flex-col items-center justify-center gap-2 transition-all group"
                            >
                                <RefreshCw className={cn("w-8 h-8", loadingAnalytics && "animate-spin")} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Obnoviť dáta</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            {/* Top Pages Table */}
                            <div className="bg-card border rounded-[40px] p-10 shadow-sm">
                                <h3 className="text-xl font-black uppercase tracking-tight mb-8">Najčítanejšie stránky</h3>
                                <div className="space-y-4">
                                    {analytics.topPages.map((page, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
                                            <span className="text-sm font-bold truncate max-w-[200px] md:max-w-md">{page.path === '/' ? 'Domovská stránka' : page.path}</span>
                                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-[10px] font-black">{page.count} videní</span>
                                        </div>
                                    ))}
                                    {analytics.topPages.length === 0 && <p className="text-center text-muted-foreground py-10 font-medium">Zatiaľ žiadne dáta o návštevách.</p>}
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="bg-card border rounded-[40px] p-10 shadow-sm">
                                <h3 className="text-xl font-black uppercase tracking-tight mb-8">Posledná aktivita</h3>
                                <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2">
                                    {analytics.recentVisits.map((visit, idx) => (
                                        <div key={idx} className="flex flex-col gap-1 p-4 bg-muted/20 rounded-2xl border border-border/40 text-[10px]">
                                            <div className="flex justify-between font-black uppercase tracking-widest text-muted-foreground mb-1">
                                                <span className="text-primary">{visit.path}</span>
                                                <span>{new Date(visit.created_at).toLocaleString('sk-SK')}</span>
                                            </div>
                                            <div className="text-muted-foreground truncate opacity-60">Ref: {visit.referrer || 'Priamy prístup'}</div>
                                        </div>
                                    ))}
                                    {analytics.recentVisits.length === 0 && <p className="text-center text-muted-foreground py-10 font-medium">Zatiaľ žiadne dáta o návštevách.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS - Simplified & High Z-Index */}
            {isDiscoveringModalOpen && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-xl"></div>
                    <div className="bg-card w-full max-w-sm border border-border/50 rounded-[40px] p-12 shadow-2xl flex flex-col items-center text-center relative overflow-hidden ring-1 ring-white/10">
                        <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
                        <div className="relative mb-10 text-primary w-24 h-24 rounded-full flex flex-col items-center justify-center bg-primary/10">
                            <Search className="w-10 h-10 animate-pulse text-primary z-10" />
                            <div className="absolute inset-0 border-[4px] border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        </div>
                        <h3 className="text-2xl font-black uppercase tracking-widest mb-4 z-10">AI Discovery</h3>
                        <div className="h-16 flex items-center justify-center overflow-hidden z-10 w-full px-2 text-sm text-muted-foreground font-medium">
                            {discoveryStage}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isGeneratingModalOpen && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-2xl"></div>
                    <div className="bg-card w-full max-w-sm border border-border/50 rounded-[40px] p-12 shadow-2xl flex flex-col items-center text-center relative overflow-hidden ring-1 ring-white/10">
                        <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
                        <div className="relative mb-10">
                            <div className="relative text-primary w-24 h-24 rounded-full flex flex-col items-center justify-center bg-primary/10 shadow-[0_0_50px_-12px_rgba(var(--primary),0.5)]">
                                <Sparkles className="w-10 h-10 animate-pulse text-primary z-10" />
                                <div className="absolute inset-0 border-[4px] border-primary/20 border-t-primary rounded-full animate-spin"></div>
                            </div>
                            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping -z-10 opacity-30"></div>
                        </div>
                        <h3 className="text-2xl font-black uppercase tracking-widest mb-4 z-10 tracking-[0.2em]">AI Studio</h3>
                        <div className="h-20 flex items-center justify-center overflow-hidden z-10 w-full px-2 text-sm text-muted-foreground font-medium italic">
                            {generatingStage}
                        </div>
                        <div className="flex gap-2 mt-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isAutopilotLoadingModalOpen && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-xl z-0"></div>
                    <div className="relative z-10 bg-card w-full max-w-sm border border-border/50 rounded-[40px] p-12 shadow-2xl flex flex-col items-center text-center overflow-hidden ring-1 ring-white/10">
                        <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
                        <div className="relative mb-10 text-primary w-24 h-24 rounded-full flex flex-col items-center justify-center bg-primary/10">
                            <Zap className="w-10 h-10 animate-pulse text-primary z-10" />
                            <div className="absolute inset-0 border-[4px] border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        </div>
                        <h3 className="text-2xl font-black uppercase tracking-widest mb-4 z-10">AI Autopilot</h3>
                        <div className="h-16 flex items-center justify-center overflow-hidden z-10 w-full px-2 text-sm text-muted-foreground font-medium">
                            {autopilotLoadingStage}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isAutopilotHistoryOpen && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 md:p-8" style={{ pointerEvents: 'auto' }}>
                    {/* Raw Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-xl cursor-pointer"
                        style={{ zIndex: 0 }}
                        onClick={() => setIsAutopilotHistoryOpen(false)}
                    ></div>

                    {/* Raw Modal Content */}
                    <div
                        className="relative bg-[#121212] w-full max-w-3xl rounded-[32px] border border-[#2a2a2a] flex flex-col max-h-[85vh] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden"
                        style={{ zIndex: 10 }}
                    >

                        {/* Header */}
                        <div className="px-8 py-6 border-b border-[#2a2a2a] flex items-center justify-between bg-[#1a1a1a] text-white">
                            <div className="flex items-center gap-4">
                                <div className="bg-[#2a2a2a] p-2 rounded-xl text-white">
                                    <History className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-widest leading-none mb-1 text-white">História Autopilota</h3>
                                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Spracované a Publikované články</p>
                                </div>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAutopilotHistoryOpen(false);
                                }}
                                className="p-3 bg-[#2a2a2a] hover:bg-red-500/20 hover:text-red-500 rounded-2xl transition-colors cursor-pointer text-zinc-300 pointer-events-auto"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="p-8 overflow-y-auto space-y-4 flex-grow w-full bg-[#121212] text-white">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-400">
                                    <RefreshCw className="w-10 h-10 animate-spin text-white" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">Načítavam dáta z databázy...</span>
                                </div>
                            ) : autopilotHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-[#2a2a2a] rounded-3xl mx-4">
                                    <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center mb-6">
                                        <History className="w-8 h-8 text-zinc-500" />
                                    </div>
                                    <h4 className="text-lg font-black uppercase tracking-widest text-white mb-2">Žiadna história</h4>
                                    <p className="text-sm font-medium text-zinc-400 max-w-[250px]">Modul Ai Autopilota zatiaľ nespracoval žiadne témy.</p>
                                </div>
                            ) : (
                                <div className="space-y-10 px-2 pb-6">
                                    {Object.entries(autopilotHistory.reduce((acc, curr) => {
                                        const cat = curr.category || "Nezaradené";
                                        if (!acc[cat]) acc[cat] = [];
                                        acc[cat].push(curr);
                                        return acc;
                                    }, {} as Record<string, AutopilotHistoryItem[]>)).map(([category, items]) => (
                                        <div key={category} className="space-y-4">
                                            <h4 className="flex items-center gap-3 text-white text-sm font-black uppercase tracking-widest border-b border-[#2a2a2a] pb-3">
                                                <div className="w-2.5 h-2.5 rounded-full bg-white/20 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                                                </div>
                                                {category}
                                                <span className="text-zinc-400 bg-[#2a2a2a] px-2 py-0.5 rounded-full text-[10px] ml-auto">({(items as AutopilotHistoryItem[]).length})</span>
                                            </h4>
                                            <div className="grid gap-3">
                                                {(items as AutopilotHistoryItem[]).map((item, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex flex-col sm:flex-row gap-4 sm:items-center p-5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] hover:border-white/30 transition-all group"
                                                    >
                                                        <div className="flex-grow w-full">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-[10px] text-zinc-400 font-bold tracking-wider bg-[#2a2a2a] px-2 py-1 rounded-md">
                                                                    {new Date(item.created_at).toLocaleString('sk-SK')}
                                                                </span>
                                                            </div>
                                                            <h4 className="font-bold text-white text-sm xl:text-base leading-snug group-hover:text-zinc-200 transition-colors line-clamp-2 mb-3">
                                                                {item.title}
                                                            </h4>
                                                            <a
                                                                href={item.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-white flex items-center gap-2 transition-colors w-fit border-b border-transparent hover:border-white pb-0.5"
                                                            >
                                                                <Globe className="w-3.5 h-3.5" />
                                                                Otvoriť zdroj
                                                            </a>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Area */}
                        <div className="px-8 py-5 border-t border-[#2a2a2a] bg-[#1a1a1a] text-center z-20">
                            <p className="text-[11px] text-zinc-400 font-black uppercase tracking-[0.15em]">
                                Celkovo spravovaných sekcií: {Object.keys(autopilotHistory.reduce((acc, curr) => { acc[curr.category || ""] = true; return acc; }, {} as Record<string, boolean>)).length}
                            </p>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {status === "loading" && message && !isDiscoveringModalOpen && !isGeneratingModalOpen && !isAutopilotLoadingModalOpen && (
                <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-foreground text-background px-10 py-6 rounded-[32px] shadow-2xl flex items-center gap-4 z-[999] border border-white/10 ring-8 ring-black/5 whitespace-nowrap">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    <span className="font-black uppercase tracking-[0.1em] text-[11px] italic">{message}</span>
                </div>
            )}
        </>
    );
}
