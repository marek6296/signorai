"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Article } from "@/lib/data";

interface Props {
    params: { id: string };
}

export default function EditArticlePage({ params }: Props) {
    const router = useRouter();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Form state
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [excerpt, setExcerpt] = useState("");
    const [content, setContent] = useState("");
    const [category, setCategory] = useState("");
    const [aiSummary, setAiSummary] = useState("");
    const [mainImage, setMainImage] = useState("");

    const [status, setStatus] = useState<"loading" | "idle" | "saving" | "success" | "error">("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            const loggedInUser = localStorage.getItem("admin_logged_in");
            if (loggedInUser === "true") {
                setIsLoggedIn(true);
                fetchArticle();
            } else {
                router.push("/admin");
            }
        }
    }, []);

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("saving");
        setMessage("");

        const { error } = await supabase
            .from("articles")
            .update({
                title,
                slug,
                excerpt,
                content,
                category,
                ai_summary: aiSummary,
                main_image: mainImage,
            })
            .eq("id", params.id);

        if (error) {
            setStatus("error");
            setMessage("Chyba pri ukladaní: " + error.message);
        } else {
            setStatus("success");
            setMessage("Článok úspešne uložený!");

            // Revalidate cache
            await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });

            setTimeout(() => {
                setStatus("idle");
            }, 3000);
        }
    };

    if (!isLoggedIn) return null;

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl flex-grow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h1 className="text-3xl font-black">Úprava článku</h1>
                <div className="flex items-center gap-2">
                    <a
                        href={`/article/${slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 text-sm font-bold rounded-lg border border-border hover:bg-muted transition-colors flex items-center justify-center text-primary"
                    >
                        Náhľad článku na webe
                    </a>
                    <Link
                        href="/admin"
                        className="px-4 py-2 text-sm font-bold rounded-lg border border-border hover:bg-muted transition-colors flex items-center justify-center"
                    >
                        Späť na Admin Panel
                    </Link>
                </div>
            </div>

            {status === "loading" ? (
                <div className="bg-card border rounded-2xl p-8 shadow-sm text-center">
                    <p className="text-muted-foreground">Načítavam článok...</p>
                </div>
            ) : (
                <div className="bg-card border rounded-2xl p-8 shadow-sm relative">
                    {message && (
                        <div className={`mb-6 p-4 rounded-lg font-medium text-center ${status === "error" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                            "bg-green-500/10 text-green-600 dark:text-green-400"
                            }`}>
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">Nadpis (Title)</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium mb-2">Kategória</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                                    required
                                >
                                    <option value="Svet">Svet</option>
                                    <option value="Tech">Tech</option>
                                    <option value="Politika">Politika</option>
                                    <option value="Biznis">Biznis</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">URL Slug</label>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    className="w-full bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-muted-foreground"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Hlavný Obrázok (URL)</label>
                            <input
                                type="url"
                                value={mainImage}
                                onChange={(e) => setMainImage(e.target.value)}
                                className="w-full bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Perex (Excerpt - úvodný text)</label>
                            <textarea
                                value={excerpt}
                                onChange={(e) => setExcerpt(e.target.value)}
                                rows={3}
                                className="w-full bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                <span className="text-primary font-bold">Zhrnutie od AI</span>
                            </label>
                            <textarea
                                value={aiSummary}
                                onChange={(e) => setAiSummary(e.target.value)}
                                rows={2}
                                className="w-full bg-background border border-primary/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Kompletný Obsah (HTML Formát)</label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={15}
                                className="w-full bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm resize-y"
                                required
                            />
                        </div>

                        <div className="pt-6 border-t sticky bottom-0 bg-card z-10 p-4 -mx-4 rounded-b-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.8)]">
                            <button
                                type="submit"
                                disabled={status === "saving"}
                                className="w-full bg-primary text-primary-foreground font-bold rounded-lg px-4 py-4 transition-colors hover:bg-primary/90 disabled:opacity-50"
                            >
                                {status === "saving" ? "Ukladám zmeny..." : "Uložiť zmeny v článku"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
