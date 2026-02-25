import React from 'react';

interface PageHeaderProps {
    title: string;
    description: string;
    label?: string;
}

export function PageHeader({ title, description, label = "Signorai" }: PageHeaderProps) {
    return (
        <div className="relative mb-20">
            {/* Framed Container */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-muted/30 border border-border/50 p-12 md:p-20 flex flex-col items-center text-center">
                {/* Subtle Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

                {/* Top Label */}
                <div className="relative z-10 mb-6">
                    <span className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                        {label}
                    </span>
                </div>

                {/* Title */}
                <h1 className="relative z-10 text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase leading-[0.8] mb-8">
                    {title}
                </h1>

                {/* Divider */}
                <div className="relative z-10 w-16 h-1 bg-primary rounded-full mb-8 shadow-[0_0_15px_rgba(var(--primary),0.5)]" />

                {/* Description */}
                <p className="relative z-10 text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
                    {description}
                </p>

                {/* Decorative corner elements (very subtle) */}
                <div className="absolute top-8 left-8 w-4 h-4 border-t-2 border-l-2 border-primary/20 rounded-tl-sm" />
                <div className="absolute top-8 right-8 w-4 h-4 border-t-2 border-r-2 border-primary/20 rounded-tr-sm" />
                <div className="absolute bottom-8 left-8 w-4 h-4 border-b-2 border-l-2 border-primary/20 rounded-bl-sm" />
                <div className="absolute bottom-8 right-8 w-4 h-4 border-b-2 border-r-2 border-primary/20 rounded-br-sm" />
            </div>
        </div>
    );
}
