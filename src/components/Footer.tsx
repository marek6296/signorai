import Link from "next/link";

export function Footer() {
    return (
        <footer className="border-t py-12 bg-muted/40 mt-16">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-4">
                        <span className="font-black text-3xl md:text-4xl tracking-widest uppercase">
                            POSTOVINKY
                        </span>
                        <p className="text-sm text-muted-foreground">
                            Váš prémiový zdroj pre najnovšie správy zo sveta technologického pokroku a umelej inteligencie.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-4">Kategórie</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/" className="hover:text-foreground">Najnovšie</Link></li>
                            <li><Link href="/kategoria/ai" className="hover:text-foreground">Umelá Inteligencia</Link></li>
                            <li><Link href="/kategoria/tech" className="hover:text-foreground">Tech</Link></li>
                            <li><Link href="/kategoria/biznis" className="hover:text-foreground">Biznis</Link></li>
                            <li><Link href="/kategoria/krypto" className="hover:text-foreground">Krypto</Link></li>
                            <li><Link href="/kategoria/svet-politika" className="hover:text-foreground">Svet & Politika</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-4">Informácie</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/o-nas" className="hover:text-foreground">O nás</Link></li>
                            <li><Link href="/kontakt" className="hover:text-foreground">Kontakt</Link></li>
                            <li><Link href="/ochrana-sukromia" className="hover:text-foreground">Ochrana súkromia</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-4">Sledujte nás</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><a href="#" className="hover:text-foreground">Twitter</a></li>
                            <li><a href="#" className="hover:text-foreground">Facebook</a></li>
                            <li><a href="#" className="hover:text-foreground">Instagram</a></li>
                        </ul>
                    </div>
                </div>
                <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} POSTOVINKY. Všetky práva vyhradené.</p>
                </div>
            </div>
        </footer>
    );
}
