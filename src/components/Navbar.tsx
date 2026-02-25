import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

const categories = [
    { name: "Najnovšie", href: "/" },
    { name: "Umelá Inteligencia", href: "/kategoria/ai" },
    { name: "Tech", href: "/kategoria/tech" },
    { name: "Biznis", href: "/kategoria/biznis" },
    { name: "Krypto", href: "/kategoria/krypto" },
    { name: "Svet & Politika", href: "/kategoria/svet-politika" },
    { name: "Veda", href: "/kategoria/veda" },
    { name: "Návody & Tipy", href: "/kategoria/navody" },
    { name: "Newsletter", href: "/newsletter" },
];

export function Navbar() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex flex-col items-center justify-center py-4 relative px-4 sm:px-6 lg:px-8">
                {/* Center: Brand Logo */}
                <Link href="/" className="mb-4">
                    <span className="font-black text-4xl md:text-5xl lg:text-6xl tracking-widest uppercase">
                        SIGNORAI
                    </span>
                </Link>

                <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm font-medium mt-2">
                    {categories.map((category) => (
                        <Link
                            key={category.name}
                            href={category.href}
                            className="transition-colors hover:text-foreground/80 text-foreground/60 uppercase tracking-wider text-xs font-bold"
                        >
                            {category.name}
                        </Link>
                    ))}
                </nav>

                {/* Top Right: Actions */}
                <div className="absolute right-4 sm:right-6 lg:right-8 top-4 flex items-center gap-2">
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
