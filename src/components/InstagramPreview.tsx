"use client";

import React, { useRef, useState, useEffect } from 'react';
import { toPng, toBlob } from 'html-to-image';
import { Download, Copy, CheckCircle2, Layers, ImageIcon, Wand2, PenLine, X, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';

interface InstagramPreviewProps {
    title: string;
    articleImage?: string;
    category?: string;
    summary?: string;
    date?: string;
    id?: string;
    articleId?: string;
    onImageUpdate?: (url: string) => void;
    /** If provided, clicking Save calls this (server-side render) instead of html-to-image.
     *  Receives current variant and currentImageUrl, returns a URL (absolute or relative) to download or null. */
    onSaveAndRender?: (variant: 'studio' | 'photo', currentImageUrl: string) => Promise<string | null>;
}

export function InstagramPreview({
    title,
    articleImage,
    category = "AI",
    summary,
    date,
    id = "instagram-preview-capture",
    articleId,
    onImageUpdate,
    onSaveAndRender,
}: InstagramPreviewProps) {
    const previewRef  = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isCopied,   setIsCopied]   = useState(false);
    const [scale,      setScale]      = useState(0.37037);
    const [variant,    setVariant]    = useState<'studio' | 'photo'>('studio');
    const [usePhotoBg, setUsePhotoBg] = useState(false);

    // Image management
    const [currentImg,    setCurrentImg]    = useState(articleImage || '');
    const [base64Img,     setBase64Img]     = useState<string>('');
    const [imgReady,      setImgReady]      = useState(false);

    // Download state
    const [isDownloading,  setIsDownloading]  = useState(false);

    // Generate / Edit
    const [isGenerating,   setIsGenerating]   = useState(false);
    const [showEditPrompt, setShowEditPrompt] = useState(false);
    const [editPrompt,     setEditPrompt]     = useState('');
    const [isEditing,      setIsEditing]      = useState(false);

    const displayDate = date
        ? format(parseISO(date), "d. MMMM yyyy", { locale: sk })
        : format(new Date(), "d. MMMM yyyy", { locale: sk });

    // Sync currentImg when prop changes
    useEffect(() => {
        setCurrentImg(articleImage || '');
    }, [articleImage]);

    // Convert image to base64 via server-side proxy to avoid CORS canvas-taint issues
    useEffect(() => {
        if (!currentImg) { setBase64Img(''); setImgReady(true); return; }
        setImgReady(false);
        (async () => {
            try {
                // Route through our server-side proxy so we get proper CORS headers
                // regardless of the image origin (Supabase, Gemini, external CDN…)
                const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(currentImg)}&t=${Date.now()}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error(`proxy ${res.status}`);
                const blob = await res.blob();
                const b64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror  = reject;
                    reader.readAsDataURL(blob);
                });
                setBase64Img(b64);
            } catch {
                // fallback: use original URL — displays fine but html-to-image may omit it
                setBase64Img(currentImg);
            } finally {
                setImgReady(true);
            }
        })();
    }, [currentImg]);

    // Scale to fit container
    useEffect(() => {
        const update = () => { if (containerRef.current) setScale(containerRef.current.offsetWidth / 1080); };
        const ro = new ResizeObserver(update);
        if (containerRef.current) ro.observe(containerRef.current);
        update();
        return () => ro.disconnect();
    }, []);

    const captureOpts = { cacheBust: true, width: 1080, height: 1080, pixelRatio: 1 };

    const onDownload = async () => {
        setIsDownloading(true);
        try {
            if (onSaveAndRender) {
                // Server-side render (preserves backgrounds perfectly)
                const renderUrl = await onSaveAndRender(variant, currentImg);
                if (renderUrl) {
                    // Local API route or external URL — fetch and force-download as blob
                    const fetchUrl = renderUrl.startsWith('/')
                        ? renderUrl  // local route, fetch directly
                        : `/api/proxy-image?url=${encodeURIComponent(renderUrl)}&t=${Date.now()}`; // external URL via proxy
                    try {
                        const res = await fetch(fetchUrl);
                        if (res.ok) {
                            const blob = await res.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.download = `aiwai-${variant}-${Date.now()}.png`;
                            a.href = blobUrl;
                            a.click();
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                            return;
                        }
                    } catch { /* fallthrough */ }
                    // Last-resort: open URL directly
                    window.open(renderUrl, '_blank');
                    return;
                }
            }
            // Fallback: html-to-image
            if (!previewRef.current) return;
            const url = await toPng(previewRef.current, captureOpts);
            const a = document.createElement('a');
            a.download = `aiwai-${variant}-${Date.now()}.png`;
            a.href = url; a.click();
        } finally {
            setIsDownloading(false);
        }
    };

    const onCopy = async () => {
        if (!previewRef.current) return;
        const blob = await toBlob(previewRef.current, captureOpts);
        if (blob) {
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    // Generate new image via Gemini
    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/admin/article-image-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, excerpt: summary || title }),
            });
            const data = await res.json();
            if (res.ok && data.imageUrl) {
                setCurrentImg(data.imageUrl);
                onImageUpdate?.(data.imageUrl);
                // Save to article in Supabase
                if (articleId) {
                    await supabase.from('articles').update({ main_image: data.imageUrl }).eq('id', articleId);
                }
            }
        } catch { /* noop */ }
        finally { setIsGenerating(false); }
    };

    // Edit image with prompt via Gemini
    const handleEdit = async () => {
        if (!editPrompt.trim() || !currentImg) return;
        setIsEditing(true);
        try {
            const res = await fetch('/api/admin/social-image-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: currentImg, prompt: editPrompt }),
            });
            const data = await res.json();
            if (res.ok && data.imageUrl) {
                setCurrentImg(data.imageUrl);
                onImageUpdate?.(data.imageUrl);
                if (articleId) {
                    await supabase.from('articles').update({ main_image: data.imageUrl }).eq('id', articleId);
                }
                setShowEditPrompt(false);
                setEditPrompt('');
            }
        } catch { /* noop */ }
        finally { setIsEditing(false); }
    };

    // src used inside the captured canvas — always base64 for reliability
    const imgSrc = base64Img || currentImg;

    // Dynamic font sizes
    const titleLen = title.length;
    const studioSize = titleLen > 80 ? 52 : titleLen > 60 ? 60 : titleLen > 40 ? 68 : 76;
    const photoSize  = titleLen > 80 ? 46 : titleLen > 60 ? 54 : titleLen > 40 ? 62 : 68;

    // Shared absolute-fill style (avoids `inset` shorthand which can be unreliable)
    const fill: React.CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' };

    return (
        <div className="space-y-4">

            {/* ── Top controls ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Style tabs */}
                    <div className="flex bg-muted/40 p-1 rounded-2xl border border-white/5">
                        {(['studio', 'photo'] as const).map(v => (
                            <button key={v} onClick={() => setVariant(v)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    variant === v ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"
                                )}
                            >
                                {v === 'studio' ? <Layers className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                                {v === 'studio' ? 'Studio' : 'Photo'}
                            </button>
                        ))}
                    </div>

                    {/* Foto BG toggle (Studio only) */}
                    {variant === 'studio' && (
                        <button
                            onClick={() => currentImg && setUsePhotoBg(p => !p)}
                            disabled={!currentImg}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                usePhotoBg && currentImg
                                    ? "bg-white/15 text-white border-white/30"
                                    : "text-zinc-600 border-white/5 hover:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed"
                            )}
                        >
                            <ImageIcon className="w-3.5 h-3.5" /> Foto BG
                        </button>
                    )}
                </div>

                {/* Copy / Save */}
                <div className="flex gap-2">
                    <button onClick={onCopy} disabled={!imgReady}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border",
                            isCopied ? "bg-green-500 text-white border-green-400"
                                     : "bg-white/[0.03] hover:bg-white/[0.08] text-foreground border-white/5 disabled:opacity-40"
                        )}
                    >
                        {isCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {isCopied ? "OK!" : "Copy"}
                    </button>
                    <button onClick={onDownload} disabled={!imgReady || isDownloading}
                        className="flex items-center gap-1.5 bg-white text-black px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-sm disabled:opacity-40"
                    >
                        {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {isDownloading ? '...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* ── Canvas preview ── */}
            <div ref={containerRef}
                className="relative overflow-hidden rounded-[24px] border border-white/10 shadow-2xl bg-black aspect-square w-full max-w-[360px] mx-auto ring-1 ring-white/5"
            >
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 1080, height: 1080 }}>
                    <div
                        ref={previewRef} id={id} data-ready={imgReady} data-variant={variant}
                        style={{ width: 1080, height: 1080, position: 'relative', overflow: 'hidden', backgroundColor: '#000', fontFamily: 'system-ui,-apple-system,sans-serif' }}
                    >

                        {/* ══ STUDIO ══ */}
                        {variant === 'studio' && (
                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>

                                {/* Background */}
                                {usePhotoBg && imgSrc ? (
                                    <>
                                        {/* Use CSS backgroundImage instead of <img> — html-to-image inlines data URLs
                                            in CSS reliably without re-fetching, avoiding CORS canvas taint */}
                                        <div style={{
                                            ...fill,
                                            backgroundImage: `url(${imgSrc})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            filter: 'blur(6px)',
                                            transform: 'scale(1.08)',
                                        }} />
                                        <div style={{ ...fill, backgroundColor: 'rgba(0,0,0,0.82)' }} />
                                    </>
                                ) : (
                                    <>
                                        <div style={{ position: 'absolute', top: -250, right: -250, width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(110,60,220,0.3) 0%, transparent 65%)' }} />
                                        <div style={{ position: 'absolute', bottom: -300, left: -250, width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(40,80,220,0.25) 0%, transparent 65%)' }} />
                                    </>
                                )}

                                {/* Mini wordmark */}
                                <div style={{ position: 'absolute', top: 64, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, zIndex: 10 }}>
                                    <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
                                    <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '0.55em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>AIWAI · NEWS</span>
                                    <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
                                </div>

                                {/* Big logo */}
                                <div style={{ position: 'absolute', top: 108, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 14, zIndex: 10 }}>
                                    <span style={{ fontSize: 108, fontWeight: 900, letterSpacing: '-0.04em', textTransform: 'uppercase', color: '#fff', lineHeight: 1 }}>AIWAI</span>
                                    <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', paddingBottom: 14 }}>NEWS</span>
                                </div>

                                {/* Title area */}
                                <div style={{ position: 'absolute', top: 340, bottom: 220, left: 80, right: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                    <div style={{ width: 72, height: 4, background: '#fff', borderRadius: 4, marginBottom: 52 }} />
                                    <div style={{ fontSize: studioSize, fontWeight: 900, lineHeight: 1.12, color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.01em', textAlign: 'center', wordBreak: 'break-word' }}>{title}</div>
                                    <div style={{ width: 72, height: 4, background: '#fff', borderRadius: 4, marginTop: 52 }} />
                                </div>

                                {/* URL pill */}
                                <div style={{ position: 'absolute', bottom: 84, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
                                    <div style={{ background: '#fff', color: '#000', padding: '20px 56px', borderRadius: 100, fontSize: 26, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase' }}>WWW.AIWAI.NEWS</div>
                                </div>
                            </div>
                        )}

                        {/* ══ PHOTO ══ */}
                        {variant === 'photo' && (
                            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>

                                {/* Background image or dark gradient.
                                    CSS backgroundImage is used instead of <img> so that html-to-image can inline
                                    the data URL directly from CSS without re-fetching — avoids CORS canvas taint. */}
                                <div style={{
                                    ...fill,
                                    ...(imgSrc
                                        ? { backgroundImage: `url(${imgSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                                        : { background: 'linear-gradient(135deg,#0d0d1a 0%,#141428 40%,#0a1628 100%)' }
                                    ),
                                }} />

                                {/* Gradient scrim — ensures text is always readable */}
                                <div style={{ ...fill, background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.72) 70%, rgba(0,0,0,0.97) 100%)' }} />

                                {/* Logo */}
                                <div style={{ position: 'absolute', top: 64, left: 64, display: 'flex', alignItems: 'baseline', gap: 10, zIndex: 10 }}>
                                    <span style={{ fontSize: 58, fontWeight: 900, letterSpacing: '-0.04em', textTransform: 'uppercase', color: '#fff', lineHeight: 1 }}>AIWAI</span>
                                    <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', paddingBottom: 10 }}>NEWS</span>
                                </div>

                                {/* Bottom content */}
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 72px 80px', zIndex: 10 }}>
                                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 28 }}>{displayDate}</div>
                                    <div style={{ fontSize: photoSize, fontWeight: 900, lineHeight: 1.1, color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.01em', wordBreak: 'break-word', marginBottom: 40 }}>{title}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ width: 52, height: 4, background: '#fff', borderRadius: 4 }} />
                                        <span style={{ fontSize: 21, fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>WWW.AIWAI.NEWS</span>
                                        <div style={{ width: 52, height: 4, background: '#fff', borderRadius: 4 }} />
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* ── Image actions ── */}
            <div className="flex gap-2 justify-center flex-wrap">
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                    {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {isGenerating ? 'Generujem...' : 'Nový obrázok AI'}
                </button>
                <button
                    onClick={() => setShowEditPrompt(p => !p)}
                    disabled={!currentImg || isEditing}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2.5 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40",
                        showEditPrompt
                            ? "bg-primary/20 border-primary/40 text-primary"
                            : "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                    )}
                >
                    <PenLine className="w-3.5 h-3.5" />
                    Upraviť promptom
                </button>
            </div>

            {/* Edit prompt panel */}
            {showEditPrompt && (
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Wand2 className="w-3.5 h-3.5" /> Úprava obrázka promptom
                    </div>
                    <textarea
                        value={editPrompt}
                        onChange={e => setEditPrompt(e.target.value)}
                        placeholder='Napr. "urob obrázok čiernobiely", "nočná scéna", "pridaj more v pozadí"...'
                        rows={3}
                        className="w-full bg-black/40 border border-primary/20 rounded-xl p-3 text-xs text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-primary/50 transition-colors"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleEdit}
                            disabled={!editPrompt.trim() || isEditing}
                            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-colors"
                        >
                            {isEditing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                            {isEditing ? 'Upravujem...' : 'Aplikovať'}
                        </button>
                        <button
                            onClick={() => { setShowEditPrompt(false); setEditPrompt(''); }}
                            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 rounded-xl text-[10px] font-black flex items-center justify-center transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            <p className="text-center text-[10px] text-muted-foreground">
                Vyber štýl → <strong>Copy</strong> alebo <strong>Save</strong> exportuje 1080 × 1080 px
            </p>
        </div>
    );
}
