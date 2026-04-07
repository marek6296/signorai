"use client";

import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { AdBanner } from "@/components/AdBanner";

/**
 * AdBlock — wrapper pre reklamný blok v sidebar-e.
 * Kontajner sa zobrazí keď sa skript načíta.
 * Ak skript zlyhá alebo sa nenačíta do 8s, kontajner sa skryje.
 */
export function AdBlock() {
  const { user } = useUser();
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");

  if (user) return null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-white/5 shadow-xl flex items-center justify-center"
      style={{
        minHeight: status === "loaded" ? 260 : 0,
        display: status === "failed" ? "none" : "flex",
        opacity: status === "loading" ? 0 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      <div className="absolute top-3 left-4 z-10 pointer-events-none">
        <span className="inline-flex items-center rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-white/40">
          Reklama
        </span>
      </div>
      <AdBanner
        type="300x250"
        onAdLoaded={() => setStatus("loaded")}
        onAdFailed={() => setStatus("failed")}
      />
    </div>
  );
}
