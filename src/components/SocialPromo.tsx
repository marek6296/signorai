"use client";

import Image from "next/image";
import { Instagram, Facebook } from "lucide-react";

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
    return (
        <div className="group relative overflow-hidden rounded-[2rem] bg-zinc-900 shadow-2xl transition-all duration-500 hover:shadow-primary/20 border border-white/5 flex flex-col h-[350px] md:h-[400px]">
            {/* Background Image - Matching ArticleCard style */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <Image
                    src="/images/social-promo-bg.png"
                    alt="Social Media Connectivity"
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
                {/* Dark Gradient Overlay for Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 pointer-events-none" />
            </div>

            {/* Category Badge - Top Left */}
            <div className="absolute top-4 left-6 z-20 pointer-events-none">
                <span className="inline-flex items-center rounded-full bg-primary/20 backdrop-blur-md border border-primary/30 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary shadow-2xl">
                    Sociálne Siete
                </span>
            </div>

            {/* Content Overlay - Glassmorphism at Bottom */}
            <div className="mt-auto relative z-20 w-full p-2">
                <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] p-4 md:p-5 flex flex-col items-center text-center">
                    <div className="flex flex-col gap-3 md:gap-4 items-center">
                        <div className="flex flex-col gap-1 items-center">
                            <span className="text-[9px] md:text-[10px] font-bold text-primary uppercase tracking-[0.3em]">
                                Newsletter & Community
                            </span>
                            <h2 className="font-black tracking-tight text-white leading-tight text-xl md:text-2xl uppercase italic">
                                Sleduj svet s nami
                            </h2>
                        </div>

                        {/* Social Buttons Grid */}
                        <div className="flex items-center justify-center gap-4">
                            <a
                                href="https://www.instagram.com/postovinky.news/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-lg group/icon"
                                title="Instagram"
                            >
                                <Instagram className="w-5 h-5 text-white/80 group-hover/icon:text-white" />
                            </a>
                            <a
                                href="https://www.facebook.com/profile.php?id=61564215815848"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-lg group/icon"
                                title="Facebook"
                            >
                                <Facebook className="w-5 h-5 text-white/80 group-hover/icon:text-white" />
                            </a>
                            <a
                                href="https://x.com/POSTOVINKY"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-lg group/icon"
                                title="Twitter / X"
                            >
                                <XIcon size={20} className="text-white/80 group-hover/icon:text-white" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subtle Inner Glow on Hover */}
            <div className="absolute inset-0 border-2 border-primary/0 rounded-[2rem] transition-all duration-500 group-hover:border-primary/20 group-hover:bg-primary/5 pointer-events-none" />
        </div>
    );
}
