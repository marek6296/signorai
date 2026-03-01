"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { Menu, X, Search, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

const categories = [
    { name: "Najnovšie", href: "/" },
    { name: "Novinky SK/CZ", href: "/kategoria/novinky" },
    { name: "Umelá Inteligencia", href: "/kategoria/ai" },
    { name: "Tech", href: "/kategoria/tech" },
    { name: "Biznis", href: "/kategoria/biznis" },
    { name: "Krypto", href: "/kategoria/krypto" },
    { name: "Svet", href: "/kategoria/svet" },
    { name: "Politika", href: "/kategoria/politika" },
    { name: "Veda", href: "/kategoria/veda" },
    { name: "Gaming", href: "/kategoria/gaming" },
    { name: "Návody & Tipy", href: "/kategoria/navody" },
];

export function Navbar() {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
            setIsMenuOpen(false);
            setSearchQuery("");
        }
    };

    useEffect(() => {
        const checkAdmin = () => {
            setIsAdmin(localStorage.getItem("admin_logged_in") === "true");
        };
        checkAdmin();
        // Listen for storage changes in case login happens in another tab
        window.addEventListener('storage', checkAdmin);
        // Also check on manual interval or just once is fine for most cases since login is on the same site
        return () => window.removeEventListener('storage', checkAdmin);
    }, []);

    const allCategories = [
        ...categories,
        ...(isAdmin ? [{ name: "Admin", href: "/admin" }] : [])
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex flex-col items-center justify-center py-2 md:py-3 relative px-4 sm:px-6 lg:px-8">

                {/* DESKTOP SEARCH (Left) */}
                <div className="hidden md:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 items-center z-30">
                    <form onSubmit={handleSearch} className="flex items-center group bg-muted/20 hover:bg-muted/40 rounded-full px-3 transition-all border border-white/5 focus-within:border-primary/50">
                        <button type="submit" className="p-1.5 text-muted-foreground group-focus-within:text-primary hover:text-primary transition-colors">
                            <Search size={16} />
                        </button>
                        <input
                            type="text"
                            placeholder="Hľadať..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent py-2 px-1 text-[10px] font-black uppercase tracking-widest w-24 md:focus:w-32 lg:focus:w-40 xl:focus:w-56 transition-all duration-500 outline-none"
                        />
                    </form>
                </div>

                {/* Brand Logo Section */}
                <Link href="/" className="flex items-baseline gap-2 group px-8 md:px-0" onClick={() => setIsMenuOpen(false)}>
                    <span className="font-syne font-extrabold text-2xl md:text-4xl lg:text-6xl tracking-tighter uppercase 
                        bg-gradient-to-r from-foreground via-foreground/50 to-foreground 
                        bg-clip-text text-transparent animate-text-shimmer leading-none">
                        POSTOVINKY
                    </span>
                    <span className="text-primary font-black text-[8px] md:text-xs uppercase tracking-[0.3em] opacity-70 group-hover:opacity-100 transition-opacity translate-y-[-1px] md:translate-y-[-2.5px] ml-1">
                        News
                    </span>
                </Link>

                {/* Mobile Menu Toggle (Left) */}
                <div className="md:hidden absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex items-center">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-2 text-foreground hover:bg-muted rounded-md transition-colors"
                        aria-label="Toggle Menu"
                    >
                        {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Desktop Nav */}
                <nav className="hidden md:flex flex-wrap items-center justify-center gap-2 mt-2 mb-1">
                    {allCategories.map((category) => {
                        const isActive = pathname === category.href || (category.href !== "/" && pathname.startsWith(category.href));

                        return (
                            <Link
                                key={category.name}
                                href={category.href}
                                className={cn(
                                    "group relative flex items-center justify-center px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-colors duration-[600ms] ease-in-out z-10",
                                    isActive
                                        ? "text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {/* AKTÍVNY STAV: Extrémne plynulé objavenie a zväčšenie po kliknutí (elegantný ease-in-out) */}
                                <span
                                    className={cn(
                                        "absolute inset-0 w-full h-full rounded-xl border-2 transition-all duration-[600ms] ease-in-out z-0",
                                        isActive
                                            ? "bg-primary border-primary scale-100 opacity-100 shadow-md"
                                            : "bg-transparent border-transparent scale-[0.85] opacity-0"
                                    )}
                                />

                                {/* HOVER STAV: Jemné vynorenie na pozadí, funguje aj s aktívnym plynulo za sebou */}
                                {!isActive && (
                                    <span
                                        className="absolute inset-0 w-full h-full rounded-xl border-2 border-transparent transition-all duration-[400ms] ease-out group-hover:border-primary/40 group-hover:bg-primary/5 scale-95 group-hover:scale-100 z-0"
                                    />
                                )}

                                {/* Samotný text ležiaci na vrchu s veľmi jemným zväčšením */}
                                <span className={cn(
                                    "relative z-10 transition-transform duration-[600ms] ease-in-out",
                                    isActive ? "scale-[1.03]" : "scale-100 group-hover:scale-[1.03]"
                                )}>
                                    {category.name}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Top Right: Theme Toggle (Centred vertically on mobile, top on desktop) */}
                <div className="absolute right-3 sm:right-4 lg:right-10 top-1/2 -translate-y-1/2 flex items-center">
                    <ThemeToggle />
                </div>
            </div>

            {/* Mobile Dropdown Nav */}
            <div className={cn(
                "md:hidden absolute top-full left-0 w-full bg-background/95 backdrop-blur shadow-2xl border-b border-border/40 flex flex-col items-center py-6 gap-2 transition-all duration-300 ease-in-out origin-top",
                isMenuOpen ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0 pointer-events-none"
            )}>
                {/* Mobile Search */}
                <div className="w-11/12 max-w-sm mb-4">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            placeholder="Hľadať v správach..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-muted/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-black uppercase tracking-widest outline-none focus:border-primary/50 focus:bg-background transition-all"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <button
                            type="submit"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-xl"
                        >
                            <ArrowRight size={16} />
                        </button>
                    </form>
                </div>

                {allCategories.map((category) => {
                    const isActive = pathname === category.href || (category.href !== "/" && pathname.startsWith(category.href));

                    return (
                        <Link
                            key={category.name}
                            href={category.href}
                            onClick={() => setIsMenuOpen(false)}
                            className={cn(
                                "group relative flex items-center justify-center px-4 py-3.5 text-[13px] font-black uppercase tracking-widest rounded-xl transition-colors duration-300 ease-in-out w-11/12 max-w-sm",
                                isActive
                                    ? "text-primary-foreground bg-primary shadow-lg shadow-primary/20"
                                    : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
                            )}
                        >
                            <span className={cn(
                                "relative z-10 transition-transform duration-300 ease-in-out",
                                isActive ? "scale-[1.05]" : "scale-100"
                            )}>
                                {category.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </header>
    );
}
