import Link from "next/link";

export default function AboutPage() {
    return (
        <div className="container mx-auto max-w-4xl px-4 py-20 lg:py-32">
            {/* Header */}
            <div className="space-y-6 mb-16 text-center">
                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight font-syne italic">
                    Náš príbeh
                </h1>
                <div className="h-1 w-20 bg-primary mx-auto" />
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    Sme POSTOVINKY – váš digitálny sprievodca svetom, kde umelá inteligencia už nie je hudbou budúcnosti, ale realitou dneška.
                </p>
            </div>

            {/* Content Section */}
            <div className="space-y-12 text-lg leading-relaxed text-muted-foreground">
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground font-syne">Prečo sme vznikli?</h2>
                    <p>
                        Umelá inteligencia mení svet rýchlejšie ako akákoľvek technológia predtým. Naším poslaním je prinášať vám tie najrelevantnejšie správy, analýzy a trendy v slovenskom jazyku, aby ste boli vždy o krok vpred.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground font-syne">Čo u nás nájdete?</h2>
                    <p>
                        Od revolučných objavov v Large Language Models až po praktické nástroje, ktoré vám uľahčia prácu a podnikanie. Sledujeme nielen technickú stránku, ale aj etické a spoločenské dopady technológií.
                    </p>
                </section>

                <section className="p-8 rounded-2xl bg-muted/50 border border-border/50 space-y-4">
                    <h2 className="text-2xl font-bold text-foreground font-syne italic text-center">Naša vízia</h2>
                    <p className="text-center italic">
                        {"\""}Veríme, že digitálna éra by mala patriť všetkým, ktorí sú zvedaví. Cieľom POSTOVINKY je byť mostom medzi komplexnou technológiou a koncovým čitateľom.{"\""}
                    </p>
                </section>

                <div className="pt-8 text-center">
                    <Link
                        href="/kontakt"
                        className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-primary text-primary-foreground font-bold hover:scale-105 transition-transform"
                    >
                        Chcete s nami spolupracovať?
                    </Link>
                </div>
            </div>
        </div>
    );
}
