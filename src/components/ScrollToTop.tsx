"use client";

import { useEffect } from "react";

export function ScrollToTop() {
    useEffect(() => {
        // Force scroll to top on page refresh/load
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);
    }, []);

    return null;
}
