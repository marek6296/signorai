"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Square, Volume2, Loader2, RotateCcw, RotateCw, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { LoginModal } from "@/components/LoginModal";

const PLAY_COUNT_KEY = "aiwai_audio_plays";
const FREE_PLAYS_LIMIT = 2;

interface AudioPlayerProps {
    text: string;
    title?: string;
}

export function AudioPlayer({ text, title }: AudioPlayerProps) {
    const { user } = useUser();
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [playsUsed, setPlaysUsed] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Load play count from localStorage
    useEffect(() => {
        const stored = parseInt(localStorage.getItem(PLAY_COUNT_KEY) || "0", 10);
        setPlaysUsed(stored);
    }, []);

    // Cleanup audio URL on unmount
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const isLocked = !user && playsUsed >= FREE_PLAYS_LIMIT;

    const handlePlayPause = async () => {
        // Gate: non-logged-in users limited to FREE_PLAYS_LIMIT
        if (!user && playsUsed >= FREE_PLAYS_LIMIT) {
            setShowLoginModal(true);
            return;
        }

        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
            return;
        }

        if (audioUrl) {
            audioRef.current?.play();
            setIsPlaying(true);
            return;
        }

        // Increment play count for non-logged-in users (only on first play of this audio)
        if (!user) {
            const newCount = playsUsed + 1;
            localStorage.setItem(PLAY_COUNT_KEY, String(newCount));
            setPlaysUsed(newCount);
        }

        // Generate audio
        setIsLoading(true);
        if (audioRef.current) audioRef.current.load();
        try {
            const response = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Nepodarilo sa vygenerovať zvuk.");
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);

            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.play().catch(err => {
                    console.warn("Autoplay blocked:", err);
                    setIsPlaying(false);
                });
                setIsPlaying(true);
            }
        } catch (error: unknown) {
            console.error("Audio generation failed:", error);
            const errorMessage = error instanceof Error ? error.message : "Neznáma chyba";
            alert(`Chyba: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStop = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        }
    };

    const handleSkip = (seconds: number) => {
        if (audioRef.current) audioRef.current.currentTime += seconds;
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    // LOCKED STATE — non-logged-in, limit reached
    if (isLocked) {
        return (
            <>
                <div
                    className="mb-8 p-5 rounded-3xl flex flex-col gap-4 relative overflow-hidden cursor-pointer"
                    style={{
                        background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(0,0,0,0.4) 100%)",
                        border: "1px solid rgba(139,92,246,0.25)",
                        boxShadow: "0 8px 32px rgba(139,92,246,0.1)",
                    }}
                    onClick={() => setShowLoginModal(true)}
                >
                    <div className="flex items-center gap-4">
                        <div
                            className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full"
                            style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)" }}
                        >
                            <Lock className="w-6 h-6" style={{ color: "#a78bfa" }} />
                        </div>
                        <div className="flex flex-col flex-grow min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="flex items-center justify-center w-5 h-5 rounded-full" style={{ background: "rgba(139,92,246,0.15)" }}>
                                    <Volume2 className="w-3 h-3" style={{ color: "#a78bfa" }} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.7)" }}>AI Audio Zhrnutie</span>
                            </div>
                            <p className="text-sm font-bold text-white/80">
                                Prihláste sa pre neobmedzené počúvanie
                            </p>
                            <p className="text-[11px] text-white/40 mt-0.5">
                                Využili ste {FREE_PLAYS_LIMIT} zo {FREE_PLAYS_LIMIT} zdarma zhrnutí
                            </p>
                        </div>
                        <div
                            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"
                            style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}
                        >
                            Prihlásiť sa
                        </div>
                    </div>
                    {/* Blurred progress bar */}
                    <div className="opacity-30 pointer-events-none px-1">
                        <div className="h-1.5 bg-white/10 rounded-lg" />
                        <div className="flex justify-between text-[10px] font-bold text-white/30 mt-1">
                            <span>0:00</span>
                            <span>—:——</span>
                        </div>
                    </div>
                </div>
                <LoginModal open={showLoginModal} onClose={() => setShowLoginModal(false)} reason="audio" />
            </>
        );
    }

    // NORMAL STATE
    return (
        <>
            <div className="mb-8 p-5 bg-card border border-border/50 rounded-3xl backdrop-blur-sm shadow-xl flex flex-col gap-4">
                <audio
                    ref={audioRef}
                    onEnded={() => setIsPlaying(false)}
                    onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                    onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                    className="hidden"
                />

                <div className="flex items-center gap-4">
                    <button
                        onClick={handlePlayPause}
                        disabled={isLoading}
                        className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        title={isPlaying ? "Pozastaviť" : "Prehrať zhrnutie"}
                    >
                        {isLoading ? (
                            <Loader2 className="w-7 h-7 animate-spin" />
                        ) : isPlaying ? (
                            <Pause className="w-7 h-7 fill-current" />
                        ) : (
                            <Play className="w-7 h-7 fill-current ml-1" />
                        )}
                    </button>

                    <div className="flex flex-col flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10">
                                <Volume2 className="w-3 h-3 text-primary" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">AI Audio Zhrnutie</span>
                            {/* Show remaining plays for non-logged-in users */}
                            {!user && playsUsed < FREE_PLAYS_LIMIT && (
                                <span className="ml-auto text-[9px] font-bold text-white/25 uppercase tracking-wider">
                                    {FREE_PLAYS_LIMIT - playsUsed}× zostatok
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-bold text-foreground truncate">
                            {isLoading ? "Generujem hlas..." : isPlaying ? `Prehrávam zhrnutie: ${title}` : "Vypočujte si zhrnutie článku"}
                        </p>
                    </div>

                    <div className="flex items-center gap-1">
                        <button onClick={() => handleSkip(-10)} disabled={!audioUrl || isLoading} className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30" title="-10 sekúnd">
                            <RotateCcw className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleSkip(10)} disabled={!audioUrl || isLoading} className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30" title="+10 sekúnd">
                            <RotateCw className="w-5 h-5" />
                        </button>
                        {audioUrl && !isLoading && (
                            <button onClick={handleStop} className="p-2 text-muted-foreground hover:text-red-500 transition-colors" title="Zastaviť">
                                <Square className="w-4 h-4 fill-current" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className={cn("flex flex-col gap-1 px-1", !audioUrl && "opacity-30 pointer-events-none")}>
                    <input type="range" min="0" max={duration || 100} step="0.1" value={currentTime} onChange={handleSeek} className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" />
                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground tabular-nums">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            </div>
            <LoginModal open={showLoginModal} onClose={() => setShowLoginModal(false)} reason="audio" />
        </>
    );
}
