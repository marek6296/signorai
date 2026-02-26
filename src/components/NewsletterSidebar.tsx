"use client";

import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";

export function NewsletterSidebar() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setStatus("loading");
        try {
            const res = await fetch("/api/newsletter/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            if (!res.ok) throw new Error("Chyba");

            setStatus("success");
            setEmail("");
        } catch (error) {
            alert("Chyba pri prihlasovaní. Skúste to neskôr.");
            setStatus("idle");
        }
    };

    if (status === "success") {
        return (
            <div className="mt-8 p-8 bg-green-500/10 border border-green-500/20 rounded-[2rem] flex flex-col items-center text-center sticky top-48 shadow-sm backdrop-blur-sm animate-in zoom-in duration-500">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-500">
                    <CheckCircle2 size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-green-600 mb-2">Ďakujeme!</span>
                <p className="text-sm font-bold text-foreground/80">Váš email bol úspešne pridaný do zoznamu.</p>
            </div>
        );
    }

    return (
        <div className="mt-8 p-8 bg-muted/40 border border-border rounded-[2rem] flex flex-col items-center text-center sticky top-48 shadow-sm backdrop-blur-sm">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-2xl">
                ✉️
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">AI Weekly Newsletter</span>
            <p className="text-sm font-bold mb-6 text-foreground/80">Získajte najdôležitejšie AI novinky každú nedeľu do emailu.</p>
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
                <input
                    type="email"
                    required
                    placeholder="Váš email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-4 text-xs focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                />
                <button
                    disabled={status === "loading"}
                    className="w-full bg-primary text-primary-foreground text-xs font-black px-4 py-4 rounded-xl uppercase tracking-[0.1em] hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                    {status === "loading" ? "Spracovávam..." : "Odoberať"}
                </button>
            </form>
        </div>
    );
}
