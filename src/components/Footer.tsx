"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Image from "next/image";

export function Footer() {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Determine logo based on theme. Defaulting to logo-dark-text.png for SSR/Light
    const logoSrc = mounted && (resolvedTheme === "dark" || resolvedTheme === "colorful")
        ? "/logo/white-transparent.png"
        : "/logo/logo-dark-text.png";

    return (
        <footer className="relative border-t bg-background pt-20 pb-12 mt-20 overflow-hidden">
            {/* Subtle background element */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 pb-16">

                    {/* Brand Identity Section */}
                    <div className="lg:col-span-5 space-y-4">
                        <Link href="/" className="group block focus:outline-none shrink-0">
                            <div className="relative inline-block">
                                <Image
                                    src={logoSrc}
                                    alt="POSTOVINKY Logo"
                                    width={220}
                                    height={55}
                                    className="h-auto w-auto max-h-20 object-contain transition-transform duration-500 group-hover:scale-105"
                                    priority
                                />
                                {mounted && (resolvedTheme === "dark" || resolvedTheme === "colorful") && (
                                    <div className="absolute -inset-6 bg-primary/5 blur-3xl rounded-full -z-10 opacity-60" />
                                )}
                            </div>
                        </Link>

                        <p className="text-lg text-muted-foreground leading-relaxed font-medium max-w-md">
                            Váš prémiový zdroj pre najnovšie správy zo sveta technologického pokroku a umelej inteligencie. Každý deň prinášame to najdôležitejšie.
                        </p>

                        <div className="flex items-center gap-4">
                            <a href="#" className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                                <span className="sr-only">Twitter</span>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z" /></svg>
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                                <span className="sr-only">Instagram</span>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.266.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.848 0-3.204.012-3.584.07-4.849.149-3.225-1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.778 6.98 6.978 1.28.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                            </a>
                        </div>
                    </div>

                    {/* Navigation Links Section */}
                    <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-12">
                        <div className="space-y-6">
                            <h3 className="font-bold uppercase tracking-widest text-[11px] text-foreground/50">Kategórie</h3>
                            <ul className="space-y-4 text-[15px] font-medium text-muted-foreground">
                                <li><Link href="/" className="hover:text-primary transition-colors">Najnovšie</Link></li>
                                <li><Link href="/kategoria/ai" className="hover:text-primary transition-colors">Umelá Inteligencia</Link></li>
                                <li><Link href="/kategoria/tech" className="hover:text-primary transition-colors">Tech</Link></li>
                                <li><Link href="/kategoria/biznis" className="hover:text-primary transition-colors">Biznis</Link></li>
                                <li><Link href="/kategoria/krypto" className="hover:text-primary transition-colors">Krypto</Link></li>
                            </ul>
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-bold uppercase tracking-widest text-[11px] text-foreground/50">Redakcia</h3>
                            <ul className="space-y-4 text-[15px] font-medium text-muted-foreground">
                                <li><Link href="/o-nas" className="hover:text-primary transition-colors">Náš príbeh</Link></li>
                                <li><Link href="/kontakt" className="hover:text-primary transition-colors">Kontakt</Link></li>
                                <li><Link href="/ochrana-sukromia" className="hover:text-primary transition-colors">Ochrana súkromia</Link></li>
                                <li><Link href="/admin" className="hover:text-primary transition-colors">Admin Panel</Link></li>
                            </ul>
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-bold uppercase tracking-widest text-[11px] text-foreground/50">Ostatné</h3>
                            <ul className="space-y-4 text-[15px] font-medium text-muted-foreground">
                                <li><Link href="/newsletter" className="hover:text-primary transition-colors">Newsletter</Link></li>
                                <li><Link href="/kategoria/svet-politika" className="hover:text-primary transition-colors">Svet</Link></li>
                                <li><Link href="/kategoria/veda" className="hover:text-primary transition-colors">Veda</Link></li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Copyright */}
                <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground font-medium">
                    <p>© {new Date().getFullYear()} POSTOVINKY. Vyrobené pre digitálnu éru.</p>
                    <div className="flex gap-8">
                        <Link href="/ochrana-sukromia" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                        <Link href="/kontakt" className="hover:text-foreground transition-colors">Support</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
