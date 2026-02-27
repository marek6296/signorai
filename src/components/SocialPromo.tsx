"use client";

import Image from "next/image";
import { Instagram, Facebook } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const XIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z" />
    </svg>
);

export function SocialPromo() {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // black.png for dark/colorful, white.png for light as requested
    const logoSrc = mounted && (resolvedTheme === "dark" || resolvedTheme === "colorful")
        ? "/logo/black.png"
        : "/logo/white.png";

    return (
        <div className="group relative overflow-hidden rounded-[2.5rem] bg-zinc-950 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 hover:shadow-primary/30 border border-white/10 flex flex-col h-[400px] md:h-[450px]">
            {/* Background Accents (replacing image) */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[70%] h-[70%] bg-primary/20 blur-[120px] rounded-full group-hover:bg-primary/30 transition-all duration-1000" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-500/10 blur-[100px] rounded-full" />
            </div>

            {/* Logo Center */}
            <div className="flex-grow flex items-center justify-center p-12 relative z-10">
                {mounted && (
                    <div className="relative w-full max-w-[280px] aspect-[4/1] transition-transform duration-700 group-hover:scale-110">
                        <Image
                            src={logoSrc}
                            alt="Postovinky Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                )}
            </div>

            {/* Content Overlay - High Contrast */}
            <div className="mt-auto relative z-20 w-full p-6">
                <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 md:p-8 flex flex-col items-center text-center gap-6 shadow-2xl transition-transform duration-500 group-hover:-translate-y-2">
                    <div className="flex flex-col gap-2 items-center">
                        <span className="text-[14px] md:text-[16px] font-black uppercase tracking-[0.4em] text-primary animate-pulse whitespace-nowrap">
                            NEWSLETTER & COMMUNITY
                        </span>
                        <h2 className="font-black tracking-tighter text-white leading-none text-3xl md:text-5xl uppercase italic whitespace-nowrap">
                            SLEDUJ SVET S NAMI
                        </h2>
                    </div>

                    {/* Larger Social Buttons Grid */}
                    <div className="flex items-center justify-center gap-6">
                        <a
                            href="https://www.instagram.com/postovinky.news/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.05)] group/icon"
                            title="Instagram"
                        >
                            <Instagram className="w-8 h-8 text-white group-hover/icon:text-white" />
                        </a>
                        <a
                            href="https://www.facebook.com/profile.php?id=61564215815848"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.05)] group/icon"
                            title="Facebook"
                        >
                            <Facebook className="w-8 h-8 text-white group-hover/icon:text-white" />
                        </a>
                        <a
                            href="https://x.com/POSTOVINKY"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.05)] group/icon"
                            title="Twitter / X"
                        >
                            <XIcon size={32} className="text-white group-hover/icon:text-white" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Premium Inner Glow */}
            <div className="absolute inset-0 border-2 border-primary/0 rounded-[2.5rem] transition-all duration-700 group-hover:border-primary/40 group-hover:bg-primary/5 pointer-events-none" />
        </div>
    );
}
