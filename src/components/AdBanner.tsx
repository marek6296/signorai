"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/contexts/UserContext";

type AdType = "native" | "468x60" | "300x250";

interface AdBannerProps {
    type?: AdType;
    label?: boolean;
}

const AD_CONFIGS: Record<AdType, { key: string; width: number; height: number; src: string } | null> = {
    "native": null,
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

export function AdBanner({ type = "native", label = false }: AdBannerProps) {
    const { user, loading } = useUser();
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Don't inject ads if user is logged in or loading
        if (user || loading) return;
        if (!wrapperRef.current) return;
        wrapperRef.current.innerHTML = "";

        if (type === "native") {
            const container = document.createElement("div");
            container.id = "container-504f1cf94792121bce7845f6a1c97ce7";
            wrapperRef.current.appendChild(container);

            const script = document.createElement("script");
            script.async = true;
            script.setAttribute("data-cfasync", "false");
            script.src = "https://pl29075867.profitablecpmratenetwork.com/504f1cf94792121bce7845f6a1c97ce7/invoke.js";
            wrapperRef.current.appendChild(script);
        } else {
            const config = AD_CONFIGS[type];
            if (!config) return;

            const optionsScript = document.createElement("script");
            optionsScript.innerHTML = `
                atOptions = {
                    'key': '${config.key}',
                    'format': 'iframe',
                    'height': ${config.height},
                    'width': ${config.width},
                    'params': {}
                };
            `;
            wrapperRef.current.appendChild(optionsScript);

            const invokeScript = document.createElement("script");
            invokeScript.src = config.src;
            wrapperRef.current.appendChild(invokeScript);
        }

        return () => {
            if (wrapperRef.current) wrapperRef.current.innerHTML = "";
        };
    }, [type, user, loading]);

    // Logged-in users see no ads
    if (user) return null;
    // While loading auth state, render nothing (avoids flash of ads)
    if (loading) return null;

    return (
        <div className="w-full my-3">
            {label && (
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 mb-1 pl-1">
                    Reklama
                </p>
            )}
            <div
                ref={wrapperRef}
                className="overflow-hidden rounded-xl"
                style={
                    type === "300x250"
                        ? { width: 300, height: 250 }
                        : type === "468x60"
                        ? { width: "100%", maxWidth: 468, height: 60 }
                        : { width: "100%" }
                }
            />
        </div>
    );
}
