import React, { useState, useRef } from 'react';
import { Loader2, Camera, Wand2, PenLine, X, Copy, Check, Save, Edit3, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
export function SocialPostEditorItem({ post, articleTitle, onUpdate }: any) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [hovering, setHovering] = useState(false);
    
    // Image loading states
    const [uploadingImg, setUploadingImg] = useState(false);
    const [generatingImg, setGeneratingImg] = useState(false);
    
    // Edit prompt
    const [showEditPanel, setShowEditPanel] = useState(false);
    const [editText, setEditText] = useState('');
    const [generatingEdit, setGeneratingEdit] = useState(false);

    // Caption edit
    const [editingCaption, setEditingCaption] = useState(false);
    const [editCaptionText, setEditCaptionText] = useState(post.content || '');
    const [savingCaption, setSavingCaption] = useState(false);

    // Display image: fallback to article image if post doesn't have its own
    const displayImage = post.image_url || post.articles?.main_image;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImg(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('postId', post.id);
            const res = await fetch('/api/admin/social-image-upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (res.ok && data.url) {
                onUpdate({ ...post, image_url: data.url });
                alert('Obrázok bol aktualizovaný');
            } else {
                alert(data.error || 'Chyba nahrávania obrázku');
            }
        } catch (err) {
            alert('Sieťová chyba');
        } finally {
            setUploadingImg(false);
        }
    };

    const handleGenerateImage = async () => {
        setGeneratingImg(true);
        try {
            const res = await fetch('/api/admin/social-image-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    topic: post.content ? post.content.substring(0, 150) : articleTitle,
                    articleTitle,
                    postId: post.id 
                })
            });
            const data = await res.json();
            if (res.ok && data.imageUrl) {
                onUpdate({ ...post, image_url: data.imageUrl });
                alert('Obrázok bol úspešne vygenerovaný');
            } else {
                alert(data.error || 'Chyba generovania obrázku');
            }
        } catch (err) {
            alert('Sieťová chyba');
        } finally {
            setGeneratingImg(false);
        }
    };

    const handleEditWithPrompt = async () => {
        if (!editText.trim() || !displayImage) return;
        setGeneratingEdit(true);
        try {
            const res = await fetch('/api/admin/social-image-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    imageUrl: displayImage, 
                    prompt: editText,
                    postId: post.id
                })
            });
            const data = await res.json();
            if (res.ok && data.imageUrl) {
                onUpdate({ ...post, image_url: data.imageUrl });
                setShowEditPanel(false);
                setEditText('');
                alert('Obrázok bol úspešne upravený');
            } else {
                alert(data.error || 'Chyba pri úprave obrázku');
            }
        } catch (err) {
            alert('Sieťová chyba');
        } finally {
            setGeneratingEdit(false);
        }
    };

    const handleSaveCaption = async () => {
        setSavingCaption(true);
        try {
            const { error } = await supabase.from('social_posts').update({ content: editCaptionText }).eq('id', post.id);
            if (!error) {
                onUpdate({ ...post, content: editCaptionText });
                setEditingCaption(false);
                alert('Text bol uložený');
            } else {
                alert('Chyba ukladania');
            }
        } catch (err) {
            alert('Sieťová chyba');
        } finally {
            setSavingCaption(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(post.content || '');
        alert("Skopírované do schránky");
    };

    return (
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start">
            {/* Left: Image Box */}
            <div className="w-full lg:w-[240px] flex-shrink-0 flex flex-col gap-3">
                <div 
                    className="relative w-full aspect-square bg-black/40 rounded-2xl overflow-hidden border border-white/5 cursor-pointer group"
                    onMouseEnter={() => setHovering(true)}
                    onMouseLeave={() => setHovering(false)}
                >
                    {displayImage ? (
                        <img src={displayImage} alt="Post preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-2">
                            <ImageIcon className="w-8 h-8 opacity-50" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Bez obrázka</span>
                        </div>
                    )}

                    {/* Image Hover overlay */}
                    <div className={cn(
                        "absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-3 transition-opacity duration-200",
                        hovering ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}>
                        <div className="w-full h-full flex flex-col gap-2 justify-center max-w-[180px]">
                            <label className="w-full py-2.5 px-3 bg-black/60 text-white border border-white/20 hover:bg-black/80 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs font-bold">
                                <Camera className="w-4 h-4" /> Zmeniť foto
                                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                            </label>
                            <button 
                                onClick={handleGenerateImage} 
                                disabled={generatingImg}
                                className="w-full py-2.5 px-3 bg-white text-black rounded-xl cursor-pointer hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-50"
                            >
                                {generatingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} AI Generovať
                            </button>
                            <button 
                                onClick={() => setShowEditPanel(!showEditPanel)}
                                className={cn(
                                    "w-full py-2.5 px-3 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs font-bold border",
                                    showEditPanel ? "bg-white/20 text-white border-white/30" : "bg-black/60 text-white/90 border-white/20 hover:bg-black/80"
                                )}
                            >
                                <PenLine className="w-4 h-4" /> AI Úprava
                            </button>
                        </div>
                    </div>

                    {/* Loading Upload state overrides everything */}
                    {uploadingImg && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center pt-2">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <span className="text-[10px] font-bold uppercase tracking-widest mt-3 text-primary">Nahrávam...</span>
                        </div>
                    )}
                </div>

                {/* Edit prompt panel */}
                {showEditPanel && (
                    <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-2xl flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-primary mb-1">
                            <span className="flex items-center gap-1.5"><PenLine className="w-3 h-3" /> Úprava promptom</span>
                        </div>
                        <textarea 
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            placeholder='Napr. "urob obrázok čiernobiely", "pridaj stôl"'
                            className="w-full bg-black/40 border border-primary/20 rounded-xl p-2.5 text-xs text-white placeholder:text-white/30 resize-none h-[60px] focus:outline-none focus:border-primary/50 transition-colors"
                        />
                        <div className="flex gap-2 mt-1">
                            <button 
                                onClick={handleEditWithPrompt} 
                                disabled={!editText.trim() || generatingEdit}
                                className="flex-1 py-2 bg-primary text-white rounded-lg text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-primary/90 transition-colors"
                            >
                                {generatingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Aplikovať
                            </button>
                            <button 
                                onClick={() => setShowEditPanel(false)}
                                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-[10px] uppercase font-black flex items-center justify-center transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Right: Caption Box */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Text príspevku</span>
                    <div className="flex items-center gap-2">
                        {!editingCaption && (
                            <>
                                <button onClick={() => setEditingCaption(true)} className="text-[10px] font-black uppercase tracking-widest text-primary/80 hover:text-primary flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-lg transition-colors">
                                    <Edit3 className="w-3 h-3" /> Upraviť
                                </button>
                                <button onClick={handleCopy} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white flex items-center gap-1 px-2 py-1 bg-white/5 rounded-lg transition-colors">
                                    <Copy className="w-3 h-3" /> Kopírovať
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {editingCaption ? (
                    <div className="flex flex-col gap-3">
                        <textarea
                            value={editCaptionText}
                            onChange={(e) => setEditCaptionText(e.target.value)}
                            rows={6}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-medium leading-relaxed text-white focus:outline-none focus:border-primary/50 transition-colors"
                        />
                        <div className="flex gap-2">
                            <button 
                                onClick={handleSaveCaption}
                                disabled={savingCaption}
                                className="flex-1 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {savingCaption ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Uložiť text
                            </button>
                            <button 
                                onClick={() => { setEditingCaption(false); setEditCaptionText(post.content || ''); }}
                                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white rounded-xl text-[10px] uppercase font-black flex items-center justify-center transition-colors"
                            >
                                <X className="w-3.5 h-3.5" /> Zrušiť
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-black/20 border border-white/[0.03] rounded-2xl p-4 text-xs font-medium leading-relaxed overflow-y-auto whitespace-pre-wrap text-zinc-400 h-full max-h-[220px]">
                        {post.content || <span className="italic opacity-50">Žiadny text k príspevku.</span>}
                    </div>
                )}
            </div>
        </div>
    );
}
