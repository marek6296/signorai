"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Plus, Sparkles, Check, Loader2, Globe, FileText, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Step = "input" | "research" | "synthesis" | "preview";

function SynthesisStudioContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [step, setStep] = useState<Step>("input");

    // Step 1: Input
    const [urls, setUrls] = useState<string[]>([""]);

    // Step 2 & 3: Results
    const [researchResults, setResearchResults] = useState<any[]>([]);
    const [synthesizedArticle, setSynthesizedArticle] = useState<any>(null);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            const loggedInUser = localStorage.getItem("admin_logged_in");
            if (loggedInUser !== "true") {
                router.push("/admin");
            } else {
                setIsLoggedIn(true);

                // Load URLs from query params if present
                const urlsParam = searchParams.get('urls');
                if (urlsParam) {
                    const parsedUrls = urlsParam.split(',').filter(u => u.trim());
                    if (parsedUrls.length > 0) {
                        setUrls(parsedUrls);
                    }
                }
            }
        }
    }, [router, searchParams]);

    const addUrl = () => setUrls([...urls, ""]);
    const removeUrl = (index: number) => {
        const newUrls = [...urls];
        newUrls.splice(index, 1);
        setUrls(newUrls.length ? newUrls : [""]);
    };
    const updateUrl = (index: number, val: string) => {
        const newUrls = [...urls];
        newUrls[index] = val;
        setUrls(newUrls);
    };

    const startSynthesis = async () => {
        const validUrls = urls.filter(u => u.trim().startsWith("http"));
        if (validUrls.length === 0) {
            setError("Zadajte aspoň jednu platnú URL adresu.");
            return;
        }

        setError("");
        setStep("research");
        setStatus("Sťahujem a analyzujem zdroje...");

        try {
            const res = await fetch("/api/admin/generate-article-multi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    urls: validUrls,
                    secret: "make-com-webhook-secret"
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Syntéza zlyhala");

            setSynthesizedArticle(data.article);
            setStep("preview");
        } catch (err: any) {
            setError(err.message);
            setStep("input");
        }
    };

    const saveDraft = async () => {
        // Since the API already saves it as a draft, we just redirect or show success
        router.push("/admin");
    };

    if (!isLoggedIn) return null;

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            {/* Header */}
            <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin" className="p-2 hover:bg-muted rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="font-black uppercase tracking-widest text-lg">Synthesis Studio</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-primary/10 rounded-full border border-primary/20">
                            <div className={`w-2 h-2 rounded-full ${step === 'preview' ? 'bg-green-500' : 'bg-primary animate-pulse'}`} />
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">
                                {step === 'input' && "Pripravený na import"}
                                {step === 'research' && "Prebieha výskum..."}
                                {step === 'preview' && "Hotovo - Čaká na schválenie"}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 mt-12 max-w-4xl">
                {/* Stepper Logic */}
                {step === "input" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-12">
                            <h2 className="text-4xl font-black mb-4">Čo dnes ideme syntetizovať?</h2>
                            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                                Vložte linky na zahraničné články. Naša AI z nich extrahuje fakty, overí rozdiely a vytvorí jeden prémiový slovenský článok.
                            </p>
                        </div>

                        <div className="bg-card border rounded-3xl p-8 shadow-xl border-primary/10">
                            <div className="space-y-4 mb-8">
                                {urls.map((url, index) => (
                                    <div key={index} className="flex gap-3 group">
                                        <div className="flex-grow relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                                                <Globe className="w-5 h-5" />
                                            </div>
                                            <input
                                                type="url"
                                                value={url}
                                                onChange={(e) => updateUrl(index, e.target.value)}
                                                placeholder="https://example.com/article..."
                                                className="w-full bg-background border-2 border-border rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-primary transition-all text-lg font-medium"
                                            />
                                        </div>
                                        {urls.length > 1 && (
                                            <button
                                                onClick={() => removeUrl(index)}
                                                className="p-4 text-red-500 hover:bg-red-500/10 rounded-2xl transition-colors"
                                            >
                                                <Trash2 className="w-6 h-6" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={addUrl}
                                className="flex items-center gap-2 text-primary font-bold hover:underline mb-8"
                            >
                                <Plus className="w-5 h-5" />
                                Pridať ďalší zdroj k téme
                            </button>

                            {error && (
                                <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl mb-8 text-center font-bold">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={startSynthesis}
                                className="w-full bg-primary text-primary-foreground py-6 rounded-2xl font-black text-xl uppercase tracking-widest shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                            >
                                <Sparkles className="w-6 h-6" />
                                Spustiť Inteligentnú Syntézu
                            </button>
                        </div>
                    </div>
                )}

                {step === "research" && (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
                        <div className="relative mb-12">
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                            <div className="relative bg-card border-4 border-primary/20 w-32 h-32 rounded-full flex items-center justify-center">
                                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-black mb-4">Pracujem na Synthesis...</h2>
                        <p className="text-xl text-muted-foreground max-w-md">
                            {status}
                        </p>

                        <div className="mt-12 w-full max-w-xs bg-muted h-2 rounded-full overflow-hidden">
                            <div className="bg-primary h-full w-1/3 animate-progress transition-all" />
                        </div>
                    </div>
                )}

                {step === "preview" && synthesizedArticle && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="flex items-center justify-between mb-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-full font-bold text-sm">
                                <Check className="w-4 h-4" />
                                Syntéza Úspešná
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep("input")}
                                    className="px-6 py-2 border rounded-xl font-bold hover:bg-muted transition-colors text-sm"
                                >
                                    Upraviť zdroje
                                </button>
                                <button
                                    onClick={saveDraft}
                                    className="px-6 py-2 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all text-sm shadow-lg shadow-primary/20"
                                >
                                    Prejsť do Magazínu
                                </button>
                            </div>
                        </div>

                        <div className="bg-card border rounded-3xl overflow-hidden shadow-2xl">
                            {synthesizedArticle.main_image && (
                                <div className="w-full h-[400px] relative">
                                    <img
                                        src={synthesizedArticle.main_image}
                                        alt={synthesizedArticle.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-6 left-6">
                                        <span className="bg-primary text-primary-foreground px-4 py-2 rounded-full font-bold uppercase tracking-widest text-xs">
                                            {synthesizedArticle.category}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="p-12">
                                <h1 className="text-4xl font-black mb-8 leading-tight">
                                    {synthesizedArticle.title}
                                </h1>

                                <div className="mb-12 p-8 bg-zinc-950 border border-white/5 rounded-3xl relative overflow-hidden shadow-2xl">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] rotate-12">
                                        <Sparkles className="w-48 h-48" />
                                    </div>
                                    <div className="relative z-10 flex flex-col gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/80">AI SUMMARY</span>
                                        </div>
                                        <p className="text-lg md:text-xl font-medium italic leading-relaxed text-zinc-200">
                                            "{synthesizedArticle.ai_summary}"
                                        </p>
                                    </div>
                                </div>

                                <div
                                    className="prose prose-invert max-w-none prose-p:text-lg prose-p:leading-relaxed prose-headings:font-black"
                                    dangerouslySetInnerHTML={{ __html: synthesizedArticle.content }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function SynthesisStudio() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background text-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>}>
            <SynthesisStudioContent />
        </Suspense>
    );
}
