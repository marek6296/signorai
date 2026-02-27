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
        <div className="group relative overflow-hidden rounded-[2.5rem] bg-zinc-950 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 hover:shadow-primary/30 border border-white/10 flex flex-col h-[300px] md:h-[350px]">
            {/* Logo as Full Background */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity duration-700">
                {mounted && (
                    <Image
                        src={logoSrc}
                        alt="Postovinky Logo Background"
                        fill
                        className="object-cover transition-transform duration-1000 group-hover:scale-110"
                        priority
                    />
                )}
                {/* Dark Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            </div>

            {/* Content Overlay - Minimalist */}
            <div className="mt-auto relative z-20 w-full p-6">
                <div className="flex flex-col items-center text-center gap-6">
                    <div className="flex flex-col gap-1 items-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/80">
                            KOMUNITA
                        </span>
                        <h2 className="font-black tracking-widest text-white leading-none text-xl md:text-2xl uppercase italic">
                            PRIDAJ SA
                        </h2>
                    </div>

                    {/* Larger Social Buttons Grid */}
                    <div className="flex items-center justify-center gap-6">
                        <a
                            href="https://www.instagram.com/postovinky.news/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-xl group/icon"
                            title="Instagram"
                        >
                            <Instagram className="w-7 h-7 text-white" />
                        </a>
                        <a
                            href="https://www.facebook.com/profile.php?id=61564215815848"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-xl group/icon"
                            title="Facebook"
                        >
                            <Facebook className="w-7 h-7 text-white" />
                        </a>
                        <a
                            href="https://x.com/POSTOVINKY"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-xl group/icon"
                            title="Twitter / X"
                        >
                            <XIcon size={28} className="text-white" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Premium Inner Glow */}
            <div className="absolute inset-0 border-2 border-primary/0 rounded-[2.5rem] transition-all duration-700 group-hover:border-primary/40 group-hover:bg-primary/5 pointer-events-none" />
        </div>
    );
}
