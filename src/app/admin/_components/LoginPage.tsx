"use client";
import { useState } from "react";
import { useAdmin } from "@/app/admin/_context/AdminContext";

export default function LoginPage() {
  const { login } = useAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const result = login(email, password);
    if (result) {
      setError(result);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "#050505" }}
    >
      {/* Background radial gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,255,255,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow orbs */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(255,255,255,0.02) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Brand mark */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #d0d0d0 100%)",
                boxShadow: "0 0 40px rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.6)",
              }}
            >
              <span className="text-[13px] font-black text-black tracking-tight">AI</span>
            </div>
            <div
              className="text-2xl font-black uppercase tracking-[0.1em]"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.65) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              AIWai
            </div>
          </div>
          <p className="text-white/30 text-sm font-medium tracking-wide">
            Admin Dashboard
          </p>
        </div>

        {/* Login card */}
        <div
          className="rounded-2xl p-8 relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #111111 0%, #0c0c0c 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset",
          }}
        >
          {/* Inner glow line at top */}
          <div
            className="absolute top-0 left-8 right-8 h-px"
            style={{
              background: "linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)",
            }}
          />

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider"
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 disabled:opacity-50 transition-all outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.2)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider"
              >
                Heslo
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 disabled:opacity-50 transition-all outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.2)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
              />
            </div>

            {/* Error */}
            {error && (
              <div
                className="px-4 py-3 rounded-xl text-sm text-red-400 font-medium"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
              style={{
                background: isLoading || !email || !password
                  ? "rgba(255,255,255,0.08)"
                  : "linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)",
                color: isLoading || !email || !password ? "rgba(255,255,255,0.4)" : "#000000",
                boxShadow:
                  isLoading || !email || !password
                    ? "none"
                    : "0 0 30px rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.4)",
              }}
            >
              {isLoading ? "Prihlasovanie..." : "Prihlásiť sa"}
            </button>
          </form>
        </div>

        <p className="text-center text-white/15 text-xs mt-6 tracking-wider uppercase">
          AIWai Admin Portal · 2025
        </p>
      </div>
    </div>
  );
}
