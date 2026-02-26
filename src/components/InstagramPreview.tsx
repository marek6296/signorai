"use client";

import React, { useRef } from 'react';
import { toPng } from 'html-to-image';
import { Download, Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InstagramPreviewProps {
    title: string;
    articleImage?: string;
}

export function InstagramPreview({ title }: InstagramPreviewProps) {
    const previewRef = useRef<HTMLDivElement>(null);

    const onDownload = async () => {
        if (previewRef.current === null) {
            return;
        }

        try {
            // Options to ensure high quality and correct size
            const dataUrl = await toPng(previewRef.current, {
                cacheBust: true,
                width: 1080,
                height: 1080,
                pixelRatio: 1
            });
            const link = document.createElement('a');
            link.download = `postovinky-social-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('oops, something went wrong!', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Vizuálny náhľad (1080x1080)</span>
                <button
                    onClick={onDownload}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20"
                >
                    <Download className="w-4 h-4" />
                    Stiahnuť obrázok
                </button>
            </div>

            {/* The Actual Post container - fixed size for preview */}
            <div className="relative overflow-hidden rounded-[40px] border shadow-2xl bg-black aspect-square max-w-[400px] mx-auto ring-1 ring-white/10">
                {/* 
                    This wrapper handles the scaling for display.
                    The inner div (previewRef) stays at 1080x1080 so html-to-image captures it correctly.
                */}
                <div style={{
                    transform: 'scale(0.37037)', // 400 / 1080
                    transformOrigin: 'top left',
                    width: '1080px',
                    height: '1080px'
                }}>
                    <div
                        ref={previewRef}
                        className="w-[1080px] h-[1080px] bg-black relative flex items-center justify-center p-20 overflow-hidden"
                    >
                        {/* Branded Frame */}
                        <div className="absolute inset-0 border-[40px] border-primary/20 z-0" />
                        <div className="absolute inset-10 border-[2px] border-primary/40 z-0" />

                        {/* Top Logo */}
                        <div className="absolute top-[120px] left-0 right-0 text-center z-10">
                            <div className="text-[42px] font-black tracking-[0.5em] text-white/40 uppercase">
                                Postovinky
                            </div>
                        </div>

                        {/* Centered Content */}
                        <div className="relative z-10 text-center max-w-[850px]">
                            <div className="w-32 h-1.5 bg-primary mb-16 mx-auto rounded-full" />
                            <h2 className="text-[78px] font-black leading-[1.1] text-white uppercase tracking-tighter">
                                {title}
                            </h2>
                            <div className="w-32 h-1.5 bg-primary mt-16 mx-auto rounded-full" />
                        </div>

                        {/* Bottom URL */}
                        <div className="absolute bottom-[100px] left-0 right-0 text-center z-10">
                            <div className="bg-primary text-black px-12 py-5 inline-block rounded-full font-black text-[26px] tracking-[0.15em] uppercase shadow-2xl">
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
