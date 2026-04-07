"use client";

import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { AdBanner } from "@/components/AdBanner";

/**
 * AdBlock — wrapper pre reklamný blok (karta "Reklama").
 * Celý kontajner (vrátane okna) sa zobrazí LEN keď reklama skutočne načíta.
 * Prázdne okno sa nikdy neukáže.
 */
export function AdBlock() {
  const { user } = useUser();
  const [adLoaded, setAdLoaded] = useState(false);

  if (user) return null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-white/5 shadow-xl flex items-center justify-center"
      style={{
        minHeight: adLoaded ? 260 : 0,
        display: adLoaded ? "flex" : "none",
      }}
    >
      <div className="absolute top-3 left-4 z-10 pointer-events-none">
        <span className="inline-flex items-center rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-white/40">
          Reklama
        </span>
      </div>
      <AdBanner
        type="300x250"
        onAdLoaded={() => setAdLoaded(true)}
        onAdFailed={() => setAdLoaded(false)}
      />
    </div>
  );
}
