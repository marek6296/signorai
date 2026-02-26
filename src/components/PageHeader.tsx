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
            <div className="relative pt-2 pb-8 px-6 md:pt-4 md:pb-10 md:px-12 flex flex-col items-center text-center">


                {/* Top Label */}
                <div className="relative z-10 mb-6">
                    <span className="px-4 py-1.5 rounded-full border border-primary/20 text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/80">
                        {label}
                    </span>
                </div>

                {/* Title */}
                <h1 className="relative z-10 text-4xl md:text-5xl lg:text-5xl font-black tracking-tighter uppercase leading-[1.1] mb-4 text-foreground opacity-70">
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
