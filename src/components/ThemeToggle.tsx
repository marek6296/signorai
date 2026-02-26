"use client";

import * as React from "react";
import { Moon, Sun, Palette } from "lucide-react";
import { useTheme } from "next-themes";

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
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10 relative"
            title="Prepnúť tému"
        >
            {currentTheme === "light" && <Sun className="h-[1.2rem] w-[1.2rem] transition-all" />}
            {currentTheme === "dark" && <Moon className="h-[1.2rem] w-[1.2rem] transition-all" />}
            {currentTheme === "colorful" && <Palette className="h-[1.2rem] w-[1.2rem] transition-all" />}
            <span className="sr-only">Prepnúť tému</span>
        </button>
    );
}
