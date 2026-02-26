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
            const dataUrl = await toPng(previewRef.current, { cacheBust: true });
            const link = document.createElement('a');
            link.download = `fb-ig-post-${Date.now()}.png`;
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
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20"
                >
                    <Download className="w-4 h-4" />
                    Stiahnuť obrázok
                </button>
            </div>

            {/* The Actual Post to be converted to image */}
            <div className="overflow-hidden rounded-[32px] border shadow-2xl bg-zinc-900 aspect-square max-w-[400px] mx-auto">
                <div
                    ref={previewRef}
                    className="w-[1080px] h-[1080px] bg-black relative flex items-center justify-center p-20"
                    style={{
                        // Scale it down for display in the admin panel
                        transform: 'scale(0.37037)', // 400 / 1080
                        transformOrigin: 'top left',
                        width: '1080px',
                        height: '1080px',
                        position: 'absolute'
                    }}
                >
                    {/* Branded Frame */}
                    <div className="absolute inset-0 border-[40px] border-primary/20" />
                    <div className="absolute inset-10 border-[2px] border-primary/40" />

                    {/* Top Logo */}
                    <div className="absolute top-[120px] left-0 right-0 text-center">
                        <div className="text-[42px] font-black tracking-[0.5em] text-white/40 uppercase">
                            Postovinky
                        </div>
                    </div>

                    {/* Centered Content */}
                    <div className="relative z-10 text-center max-w-[800px]">
                        <div className="w-24 h-1 bg-primary mb-12 mx-auto rounded-full" />
                        <h2 className="text-[72px] font-black leading-[1.1] text-white uppercase tracking-tighter">
                            {title}
                        </h2>
                        <div className="w-24 h-1 bg-primary mt-12 mx-auto rounded-full" />
                    </div>

                    {/* Bottom URL */}
                    <div className="absolute bottom-[100px] left-0 right-0 text-center">
                        <div className="bg-primary text-black px-10 py-4 inline-block rounded-full font-black text-[24px] tracking-[0.1em] uppercase shadow-2xl">
                            www.postovinky.news
                        </div>
                    </div>

                    {/* Corner Accent */}
                    <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/10 blur-[150px] rounded-full translate-y-1/2 -translate-x-1/2" />
                </div>

                {/* Spacer for the absolute element above */}
                <div className="w-full h-full" />
            </div>

            <p className="text-center text-[10px] text-muted-foreground font-medium italic">
                Tip: Tento obrázok je presne vo formáte 1080x1080 pre Instagram a Facebook.
            </p>
        </div>
    );
}
