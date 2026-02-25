import React from 'react';

interface PageHeaderProps {
    title: string;
    description: string;
    category?: string;
}

export function PageHeader({ title, description, category }: PageHeaderProps) {
    return (
        <div className="relative mb-20 md:mb-24 py-12 md:py-20 overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/10 blur-[120px] rounded-full opacity-50" />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center px-4">
                {/* Top Decorative Line & Label */}
                <div className="flex items-center justify-center gap-4 mb-8">
                    <div className="h-px w-8 md:w-12 bg-primary/30" />
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-primary whitespace-nowrap">
                        {category || "Signorai Intelligence"}
                    </span>
                    <div className="h-px w-8 md:w-12 bg-primary/30" />
                </div>

                {/* The Big Title with Gradient */}
                <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-8 uppercase leading-[0.9] text-transparent bg-clip-text bg-gradient-to-b from-foreground via-foreground to-foreground/40 italic">
                    {title}
                </h1>

                {/* Centered Decorative Bar */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    <div className="w-16 h-1 bg-gradient-to-r from-primary to-transparent rounded-full" />
                    <div className="w-1 h-1 rounded-full bg-primary/50" />
                </div>

                {/* Description */}
                <p className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed balance">
                    {description}
                </p>
            </div>

            {/* Extreme Corner Decorations */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-primary/20 rounded-tl-xl hidden md:block" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-primary/20 rounded-tr-xl hidden md:block" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-primary/20 rounded-bl-xl hidden md:block" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-primary/20 rounded-br-xl hidden md:block" />
        </div>
    );
}
