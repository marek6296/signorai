"use client";

import * as React from "react";
import { Moon, Sun, Palette } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
    const { setTheme, theme, resolvedTheme } = useTheme();

    // To prevent hydration mismatch, we delay rendering the actual icon until mounted
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <div className="h-10 w-10" />;
    }

    const currentTheme = theme === "system" ? resolvedTheme : theme;

    const toggleTheme = () => {
        if (currentTheme === "light") {
            setTheme("dark");
        } else if (currentTheme === "dark") {
            setTheme("colorful");
        } else {
            setTheme("light");
        }
    };

    return (
        <button
            onClick={toggleTheme}
            className="flex items-center justify-center h-10 w-10 bg-muted/40 backdrop-blur-md rounded-full border border-border/40 shadow-sm hover:bg-muted/60 transition-all active:scale-95"
            title="Prepnúť tému"
        >
            {currentTheme === "light" && <Sun className="h-5 w-5 text-zinc-900" />}
            {currentTheme === "dark" && <Moon className="h-5 w-5 text-white" />}
            {currentTheme === "colorful" && <Palette className="h-5 w-5 text-primary" />}
            <span className="sr-only">Prepnúť tému</span>
        </button>
    );
}
