"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Square, Volume2, Loader2 } from "lucide-react";

interface AudioPlayerProps {
    text: string;
    title?: string;
}

export function AudioPlayer({ text, title }: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Cleanup audio URL on unmount
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const handlePlayPause = async () => {
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

        // Generate audio if not already generated
        setIsLoading(true);
        // Prime the audio element while still in the user gesture stack frame
        if (audioRef.current) {
            audioRef.current.load();
        }
        try {
            const response = await fetch("/api/tts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
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
                // Browsers often block .play() after an async fetch if the gesture is considered "stale"
                audioRef.current.play().catch(err => {
                    console.warn("Autoplay/Play blocked, trying alternative...", err);
                    // If it's a NotAllowedError, we can't do much automatically, 
                    // but we can update the UI so the user can click again (now that we have the URL)
                    setIsPlaying(false);
                });
                setIsPlaying(true);
            }
        } catch (error: any) {
            console.error("Audio generation failed:", error);
            alert(`Chyba: ${error.message}`);
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

    return (
        <div className="mb-8 p-4 bg-muted/30 border border-border/50 rounded-2xl backdrop-blur-sm flex items-center gap-4 group">
            <audio
                ref={audioRef}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
            />

            <button
                onClick={handlePlayPause}
                disabled={isLoading}
                className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                title={isPlaying ? "Pozastaviť" : "Prehrať článok"}
            >
                {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                ) : isPlaying ? (
                    <Pause className="w-6 h-6 fill-current" />
                ) : (
                    <Play className="w-6 h-6 fill-current ml-1" />
                )}
            </button>

            <div className="flex flex-col flex-grow">
                <div className="flex items-center gap-2 mb-0.5">
                    <Volume2 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Audio Verzia (Beta)</span>
                </div>
                <p className="text-sm font-bold text-foreground">
                    {isLoading ? "Generujem slovenský hlas..." : isPlaying ? `Prehrávam: ${title || "Článok"}` : "Vypočujte si tento článok"}
                </p>
            </div>

            {(isPlaying || audioUrl) && !isLoading && (
                <button
                    onClick={handleStop}
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Zastaviť"
                >
                    <Square className="w-4 h-4 fill-current" />
                </button>
            )}
        </div>
    );
}
