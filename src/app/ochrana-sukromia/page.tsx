export default function PrivacyPage() {
    return (
        <div className="container mx-auto max-w-4xl px-4 py-20 lg:py-32">
            <div className="space-y-8 mb-16">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight font-syne">
                    Ochrana osobných údajov
                </h1>
                <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest">
                    Posledná aktualizácia: {new Date().toLocaleDateString('sk-SK')}
                </p>
                <div className="h-px w-full bg-border/50" />
            </div>

            <div className="prose prose-invert max-w-none space-y-12 text-muted-foreground leading-relaxed">
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground font-syne">1. Úvodné informácie</h2>
                    <p>
                        Vaše súkromie je pre nás prioritou. Tento dokument vysvetľuje, ako POSTOVINKY ({'\"'}my{'\"'}, {'\"'}nás{'\"'} alebo {'\"'}portál{'\"'}) zhromažďujú, používajú a chránia vaše osobné údaje pri návšteve našej webovej stránky.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground font-syne">2. Aké údaje zbierame?</h2>
                    <p>
                        Zbierame údaje, ktoré nám dobrovoľne poskytnete (napríklad pri registrácii do newslettera), a údaje, ktoré sa zbierajú automaticky prostredníctvom súborov cookies:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Meno a e-mailová adresa (pri odbere noviniek).</li>
                        <li>Technické údaje: IP adresa, typ prehliadača, operačný systém.</li>
                        <li>Analytické údaje: správanie na stránke, čas strávený čítaním článkov.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground font-syne">3. Účel spracovania</h2>
                    <p>
                        Vaše údaje používame výhradne na:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Zabezpečenie prevádzky a optimalizáciu webu.</li>
                        <li>Zasielanie informácií o nových článkoch a trendoch v AI (ak ste súhlasili).</li>
                        <li>Analýzu návštevnosti pre zlepšenie nášho obsahu.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground font-syne">4. Vaše práva</h2>
                    <p>
                        V súlade s nariadením GDPR máte právo na prístup k svojim údajom, právo na opravu, vymazanie (právo na {'\"'}zabudnutie{'\"'}) a právo kedykoľvek odvolať svoj súhlas so spracovaním.
                    </p>
                </section>

                <section className="p-8 rounded-2xl bg-muted/30 border border-border/50">
                    <h2 className="text-xl font-bold text-foreground font-syne mb-2">Máte otázky?</h2>
                    <p className="text-sm">
                        Ak máte akékoľvek otázky týkajúce sa vašich údajov, napíšte nám na <span className="text-primary font-bold">redakcia@postovinky.sk</span>.
                    </p>
                </section>
            </div>
        </div>
    );
}
