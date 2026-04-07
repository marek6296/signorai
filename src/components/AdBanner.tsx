"use client";

/**
 * AdBanner — placeholder komponent.
 * Adsterra reklamy boli odstránené kvôli agresívnym popunderom a redirectom.
 * Pripravené na integráciu s lepšou reklamnou sieťou.
 */

type AdType = "468x60" | "300x250";

interface AdBannerProps {
    type?: AdType;
    label?: boolean;
    onAdLoaded?: () => void;
    onAdFailed?: () => void;
}

export function AdBanner({ onAdFailed }: AdBannerProps) {
    // No ad network active — fire failed callback so containers hide
    if (onAdFailed) {
        setTimeout(() => onAdFailed(), 0);
    }
    return null;
}
