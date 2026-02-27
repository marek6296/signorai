"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function AnalyticsTracker() {
    const pathname = usePathname();

    useEffect(() => {
        const trackVisit = async () => {
            try {
                let visitorId = localStorage.getItem("site_visitor_id");
                if (!visitorId) {
                    visitorId = crypto.randomUUID();
                    localStorage.setItem("site_visitor_id", visitorId);
                }

                await fetch("/api/analytics/track", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        path: pathname,
                        referrer: document.referrer || null,
                        user_agent: navigator.userAgent,
                        visitor_id: visitorId
                    })
                });
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
