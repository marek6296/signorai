"use client";

import React, { useRef, useState } from 'react';
import { toPng, toBlob } from 'html-to-image';
import { Download, Copy, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InstagramPreviewProps {
    title: string;
    articleImage?: string;
    id?: string;
}

export function InstagramPreview({ title, id = "instagram-preview-capture" }: InstagramPreviewProps) {
    const previewRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [scale, setScale] = React.useState(0.37037);

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
            link.download = `postovinky-social-${Date.now()}.png`;
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
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Vizuálny náhľad (1080x1080)</span>
                <div className="flex gap-2">
                    <button
                        onClick={onCopy}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-all shadow-sm",
                            isCopied
                                ? "bg-green-500 text-white"
                                : "bg-muted hover:bg-muted/80 text-foreground"
                        )}
                    >
                        {isCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {isCopied ? "Skopírované!" : "Kopírovať obrázok"}
                    </button>
                    <button
                        onClick={onDownload}
                        className="flex items-center gap-1.5 bg-primary text-primary-foreground px-2.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide hover:opacity-90 transition-all shadow-sm"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Stiahnuť
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
                        className="w-[1080px] h-[1080px] bg-black relative flex items-center justify-center p-20 overflow-hidden"
                    >
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
                </div>
            </div>

            <p className="text-center text-[10px] text-muted-foreground font-medium italic">
                Tip: Tento obrázok je presne vo formáte 1080x1080 pre Instagram a Facebook.
            </p>
        </div>
    );
}
