"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@/contexts/UserContext";

// ── ONLY standard banner formats ──
// Native / Direct-Link / Pop-under formats are intentionally excluded.
// Standard Adsterra banner invoke.js renders an <ins> element — it does NOT
// add document-level click listeners, so no pop-unders or forced redirects.

type AdType = "468x60" | "300x250";

interface AdBannerProps {
    type?: AdType;
    label?: boolean;
    onAdLoaded?: () => void;   // fires when the ad script loads successfully
    onAdFailed?: () => void;   // fires when the ad script fails / times out
}

const AD_CONFIGS: Record<AdType, { key: string; width: number; height: number; src: string }> = {
    "468x60": {
        key: "2e6aaf30497f97ecc4c2db4cc3b536cf",
        width: 468,
        height: 60,
        src: "https://www.highperformanceformat.com/2e6aaf30497f97ecc4c2db4cc3b536cf/invoke.js",
    },
    "300x250": {
        key: "fb5013190e8f9a210a7f68076b97838b",
        width: 300,
        height: 250,
        src: "https://www.highperformanceformat.com/fb5013190e8f9a210a7f68076b97838b/invoke.js",
    },
};

export function AdBanner({ type = "468x60", label = false, onAdLoaded, onAdFailed }: AdBannerProps) {
    const { user, loading } = useUser();
    const containerRef = useRef<HTMLDivElement>(null);
    const injectedRef = useRef(false);
    const [visible, setVisible] = useState(false);

    const config = AD_CONFIGS[type];

    useEffect(() => {
        if (user || loading) return;
        if (!config) return;
        if (!containerRef.current) return;
        if (injectedRef.current) return;
        injectedRef.current = true;

        const container = containerRef.current;

        // Set atOptions before loading the script
        const optionsScript = document.createElement("script");
        optionsScript.type = "text/javascript";
        optionsScript.text = `
            atOptions = {
                'key': '${config.key}',
                'format': 'iframe',
                'height': ${config.height},
                'width': ${config.width},
                'params': {}
            };
        `;
        container.appendChild(optionsScript);

        // Load the invoke script — show banner only on successful load
        const invokeScript = document.createElement("script");
        invokeScript.type = "text/javascript";
        invokeScript.src = config.src;
        invokeScript.async = true;

        invokeScript.onload = () => {
            setVisible(true);
            onAdLoaded?.();
        };

        invokeScript.onerror = () => {
            onAdFailed?.();
        };

        // Fallback: if script neither loads nor errors in 5s, treat as failed
        const timeout = setTimeout(() => {
            if (!visible) onAdFailed?.();
        }, 5000);

        container.appendChild(invokeScript);

        return () => {
            clearTimeout(timeout);
            if (container) container.innerHTML = "";
            injectedRef.current = false;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, loading]);

    // Logged-in users and loading state → no ads
    if (user || loading) return null;
    if (!config) return null;

    return (
        <div style={{ display: visible ? "block" : "none" }} className="w-full my-3">
            {label && (
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 mb-1 pl-1">
                    Reklama
                </p>
            )}
            <div
                ref={containerRef}
                style={{
                    width: config.width,
                    height: config.height,
                    maxWidth: "100%",
                    display: "block",
                    overflow: "hidden",
                }}
            />
        </div>
    );
}
