"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Volume2, ShieldOff, Zap } from "lucide-react";

const FEATURES = [
  { icon: Volume2, label: "Neobmedzené AI audio zhrnutia" },
  { icon: ShieldOff, label: "Žiadne reklamy — čistý zážitok" },
  { icon: Zap, label: "Okamžitý prístup k najnovším správam" },
];

interface AuthLayoutProps {
  children: React.ReactNode;
  heading: string;
  subheading: string;
}

export function AuthLayout({ children, heading, subheading }: AuthLayoutProps) {
  const [theme, setTheme] = useState<"dark" | "light" | "colorful">("dark");

  useEffect(() => {
    const getTheme = () => {
      const cl = document.documentElement.classList;
      if (cl.contains("light")) return "light" as const;
      if (cl.contains("colorful")) return "colorful" as const;
      return "dark" as const;
    };
    setTheme(getTheme());
    const observer = new MutationObserver(() => setTheme(getTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // In dark mode → left panel is WHITE (light), in light/colorful → left panel is DARK
  const leftIsLight = theme === "dark";

  const leftBg =
    theme === "dark"
      ? "#f5f5f7"       // near-white in dark mode
      : theme === "light"
      ? "#050505"       // black in light mode
      : "#030b16";      // dark navy in colorful mode

  const leftBorderColor =
    leftIsLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.04)";

  // Text/icon colors adapt to left panel lightness
  const c = leftIsLight
    ? {
        back: "rgba(10,10,15,0.3)",
        backHover: "rgba(10,10,15,0.7)",
        heading: "#0a0a10",
        sub: "rgba(10,10,15,0.45)",
        iconBg: "rgba(0,0,0,0.05)",
        iconBorder: "rgba(0,0,0,0.09)",
        icon: "rgba(0,0,0,0.35)",
        label: "rgba(10,10,15,0.5)",
        logoGradient: "linear-gradient(135deg, #0a0a10 0%, rgba(10,10,15,0.4) 100%)",
        logoOpacity: 0.55,
        copyright: "rgba(10,10,15,0.15)",
      }
    : {
        back: "rgba(255,255,255,0.28)",
        backHover: "rgba(255,255,255,0.65)",
        heading: "#ffffff",
        sub: "rgba(255,255,255,0.35)",
        iconBg: "rgba(255,255,255,0.05)",
        iconBorder: "rgba(255,255,255,0.09)",
        icon: "rgba(255,255,255,0.38)",
        label: "rgba(255,255,255,0.5)",
        logoGradient: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.45) 100%)",
        logoOpacity: 0.75,
        copyright: "rgba(255,255,255,0.14)",
      };

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL ── */}
      <div
        className="hidden lg:flex lg:w-[42%] xl:w-[45%] flex-col justify-center p-10 xl:p-14 flex-shrink-0 relative"
        style={{ background: leftBg, borderRight: `1px solid ${leftBorderColor}` }}
      >
        {/* Back link — absolute top */}
        <Link
          href="/"
          className="absolute top-10 left-10 xl:top-14 xl:left-14 inline-flex items-center gap-2 transition-colors text-[11px] font-black uppercase tracking-widest"
          style={{ color: c.back }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = c.backHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = c.back; }}
        >
          <ArrowLeft size={14} />
          Späť na AIWai
        </Link>

        {/* Main content — vertically centered */}
        <div className="flex flex-col gap-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <span
              className="font-syne font-extrabold text-[2.6rem] tracking-tighter uppercase leading-none"
              style={{
                background: c.logoGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              AIWai
            </span>
            <Image
              src="/aiwai-logo.png"
              alt="AIWai"
              width={44}
              height={44}
              className="w-11 h-11 object-contain"
              style={{ opacity: c.logoOpacity }}
            />
          </div>

          {/* Heading */}
          <div>
            <h1
              className="text-4xl xl:text-5xl font-black leading-[1.05] mb-4"
              style={{ color: c.heading }}
            >
              {heading}
            </h1>
            <p className="text-base leading-relaxed max-w-xs" style={{ color: c.sub }}>
              {subheading}
            </p>
          </div>

          {/* Feature list */}
          <div className="flex flex-col gap-4">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: c.iconBg, border: `1px solid ${c.iconBorder}` }}
                >
                  <Icon size={16} style={{ color: c.icon }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: c.label }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright — absolute bottom */}
        <p
          className="absolute bottom-10 left-10 xl:bottom-14 xl:left-14 text-[11px]"
          style={{ color: c.copyright }}
        >
          © 2026 AIWai News. Všetky práva vyhradené.
        </p>
      </div>

      {/* ── RIGHT PANEL — theme adaptive ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-background min-h-screen">

        {/* Mobile: back link */}
        <Link
          href="/"
          className="lg:hidden self-start mb-8 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-[11px] font-black uppercase tracking-widest"
        >
          <ArrowLeft size={14} />
          Späť
        </Link>

        {/* Mobile: mini logo */}
        <div className="lg:hidden flex items-center gap-2 self-start mb-8">
          <span
            className="font-syne font-extrabold text-2xl tracking-tighter uppercase"
            style={{
              background: "linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(var(--foreground)/0.5) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AIWai
          </span>
          <Image src="/aiwai-logo.png" alt="AIWai" width={28} height={28} className="w-7 h-7 object-contain opacity-70" />
        </div>

        <div className="w-full max-w-[360px]">
          {children}
        </div>
      </div>
    </div>
  );
}
