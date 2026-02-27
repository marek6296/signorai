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
        <div className={`group relative overflow-hidden rounded-[2.5rem] transition-all duration-500 hover:shadow-primary/30 border flex flex-col h-[300px] md:h-[350px] ${mounted && resolvedTheme === "light"
            ? "bg-white border-zinc-200 shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
            : "bg-zinc-950 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            }`}>
            {/* Logo as Full Background */}
            <div className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-700 ${mounted && resolvedTheme === "light" ? "opacity-30 group-hover:opacity-40" : "opacity-40 group-hover:opacity-50"
                }`}>
                {mounted && (
                    <Image
                        src={logoSrc}
                        alt="Postovinky Logo Background"
                        fill
                        className="object-cover transition-transform duration-1000 group-hover:scale-110"
                        priority
                    />
                )}
                {/* Gradient Overlay for Readability */}
                <div className={`absolute inset-0 ${mounted && resolvedTheme === "light"
                    ? "bg-gradient-to-t from-white via-white/20 to-transparent"
                    : "bg-gradient-to-t from-black via-black/40 to-transparent"
                    }`} />
            </div>

            {/* Header - Top Center */}
            <div className="absolute top-2 left-0 w-full z-20 flex flex-col items-center">
                <h2 className={`font-syne font-extrabold tracking-tighter leading-none text-2xl md:text-3xl uppercase opacity-90 group-hover:opacity-100 transition-opacity ${mounted && resolvedTheme === "light" ? "text-zinc-900" : "text-white"
                    }`}>
                    PRIDAJ SA
                </h2>
            </div>

            {/* Content Overlay - Minimalist Bottom */}
            <div className="mt-auto relative z-20 w-full p-6">
                <div className="flex flex-col items-center text-center gap-6">

                    {/* Larger Social Buttons Grid */}
                    <div className="flex items-center justify-center gap-6">
                        <a
                            href="https://www.instagram.com/postovinky.news/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`w-14 h-14 rounded-2xl border flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-xl group/icon ${mounted && resolvedTheme === "light"
                                ? "bg-zinc-100 border-zinc-200 text-zinc-900 hover:bg-zinc-200"
                                : "bg-white/5 border-white/10 text-white hover:bg-white/20"
                                }`}
                            title="Instagram"
                        >
                            <Instagram className="w-7 h-7" />
                        </a>
                        <a
                            href="https://www.facebook.com/profile.php?id=61564215815848"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`w-14 h-14 rounded-2xl border flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-xl group/icon ${mounted && resolvedTheme === "light"
                                ? "bg-zinc-100 border-zinc-200 text-zinc-900 hover:bg-zinc-200"
                                : "bg-white/5 border-white/10 text-white hover:bg-white/20"
                                }`}
                            title="Facebook"
                        >
                            <Facebook className="w-7 h-7" />
                        </a>
                        <a
                            href="https://x.com/POSTOVINKY"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`w-14 h-14 rounded-2xl border flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-xl group/icon ${mounted && resolvedTheme === "light"
                                ? "bg-zinc-100 border-zinc-200 text-zinc-900 hover:bg-zinc-200"
                                : "bg-white/5 border-white/10 text-white hover:bg-white/20"
                                }`}
                            title="Twitter / X"
                        >
                            <XIcon size={28} />
                        </a>
                    </div>
                </div>
            </div>

            {/* Premium Inner Glow */}
            <div className={`absolute inset-0 border-2 border-primary/0 rounded-[2.5rem] transition-all duration-700 group-hover:border-primary/40 group-hover:bg-primary/5 pointer-events-none`} />
        </div>
    );
}
