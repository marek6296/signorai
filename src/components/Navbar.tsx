"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { Menu, X, Search, ArrowRight, Loader2, Sparkles, ChevronDown, LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { type Article } from "@/lib/data";
import Image from "next/image";
import { useUser } from "@/contexts/UserContext";

const categories = [
    { name: "Najnovšie", href: "/" },
    { name: "AI", href: "/kategoria/ai" },
    { name: "Tech", href: "/kategoria/tech" },
    { name: "Návody & Tipy", href: "/kategoria/navody" },
    { name: "AI Nástroje", href: "/ai-tools" },
    { name: "Fórum", href: "/forum" },
];

function UserAuthButton() {
    const { user, loading, signOut } = useUser();
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);

    if (loading) return null;

    if (user) {
        const avatarUrl = user.user_metadata?.avatar_url;
        const name = user.user_metadata?.full_name || user.email || "Používateľ";
        const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

        return (
            <div className="relative">
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 rounded-full transition-all hover:opacity-80"
                    title={name}
                >
                    {avatarUrl ? (
                        <Image
                            src={avatarUrl}
                            alt={name}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full object-cover border-2 border-primary/30"
                            unoptimized
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-black text-primary">
                            {initials}
                        </div>
                    )}
                </button>

                {menuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-2 w-56 bg-background/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                            <div className="px-4 py-3 border-b border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Prihlásený ako</p>
                                <p className="text-[12px] font-bold text-foreground truncate mt-0.5">{name}</p>
                            </div>
                            <div className="p-2">
                                <button
                                    onClick={() => { signOut(); setMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                >
                                    <LogOut size={14} />
                                    Odhlásiť sa
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    }

    // On mobile these are already shown inside the slide-out menu — hide from top bar
    return (
        <div className="hidden md:flex items-center gap-2">
            {/* Registrovať sa — ghost outline */}
            <Link
                href="/registracia"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-200 border border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
            >
                Registrovať
            </Link>
            {/* Prihlásiť sa — filled accent */}
            <Link
                href="/prihlasenie"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-200 bg-primary text-primary-foreground hover:opacity-85 active:scale-95"
            >
                <LogIn size={11} />
                Prihlásiť sa
            </Link>
        </div>
    );
}

export function Navbar() {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const { user, signOut } = useUser();

    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [suggestions, setSuggestions] = useState<Article[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
            setIsMenuOpen(false);
            setSearchQuery("");
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    // Predictive search logic
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.trim().length < 2) {
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            setIsSearching(true);
            try {
                const { data, error } = await supabase
                    .from("articles")
                    .select("*")
                    .eq("status", "published")
                    .or(`title.ilike.%${searchQuery}%,excerpt.ilike.%${searchQuery}%`)
                    .limit(5)
                    .order("published_at", { ascending: false });

                if (error) throw error;
                setSuggestions(data || []);
                setShowSuggestions(true);
            } catch (err) {
                console.error("Suggestions error:", err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Admin emails — users who always get Admin menu
    const ADMIN_EMAILS = ["cmelo.marek@gmail.com"];

    useEffect(() => {
        const checkAdmin = () => {
            setIsAdmin(localStorage.getItem("admin_logged_in") === "true");
        };
        checkAdmin();
        window.addEventListener('storage', checkAdmin);
        return () => window.removeEventListener('storage', checkAdmin);
    }, []);

    // Admin if: manually logged in via admin panel OR logged in with admin email
    const isAdminUser = isAdmin || (!!user && ADMIN_EMAILS.includes(user.email ?? ""));

    const allCategories = [
        ...categories,
        ...(isAdminUser ? [{ name: "Admin", href: "/admin" }] : [])
    ];

    return (
        <>
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto flex flex-col items-center justify-center py-3 md:py-5 relative px-4 sm:px-6 lg:px-8">

                    {/* DESKTOP MENU + SEARCH (Left Corner, in a row) */}
                    <div className="hidden md:flex absolute left-4 lg:left-10 top-1/2 -translate-y-1/2 flex-row items-center gap-3 z-50">

                        {/* DROPDOWN MENU — vľavo */}
                        <div className="relative group">
                            <button className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                                Menu <ChevronDown size={12} className="transition-transform duration-300 group-hover:rotate-180" />
                            </button>
                            <div className="absolute top-full left-0 mt-2 w-52 bg-background/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden
                                opacity-0 invisible translate-y-2
                                group-hover:opacity-100 group-hover:visible group-hover:translate-y-0
                                transition-all duration-300 ease-out z-50 flex flex-col p-2 gap-1">
                                {allCategories.map((cat) => {
                                    const isActiveCat = pathname === cat.href || (cat.href !== "/" && pathname.startsWith(cat.href));
                                    return (
                                        <Link
                                            key={cat.name}
                                            href={cat.href}
                                            className={cn(
                                                "flex items-center px-4 py-3 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-200",
                                                isActiveCat
                                                    ? "text-primary-foreground bg-primary shadow-md"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
                                            )}
                                        >
                                            {cat.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {/* SEARCH — vpravo od menu */}
                        <div className="relative">
                            <form onSubmit={handleSearch} className="flex items-center group bg-muted/20 hover:bg-muted/40 rounded-full px-3 transition-all border border-white/5 focus-within:border-primary/50">
                                <button type="submit" className="p-1.5 text-muted-foreground group-focus-within:text-primary hover:text-primary transition-colors">
                                    {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                </button>
                                <input
                                    type="text"
                                    placeholder="Hľadať..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    className="bg-transparent py-2 px-1 text-[10px] font-black uppercase tracking-widest w-20 focus:w-28 lg:focus:w-36 transition-all duration-500 outline-none"
                                />
                            </form>

                            {/* Suggestions Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 mt-2 w-72 lg:w-80 bg-background/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 z-50">
                                    <div className="p-2 flex flex-col gap-1">
                                        <div className="px-3 py-1.5">
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/60">Navrhované články</span>
                                        </div>
                                        {suggestions.map((article) => (
                                            <Link
                                                key={article.id}
                                                href={`/article/${article.slug}`}
                                                className="group flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-all"
                                                onClick={() => {
                                                    setSearchQuery("");
                                                    setSuggestions([]);
                                                    setShowSuggestions(false);
                                                }}
                                            >
                                                <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 border border-white/5">
                                                    <Image
                                                        src={article.main_image}
                                                        alt={article.title}
                                                        fill
                                                        className="object-cover transition-transform group-hover:scale-110"
                                                        unoptimized
                                                    />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[10px] font-black uppercase text-primary/80 tracking-widest truncate">{article.category}</span>
                                                    <h4 className="text-[11px] font-bold text-foreground leading-tight line-clamp-2 transition-colors group-hover:text-primary">{article.title}</h4>
                                                </div>
                                            </Link>
                                        ))}
                                        <button
                                            onClick={handleSearch}
                                            className="w-full mt-1 p-2 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            Zobraziť všetky výsledky
                                            <ArrowRight size={12} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {showSuggestions && searchQuery.length >= 2 && suggestions.length === 0 && !isSearching && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-background/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl z-50">
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <Sparkles className="w-5 h-5 text-muted-foreground/40" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Žiadna zhoda</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <Link href="/" className="flex items-center gap-3 px-8 md:px-0" onClick={() => setIsMenuOpen(false)} suppressHydrationWarning>
                        <span className="flex items-center gap-3 group" suppressHydrationWarning>
                            <span className="font-syne font-extrabold text-2xl md:text-5xl tracking-tighter uppercase
                                bg-gradient-to-r from-foreground via-foreground/50 to-foreground
                                bg-clip-text text-transparent leading-none" suppressHydrationWarning>
                                AIWai
                            </span>
                            <Image
                                src="/aiwai-logo.png"
                                alt="AIWai News Logo"
                                width={200}
                                height={50}
                                className="h-8 md:h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
                                priority
                            />
                        </span>
                        <span className="text-primary font-black text-[10px] md:text-base uppercase tracking-[0.3em] opacity-100 select-none mt-1" suppressHydrationWarning>
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

                    {/* Top Right: User Auth + Theme Toggle */}
                    <div className="absolute right-3 sm:right-4 lg:right-10 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <UserAuthButton />
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
                            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-xl">
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
                                <span className={cn("relative z-10 transition-transform duration-300 ease-in-out", isActive ? "scale-[1.05]" : "scale-100")}>
                                    {category.name}
                                </span>
                            </Link>
                        );
                    })}

                    {/* Mobile auth */}
                    {user ? (
                        <div className="w-11/12 max-w-sm mt-2 border-t border-border/30 pt-4">
                            {(() => {
                                const avatarUrl = user.user_metadata?.avatar_url;
                                const name = user.user_metadata?.full_name || user.email || "Používateľ";
                                const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                                return (
                                    <div className="flex items-center justify-between px-2">
                                        <div className="flex items-center gap-3">
                                            {avatarUrl ? (
                                                <Image src={avatarUrl} alt={name} width={36} height={36} className="w-9 h-9 rounded-full object-cover border-2 border-primary/30" unoptimized />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[11px] font-black text-primary">
                                                    {initials}
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-[11px] font-black text-foreground truncate max-w-[160px]">{name}</p>
                                                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Prihlásený</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { signOut(); setIsMenuOpen(false); }}
                                            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-red-500/20"
                                        >
                                            <LogOut size={13} />
                                            Odhlásiť
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="w-11/12 max-w-sm flex gap-2 mt-2">
                            <Link
                                href="/registracia"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex-1 flex items-center justify-center py-3.5 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all border border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                            >
                                Registrovať
                            </Link>
                            <Link
                                href="/prihlasenie"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all bg-primary text-primary-foreground hover:opacity-85"
                            >
                                <LogIn size={14} />
                                Prihlásiť sa
                            </Link>
                        </div>
                    )}
                </div>
            </header>
        </>
    );
}
