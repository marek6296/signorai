"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

// Dot pattern matching aiwai.app background
function DotPattern() {
    const dots = [
        { x: "8%", y: "12%" }, { x: "22%", y: "6%" }, { x: "78%", y: "9%" }, { x: "92%", y: "18%" },
        { x: "5%", y: "45%" }, { x: "95%", y: "55%" }, { x: "15%", y: "80%" }, { x: "85%", y: "75%" },
        { x: "40%", y: "4%" }, { x: "60%", y: "92%" }, { x: "30%", y: "88%" }, { x: "70%", y: "15%" },
    ];
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {dots.map((d, i) => (
                <div key={i} className="absolute w-1 h-1 rounded-full"
                    style={{ left: d.x, top: d.y, background: "rgba(26,26,46,0.12)" }} />
            ))}
        </div>
    );
}

export function AppPromo() {
    const { user } = useUser();
    if (user) return null;

    return (
        <div className="relative overflow-hidden rounded-[1.75rem] flex flex-col"
            style={{
                background: "linear-gradient(145deg, #eee8d8 0%, #e8e0cc 50%, #ede6d4 100%)",
                border: "1px solid rgba(26,26,46,0.08)",
                boxShadow: "0 8px 40px rgba(26,26,46,0.1)",
            }}
        >
            <DotPattern />

            <div className="relative z-10 p-6 flex flex-col gap-4">

                {/* Partner badge */}
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.3em]"
                        style={{ color: "rgba(26,26,46,0.35)" }}>
                        Partner
                    </span>
                    <div className="flex-1 h-px" style={{ background: "rgba(26,26,46,0.1)" }} />
                </div>

                {/* Heading — matches aiwai.app typography style */}
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2.5">
                        {/* AIWai logo mark */}
                        <div className="w-10 h-10 relative shrink-0" style={{ opacity: 0.75 }}>
                            <Image
                                src="/aiwai-logo.png"
                                alt="AIWai logo"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <div>
                            <span className="text-lg font-bold tracking-tight"
                                style={{ color: "#1a1a2e" }}>
                                Intelligent
                            </span>
                        </div>
                    </div>
                    <div className="pl-9 leading-tight">
                        <span className="text-base italic font-light"
                            style={{ color: "rgba(26,26,46,0.4)" }}>Digital </span>
                        <span className="text-base font-bold"
                            style={{
                                background: "linear-gradient(90deg, #b8924a, #c4a265, #d4b47a)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}>Architecture</span>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(26,26,46,0.12), transparent)" }} />

                {/* Description */}
                <p className="text-[12px] leading-relaxed"
                    style={{ color: "rgba(26,26,46,0.55)", fontWeight: 400 }}>
                    Navrhujeme a vytvárame digitálne zážitky poháňané AI. Prémiový dizajn spojený s inteligentnou automatizáciou.
                </p>

                {/* Services as tags */}
                <div className="flex flex-wrap gap-1.5">
                    {["AI Agenty", "AI Chatboty", "Automatizácia", "Design"].map((s) => (
                        <span key={s} className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                            style={{
                                background: "rgba(26,26,46,0.06)",
                                border: "1px solid rgba(26,26,46,0.1)",
                                color: "rgba(26,26,46,0.55)"
                            }}>
                            {s}
                        </span>
                    ))}
                </div>

                {/* Tagline */}
                <div className="py-3 text-center"
                    style={{ borderTop: "1px solid rgba(26,26,46,0.08)", borderBottom: "1px solid rgba(26,26,46,0.08)" }}>
                    <p className="text-[11px] italic font-light tracking-wide"
                        style={{ color: "rgba(26,26,46,0.45)" }}>
                        „Let&apos;s build something intelligent together."
                    </p>
                </div>

                {/* CTA — matching "ZAČAŤ PROJEKT" button style */}
                <Link
                    href="https://aiwai.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/btn flex items-center justify-center gap-2 w-full py-3 rounded-none text-[10px] font-semibold uppercase tracking-[0.2em] transition-all duration-200"
                    style={{
                        border: "1px solid rgba(26,26,46,0.4)",
                        color: "#1a1a2e",
                        background: "transparent",
                        borderRadius: "4px",
                    }}
                    onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = "rgba(26,26,46,0.06)";
                        el.style.borderColor = "rgba(26,26,46,0.7)";
                    }}
                    onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = "transparent";
                        el.style.borderColor = "rgba(26,26,46,0.4)";
                    }}
                >
                    Začať projekt
                    <ArrowUpRight size={11} className="transition-transform duration-200 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                </Link>

            </div>
        </div>
    );
}
