"use client";

import { useUser } from "@/contexts/UserContext";

// ── ONLY banner formats — NO native, NO pop-under, NO redirect ads ──
// Ad scripts are loaded inside a sandboxed <iframe> so they cannot:
//   • add click listeners to the main document (no pop-unders)
//   • navigate/redirect the parent page (no forced redirects)
//   • access parent DOM or cookies
// sandbox flags explained:
//   allow-scripts              — ad JS can run inside the iframe
//   allow-same-origin          — needed for Adsterra iframe render
//   allow-popups               — clicking the ad opens advertiser in new tab
//   allow-top-navigation-by-user-activation — explicit ad click can navigate top (normal ad click)
//   ✗ allow-top-navigation     — blocked: scripts cannot redirect parent page
//   ✗ allow-popups-to-escape-sandbox — blocked: opened windows stay sandboxed

type AdType = "468x60" | "300x250";

interface AdBannerProps {
    type?: AdType;
    label?: boolean;
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

export function AdBanner({ type = "468x60", label = false }: AdBannerProps) {
    const { user, loading } = useUser();

    // Logged-in users and loading state → no ads
    if (user || loading) return null;

    const config = AD_CONFIGS[type];
    if (!config) return null;

    // Build the iframe HTML that loads the banner ad in isolation
    const iframeDoc = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin:0; padding:0; border:0; overflow:hidden; }
  body { background:transparent; display:flex; align-items:center; justify-content:center; }
</style>
<script>
  atOptions = {
    'key': '${config.key}',
    'format': 'iframe',
    'height': ${config.height},
    'width': ${config.width},
    'params': {}
  };
</script>
<script src="${config.src}"></script>
</head>
<body></body>
</html>`;

    return (
        <div className="w-full my-3">
            {label && (
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 mb-1 pl-1">
                    Reklama
                </p>
            )}
            <iframe
                srcDoc={iframeDoc}
                sandbox="allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
                scrolling="no"
                frameBorder="0"
                style={
                    type === "300x250"
                        ? { width: 300, height: 250, border: "none", display: "block" }
                        : { width: "100%", maxWidth: 468, height: 60, border: "none", display: "block" }
                }
                title="Reklama"
            />
        </div>
    );
}
