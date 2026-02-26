"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Square, Volume2, Loader2, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
    text: string;
    title?: string;
}

export function AudioPlayer({ text, title }: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
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
                audioRef.current.play().catch(err => {
                    console.warn("Autoplay/Play blocked, trying alternative...", err);
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
        if (audioRef.current) {
            audioRef.current.currentTime += seconds;
        }
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
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
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
                    </div>
                    <p className="text-sm font-bold text-foreground truncate">
                        {isLoading ? "Generujem hlas..." : isPlaying ? `Prehrávam zhrnutie: ${title}` : "Vypočujte si zhrnutie článku"}
                    </p>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => handleSkip(-10)}
                        disabled={!audioUrl || isLoading}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                        title="-10 sekúnd"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => handleSkip(10)}
                        disabled={!audioUrl || isLoading}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                        title="+10 sekúnd"
                    >
                        <RotateCw className="w-5 h-5" />
                    </button>
                    {audioUrl && !isLoading && (
                        <button
                            onClick={handleStop}
                            className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                            title="Zastaviť"
                        >
                            <Square className="w-4 h-4 fill-current" />
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar Container */}
            <div className={cn("flex flex-col gap-1 px-1", !audioUrl && "opacity-30 pointer-events-none")}>
                <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground tabular-nums">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
}
