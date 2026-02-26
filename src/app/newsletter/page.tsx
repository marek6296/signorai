"use client";

import React, { useState } from "react";
import { Mail, Shield, Zap, Bell, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NewsletterPage() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");

        // Simulating API call
        setTimeout(() => {
            setStatus("success");
            setEmail("");
        }, 1500);
    };

    return (
        <div className="flex-grow flex flex-col items-center justify-center py-12 md:py-24 px-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-primary/20 rounded-full blur-[100px] animate-pulse" />

            <div className="w-full max-w-4xl relative z-10">
                <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-[3rem] p-8 md:p-16 shadow-2xl flex flex-col items-center text-center">

                    {/* Icon Header */}
                    <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mb-10 rotate-3 ring-1 ring-primary/20">
                        <Mail className="w-10 h-10 text-primary" />
                    </div>

                    {/* Title */}
                    <h1 className="font-syne font-extrabold text-5xl md:text-7xl uppercase tracking-tighter mb-6 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent leading-none">
                        AI Weekly
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-12 font-medium">
                        Získajte náskok pred ostatnými. Každú nedeľu vám doručíme kurátorský výber toho najdôležitejšieho zo sveta umelej inteligencie.
                    </p>

                    {/* Benefits Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 w-full text-left">
                        {[
                            { icon: Zap, title: "Rýchly prehľad", desc: "Zhrnutie týždňa do 5 minút čítania." },
                            { icon: Bell, title: "Horúce novinky", desc: "O nových modeloch sa dozviete medzi prvými." },
                            { icon: Shield, title: "Žiadny spam", desc: "Rešpektujeme súkromie. Odber zrušíte kedykoľvek." }
                        ].map((benefit, i) => (
                            <div key={i} className="bg-muted/30 border border-border/50 p-6 rounded-[2rem] hover:bg-muted/50 transition-colors group">
                                <benefit.icon className="w-6 h-6 text-primary mb-4 group-hover:scale-110 transition-transform" />
                                <h3 className="font-black uppercase tracking-widest text-[11px] mb-2">{benefit.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{benefit.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* Subscription Form */}
                    <div className="w-full max-w-lg">
                        {status === "success" ? (
                            <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-500">
                                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-500">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-black uppercase tracking-tight">Vitajte v komunite!</h3>
                                <p className="text-muted-foreground">Odoslali sme vám potvrdzovací email.</p>
                                <button
                                    onClick={() => setStatus("idle")}
                                    className="mt-4 text-xs font-black uppercase tracking-widest hover:text-primary transition-colors"
                                >
                                    Prihlásiť iný email
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                <div className="relative group">
                                    <input
                                        type="email"
                                        required
                                        placeholder="Váš najlepší email..."
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full h-16 bg-background/50 border-2 border-border/50 rounded-2xl px-6 font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-center md:text-left"
                                    />
                                </div>
                                <button
                                    disabled={status === "loading"}
                                    type="submit"
                                    className={cn(
                                        "h-16 w-full rounded-2xl font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center shadow-xl shadow-primary/20",
                                        status === "loading"
                                            ? "bg-muted text-muted-foreground"
                                            : "bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98]"
                                    )}
                                >
                                    {status === "loading" ? "Spracovávam..." : "Chcem odoberať správy"}
                                </button>
                            </form>
                        )}

                        <p className="mt-8 text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest">
                            Kliknutím na tlačidlo súhlasíte so spracovaním osobných údajov.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
