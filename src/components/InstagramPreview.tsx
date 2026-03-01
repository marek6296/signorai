"use client";

import React, { useRef, useState } from 'react';
import { toPng, toBlob } from 'html-to-image';
import { Download, Copy, CheckCircle2, Layout, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';

interface InstagramPreviewProps {
    title: string;
    articleImage?: string;
    category?: string;
    summary?: string;
    date?: string;
    id?: string;
}

export function InstagramPreview({
    title,
    articleImage,
    category = "Umelá Inteligencia",
    summary,
    date,
    id = "instagram-preview-capture"
}: InstagramPreviewProps) {
    const previewRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [scale, setScale] = React.useState(0.37037);
    const [variant, setVariant] = useState<'ai' | 'card'>('ai');

    const displayDate = date
        ? format(parseISO(date), "d. MMMM yyyy", { locale: sk })
        : format(new Date(), "d. MMMM yyyy", { locale: sk });

    React.useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth;
                setScale(width / 1080);
            }
        };

        const resizeObserver = new ResizeObserver(updateScale);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        updateScale();
        return () => resizeObserver.disconnect();
    }, []);

    const onDownload = async () => {
        if (previewRef.current === null) return;
        try {
            const dataUrl = await toPng(previewRef.current, {
                cacheBust: true,
                width: 1080,
                height: 1080,
                pixelRatio: 1,
            });
            const link = document.createElement('a');
            link.download = `postovinky-social-${variant}-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('oops, something went wrong!', err);
        }
    };

    const onCopy = async () => {
        if (previewRef.current === null) return;
        try {
            const blob = await toBlob(previewRef.current, {
                cacheBust: true,
                width: 1080,
                height: 1080,
                pixelRatio: 1,
            });
            if (blob) {
                const item = new ClipboardItem({ [blob.type]: blob });
                await navigator.clipboard.write([item]);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            }
        } catch (err) {
            console.error('Failed to copy image:', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex bg-muted/40 p-1 rounded-2xl border border-white/5 w-fit">
                    <button
                        onClick={() => setVariant('ai')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            variant === 'ai' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"
                        )}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Vizuál
                    </button>
                    <button
                        onClick={() => setVariant('card')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            variant === 'card' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"
                        )}
                    >
                        <Layout className="w-3.5 h-3.5" />
                        News Card
                    </button>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCopy}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-white/5",
                            isCopied
                                ? "bg-green-500 text-white border-green-400"
                                : "bg-white/[0.03] hover:bg-white/[0.08] text-foreground"
                        )}
                    >
                        {isCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {isCopied ? "OK!" : "Copy"}
                    </button>
                    <button
                        onClick={onDownload}
                        className="flex items-center gap-1.5 bg-white text-black px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-sm"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Save
                    </button>
                </div>
            </div>

            {/* The Actual Post container - fixed size for preview */}
            <div
                ref={containerRef}
                className="relative overflow-hidden rounded-[40px] border shadow-2xl bg-black aspect-square max-w-[400px] mx-auto ring-1 ring-white/10"
            >
                <div style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    width: '1080px',
                    height: '1080px'
                }}>
                    <div
                        ref={previewRef}
                        id={id}
                        className="w-[1080px] h-[1080px] bg-black relative flex items-center justify-center overflow-hidden"
                    >
                        {variant === 'ai' ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-20 relative">
                                {/* Top Logo - Matched to Header */}
                                <div className="absolute top-[120px] left-0 right-0 flex items-baseline justify-center gap-3 z-10">
                                    <span className="font-syne font-extrabold text-[56px] tracking-tighter uppercase text-white">
                                        POSTOVINKY
                                    </span>
                                    <span className="text-primary font-black text-[16px] uppercase tracking-[0.3em] opacity-80 translate-y-[-4px]">
                                        News
                                    </span>
                                </div>

                                {/* Centered Content */}
                                <div className="relative z-10 text-center max-w-[900px]">
                                    <div className="w-24 h-1.5 bg-white mb-10 mx-auto rounded-full opacity-90" />
                                    <h2 className="text-[70px] font-black leading-[1.15] text-white uppercase tracking-[-0.01em] [word-spacing:0.15em]">
                                        {title}
                                    </h2>
                                    <div className="w-24 h-1.5 bg-white mt-10 mx-auto rounded-full opacity-90" />
                                </div>

                                {/* Bottom URL */}
                                <div className="absolute bottom-[100px] left-0 right-0 text-center z-10">
                                    <div className="bg-white text-black px-12 py-5 inline-block rounded-full font-black text-[26px] tracking-[0.15em] uppercase shadow-2xl">
                                        www.postovinky.news
                                    </div>
                                </div>

                                {/* Background Accents for depth */}
                                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2 z-0" />
                                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/20 blur-[200px] rounded-full translate-y-1/2 -translate-x-1/2 z-0" />
                            </div>
                        ) : (
                            <div className="w-full h-full relative p-0 overflow-hidden bg-black">
                                {articleImage ? (
                                    <img
                                        src={`${articleImage}${articleImage.includes('?') ? '&' : '?'}capture-v=2`}
                                        alt={title}
                                        className="w-full h-full object-cover"
                                        crossOrigin="anonymous"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                        <Sparkles className="w-24 h-24 text-zinc-800" />
                                    </div>
                                )}

                                {/* Dark Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />

                                {/* Category Badge - Top Left */}
                                <div className="absolute top-[60px] left-[60px] z-20">
                                    <span className="inline-flex items-center rounded-[24px] bg-black/60 backdrop-blur-xl border border-white/20 px-8 py-4 text-[20px] font-black uppercase tracking-[0.2em] text-white shadow-2xl">
                                        {category}
                                    </span>
                                </div>

                                {/* Content Overlay - Glassmorphism at Bottom */}
                                <div className="absolute bottom-[60px] left-[60px] right-[60px] z-20">
                                    <div className="bg-black/50 backdrop-blur-3xl border border-white/10 rounded-[48px] p-12 flex flex-col items-start text-left shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                                        <time className="text-[18px] font-bold text-white/50 uppercase tracking-[0.2em] mb-4">
                                            {displayDate}
                                        </time>
                                        <h2 className="text-[52px] font-black tracking-tight text-white leading-tight mb-6 uppercase">
                                            {title}
                                        </h2>
                                        <p className="text-[24px] text-zinc-300 font-medium leading-relaxed line-clamp-2">
                                            {summary || title}
                                        </p>
                                    </div>
                                </div>

                                {/* Brand URL Small Seal */}
                                <div className="absolute top-[60px] right-[60px] z-10">
                                    <div className="bg-white/10 backdrop-blur-md rounded-full px-6 py-2 border border-white/10">
                                        <span className="text-white/40 text-[14px] font-black uppercase tracking-widest">postovinky.news</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <p className="text-center text-[10px] text-muted-foreground font-medium italic">
                Tip: Vyberte si štýl príspevku a potom kliknite na Skopírovať alebo Save.
            </p>
        </div>
    );
}
