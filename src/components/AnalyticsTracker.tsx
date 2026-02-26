"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function AnalyticsTracker() {
    const pathname = usePathname();

    useEffect(() => {
        const trackVisit = async () => {
            try {
                const { error } = await supabase.from("site_visits").insert({
                    path: pathname,
                    referrer: document.referrer || null,
                    user_agent: navigator.userAgent
                });

                if (error) {
                    console.error("Failed to track visit:", error);
                } else {
                    console.log(`Visit tracked: ${pathname}`);
                }
            } catch (err) {
                console.error("Analytics error:", err);
            }
        };

        // Delay slightly for initial load and to avoid interference with critical path
        const timer = setTimeout(() => {
            trackVisit();
        }, 3000);

        return () => clearTimeout(timer);
    }, [pathname]);

    return null; // This component doesn't render anything
}
