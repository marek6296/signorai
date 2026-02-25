"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Article } from "@/lib/data";
import Link from "next/link";
import { Edit, ArrowUpRight, ArrowDown, Trash2, Sparkles, Plus, Globe } from "lucide-react";

export default function AdminPage() {
    const [url, setUrl] = useState("");
    const [synthesisUrls, setSynthesisUrls] = useState<string[]>([""]);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [articles, setArticles] = useState<Article[]>([]);
    const [loadingArticles, setLoadingArticles] = useState(true);

    // Tab control
    const [activeTab, setActiveTab] = useState<"create" | "manage">("manage");

    // Authentication state
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");

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

    useEffect(() => {
        // Skontrolovať či je používateľ už prihlásený (pre jednoduchosť ukladáme do localStorage)
        if (typeof window !== "undefined") {
            const loggedInUser = localStorage.getItem("admin_logged_in");
            if (loggedInUser === "true") {
                setIsLoggedIn(true);
                fetchArticles();
            }
        }
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError("");

        if (email === "cmelo.marek@gmail.com" && password === "Marek6296") {
            setIsLoggedIn(true);
            localStorage.setItem("admin_logged_in", "true");
            fetchArticles();
        } else {
            setLoginError("Nesprávny e-mail alebo heslo");
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        localStorage.removeItem("admin_logged_in");
        setArticles([]);
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!url) return;

        setStatus("loading");
        setMessage("Sťahujem článok a generujem AI preklad... Môže to trvať 20-30 sekúnd.");

        try {
            const res = await fetch("/api/admin/generate-article", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url,
                    secret: "make-com-webhook-secret" // Pevné heslo pre demo účely
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Nepodarilo sa vygenerovať článok");
            }

            setStatus("success");
            setMessage(`Úspech! Článok "${data.article?.title}" bol prijatý ako DRAFT.`);
            setUrl("");
            fetchArticles(); // Obnov zoznam článkov

        } catch (error: any) {
            setStatus("error");
            setMessage(error.message);
        }
    };



    const handlePublish = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === "published" ? "draft" : "published";
        const { error } = await supabase
            .from("articles")
            .update({ status: newStatus })
            .eq("id", id);

        if (!error) {
            fetchArticles();

            // Zavolaj revalidate cache
            await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
        } else {
            alert("Chyba pri zmene statusu: " + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Naozaj vymazať článok?")) return;

        const { error } = await supabase
            .from("articles")
            .delete()
            .eq("id", id);

        if (!error) {
            fetchArticles();
            await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
        } else {
            alert("Chyba pri mazaní: " + error.message);
        }
    };

    if (!isLoggedIn) {
        return (
            <div className="container mx-auto px-4 py-20 max-w-md flex-grow">
                <div className="bg-card border rounded-2xl p-8 shadow-sm">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-black mb-2 uppercase tracking-widest">SignorAI</h1>
                        <p className="text-muted-foreground">Len pre autorizovaných redaktorov</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">E-mail</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Heslo</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>

                        {loginError && (
                            <div className="p-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-medium text-center">
                                {loginError}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-primary text-primary-foreground font-bold rounded-lg px-4 py-4 mt-4 transition-colors hover:bg-primary/90"
                        >
                            Prihlásiť sa do redakcie
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-5xl flex-grow">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 bg-card border p-6 rounded-2xl shadow-sm">
                <div>
                    <h1 className="text-3xl font-black mb-2 uppercase tracking-tight">AI Magazín Manager</h1>
                    <p className="text-muted-foreground">Kompletný systém pre správu a tvorbu obsahu</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleLogout}
                        className="text-sm font-bold text-muted-foreground hover:text-foreground underline underline-offset-4 px-2"
                    >
                        Odhlásiť sa
                    </button>
                </div>
            </div>

            <div className="flex space-x-2 mb-8 border-b border-border pb-px">
                <button
                    onClick={() => setActiveTab("create")}
                    className={`px-6 py-3 font-bold text-sm rounded-t-lg transition-colors border-b-2 ${activeTab === "create" ? "bg-card border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                >
                    Tvorba obsahu
                </button>
                <button
                    onClick={() => setActiveTab("manage")}
                    className={`px-6 py-3 font-bold text-sm rounded-t-lg transition-colors border-b-2 ${activeTab === "manage" ? "bg-card border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                >
                    Správa článkov
                </button>
            </div>

            {activeTab === "create" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Synthesis Studio Card */}
                    <div className="bg-card border rounded-3xl p-10 shadow-sm flex flex-col relative overflow-hidden h-full">
                        <div className="h-[220px] flex flex-col">
                            <div className="bg-primary/10 text-primary p-4 rounded-2xl w-fit mb-6 flex-shrink-0">
                                <Sparkles className="w-8 h-8" />
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-tight mb-3">Synthesis Studio</h2>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Pokročilý nástroj na tvorbu komplexných článkov z viacerých svetových zdrojov naraz.
                            </p>
                        </div>

                        <div className="space-y-4 mb-8 flex-grow">
                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">
                                Zdroje pre syntézu
                            </label>
                            {synthesisUrls.map((sUrl, idx) => (
                                <div key={idx} className="flex gap-2 group">
                                    <div className="relative flex-grow">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                                            <Globe className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="url"
                                            value={sUrl}
                                            onChange={(e) => {
                                                const newUrls = [...synthesisUrls];
                                                newUrls[idx] = e.target.value;
                                                setSynthesisUrls(newUrls);
                                            }}
                                            placeholder="https://example.com/article..."
                                            className="w-full bg-background border-2 border-border rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-all font-medium"
                                        />
                                    </div>
                                    {synthesisUrls.length > 1 && (
                                        <button
                                            onClick={() => setSynthesisUrls(synthesisUrls.filter((_, i) => i !== idx))}
                                            className="p-3 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                onClick={() => setSynthesisUrls([...synthesisUrls, ""])}
                                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary hover:opacity-80 transition-opacity mt-2"
                            >
                                <Plus className="w-4 h-4" /> Pridať ďalší zdroj
                            </button>
                        </div>

                        <div className="mt-auto">
                            <Link
                                href={{
                                    pathname: "/admin/synthesis",
                                    query: { urls: synthesisUrls.filter(u => u.trim()).join(',') }
                                }}
                                className="block w-full bg-primary text-primary-foreground text-center py-5 rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20"
                            >
                                Spustiť Synthesis Studio
                            </Link>
                        </div>
                    </div>

                    {/* Quick Generator Card */}
                    <div className="bg-card border rounded-3xl p-10 shadow-sm flex flex-col h-full">
                        <div className="h-[220px] flex flex-col">
                            <div className="bg-muted text-foreground p-4 rounded-2xl w-fit mb-6 flex-shrink-0">
                                <Edit className="w-8 h-8" />
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-tight mb-3">Rýchly Generátor</h2>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Rýchly preklad a adaptácia jedného konkrétneho zahraničného článku do slovenčiny pomocou AI.
                            </p>
                        </div>

                        <form onSubmit={handleGenerate} className="flex flex-col flex-grow">
                            <div className="mb-8 flex-grow">
                                <label htmlFor="url" className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">
                                    Zdrojová URL adresa
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                                        <Globe className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="url"
                                        id="url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://techcrunch.com/..."
                                        required
                                        disabled={status === "loading"}
                                        className="w-full bg-background border-2 border-border rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-all font-medium"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground/60 mt-4 leading-relaxed italic">
                                    * Stačí vložiť link a AI sa postará o zvyšok. Výsledok nájdete v sekcii Koncepty.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={status === "loading" || !url}
                                className="w-full bg-foreground text-background py-5 rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {status === "loading" ? "Generujem..." : "Vygenerovať Draft"}
                            </button>

                            {message && (
                                <div className={`mt-4 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-center ${status === "error" ? "bg-red-500/10 text-red-500" :
                                    status === "success" ? "bg-green-500/10 text-green-500" :
                                        "bg-blue-500/10 text-blue-500"
                                    }`}>
                                    {message}
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {activeTab === "manage" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {loadingArticles ? (
                        <p>Načítavam články...</p>
                    ) : articles.length === 0 ? (
                        <p className="text-muted-foreground">Ešte žiadne články vo vašej databáze.</p>
                    ) : (
                        <div className="space-y-12">
                            {/* DRAFTS SECTION */}
                            <div>
                                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                    <span className="bg-yellow-500/10 text-yellow-600 px-3 py-1 rounded-full text-sm">Koncepty (DRAFT)</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {articles.filter(a => a.status === 'draft').length === 0 ? (
                                        <p className="text-muted-foreground text-sm italic col-span-full">Žiadne koncepty nečakajú na publikáciu.</p>
                                    ) : (
                                        articles.filter(a => a.status === 'draft').map((article) => (
                                            <div key={article.id} className="group relative border border-border bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                                                <Link href={`/article/${article.slug}`} target="_blank" className="flex flex-col flex-grow outline-none relative hover:bg-muted/30 transition-colors">
                                                    {article.main_image && (
                                                        <div className="w-full h-48 bg-muted overflow-hidden relative border-b border-border">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={article.main_image} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                            <div className="absolute top-3 left-3">
                                                                <span className="inline-flex items-center rounded-full bg-primary/95 backdrop-blur-md border border-primary/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-md">{article.category}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="p-5 flex flex-col flex-grow">
                                                        {!article.main_image && (
                                                            <div className="mb-3">
                                                                <span className="inline-flex items-center rounded-full bg-primary/95 backdrop-blur-md border border-primary/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-md">{article.category}</span>
                                                            </div>
                                                        )}
                                                        <h3 className="text-lg font-bold leading-tight mb-2 line-clamp-2 hover:underline group-hover:text-primary transition-colors">
                                                            {article.title}
                                                        </h3>
                                                        <p className="text-muted-foreground text-sm line-clamp-3 mb-6 flex-grow">{article.excerpt}</p>
                                                    </div>
                                                </Link>

                                                <div className="px-5 pb-5 mt-auto">
                                                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border/50">
                                                        <Link href={`/admin/edit/${article.id}`} className="flex flex-col items-center justify-center gap-1 py-3 border border-border text-xs font-semibold rounded-lg hover:bg-muted transition-colors text-foreground">
                                                            <Edit className="w-4 h-4" />
                                                            Upraviť
                                                        </Link>
                                                        <button onClick={() => handlePublish(article.id, article.status)} className="flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                                            <ArrowUpRight className="w-4 h-4" />
                                                            Publikovať
                                                        </button>
                                                        <button onClick={() => handleDelete(article.id)} className="flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                            Zmazať
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* PUBLISHED SECTION */}
                            <div>
                                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 border-t pt-10 border-border">
                                    <span className="bg-green-500/10 text-green-600 px-3 py-1 rounded-full text-sm">Publikované na webe</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {articles.filter(a => a.status === 'published').length === 0 ? (
                                        <p className="text-muted-foreground text-sm italic col-span-full">Zatiaľ neboli publikované žiadne články.</p>
                                    ) : (
                                        articles.filter(a => a.status === 'published').map((article) => (
                                            <div key={article.id} className="group relative border border-border bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full bg-opacity-50">
                                                <Link href={`/article/${article.slug}`} target="_blank" className="flex flex-col flex-grow outline-none hover:bg-muted/10 transition-colors">
                                                    {article.main_image && (
                                                        <div className="w-full h-32 bg-muted overflow-hidden relative border-b border-border opacity-80 group-hover:opacity-100 transition-opacity">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={article.main_image} alt={article.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300" />
                                                            <div className="absolute top-3 left-3">
                                                                <span className="inline-flex items-center rounded-full bg-primary/95 backdrop-blur-md border border-primary/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-md">{article.category}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="p-5 flex flex-col flex-grow">
                                                        {!article.main_image && (
                                                            <div className="mb-3">
                                                                <span className="inline-flex items-center rounded-full bg-primary/95 backdrop-blur-md border border-primary/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-md">{article.category}</span>
                                                            </div>
                                                        )}
                                                        <h3 className="text-base font-bold leading-tight mb-2 line-clamp-2 text-muted-foreground group-hover:text-foreground group-hover:underline transition-all">
                                                            {article.title}
                                                        </h3>
                                                    </div>
                                                </Link>

                                                <div className="px-5 pb-5 mt-auto">
                                                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border/50">
                                                        <Link href={`/admin/edit/${article.id}`} className="flex flex-col items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                                            <Edit className="w-4 h-4" />
                                                            Upraviť
                                                        </Link>
                                                        <button onClick={() => handlePublish(article.id, article.status)} className="flex flex-col items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                                                            <ArrowDown className="w-4 h-4" />
                                                            Do Draftu
                                                        </button>
                                                        <button onClick={() => handleDelete(article.id)} className="flex flex-col items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                            Zmazať
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
