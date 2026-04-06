"use client";

import { useUser } from "@/contexts/UserContext";
import { AdBanner } from "@/components/AdBanner";

/**
 * AdBlock — wrapper pre reklamný blok s kontajnerom (karta so štýlom "Reklama").
 * Celý blok (vrátane okna/kontajnera) sa skryje pre prihlásených používateľov.
 */
export function AdBlock() {
  const { user } = useUser();
  if (user) return null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-white/5 shadow-xl flex items-center justify-center"
      style={{ minHeight: 260 }}
    >
      <div className="absolute top-3 left-4 z-10 pointer-events-none">
        <span className="inline-flex items-center rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-white/40">
          Reklama
        </span>
      </div>
      <AdBanner type="300x250" />
    </div>
  );
}
