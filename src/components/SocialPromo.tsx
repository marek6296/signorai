"use client";

import { Instagram, Facebook } from "lucide-react";

const XIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

export function SocialPromo() {
    return (
        <div className="bg-foreground text-background p-8 rounded-[40px] shadow-2xl overflow-hidden relative group border border-white/10">
            {/* Background pattern/accents */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/20 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 blur-[60px] rounded-full translate-y-1/2 -translate-x-1/2 group-hover:bg-primary/10 transition-all duration-700" />

            <div className="relative z-10 flex flex-col gap-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">Klub Čitateľov</span>
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-white leading-none">
                        Buďte<br />v obraze
                    </h3>
                    <p className="text-xs font-semibold text-white/50 leading-relaxed max-w-[200px]">
                        Dostávajte najhorúcejšie AI novinky priamo do vášho feedu.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    <a
                        href="https://www.instagram.com/postovinky.news/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all duration-300 group/item border border-white/5"
                    >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 flex items-center justify-center shadow-lg group-hover/item:scale-110 transition-transform">
                            <Instagram className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white">Instagram</span>
                            <span className="text-[9px] font-bold text-white/40 uppercase">@postovinky.news</span>
                        </div>
                    </a>

                    <a
                        href="https://www.facebook.com/profile.php?id=61564215815848"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all duration-300 group/item border border-white/5"
                    >
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg group-hover/item:scale-110 transition-transform">
                            <Facebook className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white">Facebook</span>
                            <span className="text-[9px] font-bold text-white/40 uppercase">Postovinky</span>
                        </div>
                    </a>

                    <a
                        href="https://x.com/POSTOVINKY"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all duration-300 group/item border border-white/5"
                    >
                        <div className="w-10 h-10 rounded-xl bg-black border border-white/20 flex items-center justify-center shadow-lg group-hover/item:scale-110 transition-transform">
                            <XIcon size={18} className="text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white">Twitter / X</span>
                            <span className="text-[9px] font-bold text-white/40 uppercase">@Postovinky</span>
                        </div>
                    </a>
                </div>

                <div className="pt-2">
                    <p className="text-center text-[9px] font-bold uppercase tracking-[0.2em] text-primary">Pridajte sa k technologickej elite</p>
                </div>
            </div>
        </div>
    );
}
