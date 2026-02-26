import type { Metadata } from "next";

const BASE_URL = "https://postovinky.news";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Kontaktujte redakciu Postovinky. Máte otázku, nápad na spoluprácu alebo nám chcete napísať? Sme tu pre vás.",
  alternates: { canonical: `${BASE_URL}/kontakt` },
  openGraph: {
    title: "Kontakt | Postovinky",
    description: "Napíšte nám – redakcia@postovinky.sk, Bratislava.",
    url: `${BASE_URL}/kontakt`,
    siteName: "Postovinky",
    locale: "sk_SK",
  },
};

export default function ContactPage() {
    return (
        <div className="container mx-auto max-w-5xl px-4 py-20 lg:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

                {/* Left Side: Text and Info */}
                <div className="space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight font-syne italic">
                            Kontakt
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            Máte otázku, nápad na spoluprácu alebo nám chcete len napísať? Sme tu pre vás.
                        </p>
                    </div>

                    <div className="space-y-6 pt-8 text-lg font-medium">
                        <div className="flex items-center gap-4 group">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">Email</p>
                                <p className="text-foreground">redakcia@postovinky.sk</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 group">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">Kancelária</p>
                                <p className="text-foreground">Bratislava, Slovensko</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Simple Contact Form (UI only) */}
                <div className="bg-muted/30 border border-border/50 p-8 md:p-12 rounded-3xl space-y-6 backdrop-blur-sm shadow-2xl shadow-primary/5">
                    <form className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground ml-1">Vaše meno</label>
                            <input
                                type="text"
                                placeholder="Jozef Mrkva"
                                className="w-full bg-background border border-border px-5 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground ml-1">Váš Email</label>
                            <input
                                type="email"
                                placeholder="jozef@gmail.com"
                                className="w-full bg-background border border-border px-5 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground ml-1">Správa</label>
                            <textarea
                                rows={4}
                                placeholder="Ako vám môžeme pomôcť?"
                                className="w-full bg-background border border-border px-5 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium resize-none"
                            ></textarea>
                        </div>
                        <button className="w-full bg-foreground text-background font-bold py-4 rounded-xl hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                            Odoslať správu
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
