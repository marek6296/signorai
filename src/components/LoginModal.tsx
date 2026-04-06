"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X, Volume2, ShieldOff, Zap } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  reason?: "audio" | "general";
}

export function LoginModal({ open, onClose, reason = "general" }: LoginModalProps) {
  const { signInWithGoogle } = useUser();

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(20,20,20,0.98) 0%, rgba(12,12,12,0.98) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
        >
          <X size={16} />
        </button>

        {/* Header gradient */}
        <div
          className="px-8 pt-10 pb-8 flex flex-col items-center text-center"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <span
              className="font-syne font-extrabold text-3xl tracking-tighter uppercase"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.5) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              AIWai
            </span>
            <Image src="/aiwai-logo.png" alt="AIWai" width={32} height={32} className="w-8 h-8 object-contain" />
          </div>

          {/* Headline */}
          {reason === "audio" ? (
            <>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                <Volume2 className="w-7 h-7" style={{ color: "#a78bfa" }} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-white mb-2">
                Vypočuli ste 2 zhrnutia
              </h2>
              <p className="text-sm text-white/40 font-medium leading-relaxed">
                Pre neobmedzené počúvanie AI audio zhrnutí sa prihláste zadarmo.
              </p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
                <Zap className="w-7 h-7" style={{ color: "#f59e0b" }} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-white mb-2">
                Prihláste sa zadarmo
              </h2>
              <p className="text-sm text-white/40 font-medium leading-relaxed">
                Získajte plný prístup k AIWai News bez obmedzení.
              </p>
            </>
          )}
        </div>

        {/* Benefits */}
        <div className="px-8 py-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25 mb-4">Výhody prihláseného používateľa</p>
          <div className="flex flex-col gap-3">
            {[
              { icon: Volume2, color: "#a78bfa", bg: "rgba(139,92,246,0.12)", label: "Neobmedzené AI audio zhrnutia" },
              { icon: ShieldOff, color: "#34d399", bg: "rgba(52,211,153,0.12)", label: "Žiadne reklamy — čistý zážitok" },
              { icon: Zap, color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Rýchly prístup k novinkám" },
            ].map(({ icon: Icon, color, bg, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <span className="text-sm font-semibold text-white/70">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Google Sign-In Button */}
        <div className="px-8 py-6">
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-bold text-sm transition-all active:scale-95"
            style={{
              background: "rgba(255,255,255,0.95)",
              color: "#1a1a1a",
              boxShadow: "0 4px 20px rgba(255,255,255,0.1)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {/* Google icon SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Prihlásiť sa cez Google
          </button>

          <p className="text-center text-[10px] text-white/20 mt-4 leading-relaxed">
            Prihlásením súhlasíte s podmienkami používania.<br />
            Vaše údaje sú v bezpečí a nebudú zdieľané.
          </p>
        </div>
      </div>
    </div>
  );
}
