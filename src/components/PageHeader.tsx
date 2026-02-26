import React from 'react';

interface PageHeaderProps {
    title: string;
    description: string;
    label?: string;
}

export function PageHeader({ title, description, label = "Postovinky" }: PageHeaderProps) {
    return (
        <div className="relative mb-6">
            {/* Box without continuous borders or backgrounds, just the corner brackets */}
            <div className="relative py-8 px-6 md:py-10 md:px-12 flex flex-col items-center text-center">

                {/* Plynulé viditeľné svetlo prispôsobené pre všetky režimy */}
                <div
                    className="absolute inset-0 w-full h-full pointer-events-none rounded-[1.5rem] animate-pan-bg bg-gradient-to-r from-transparent via-black/20 dark:via-white/25 [.colorful_&]:via-primary/25 to-transparent"
                    style={{ backgroundSize: "200% 100%" }}
                />

                {/* Top Label */}
                <div className="relative z-10 mb-6">
                    <span className="px-4 py-1.5 rounded-full border border-primary/20 text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/80">
                        {label}
                    </span>
                </div>

                {/* Title */}
                <h1 className="relative z-10 text-4xl md:text-5xl lg:text-5xl font-black tracking-tighter uppercase leading-[1.1] mb-4 text-foreground">
                    {title}
                </h1>

                {/* Description */}
                <p className="relative z-10 text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed font-medium">
                    {description}
                </p>
            </div>
        </div>
    );
}
