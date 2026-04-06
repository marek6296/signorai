"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, CheckCircle2, Mail } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { AuthLayout } from "@/components/AuthLayout";

export default function RegisterPage() {
  const { signInWithGoogle, signUpWithEmail } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [newsletter, setNewsletter] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordStrength = (() => {
    if (password.length === 0) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthLabel = ["", "Slabé", "Stredné", "Dobré", "Silné"][passwordStrength];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e"][passwordStrength];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("Heslá sa nezhodujú.");
      return;
    }
    if (password.length < 6) {
      setError("Heslo musí mať aspoň 6 znakov.");
      return;
    }

    setLoading(true);
    try {
      const { error, needsConfirmation } = await signUpWithEmail(email, password);
      if (error) {
        if (error.message.includes("already registered") || error.message.includes("already been registered")) {
          setError("Tento email je už zaregistrovaný. Skúste sa prihlásiť.");
        } else {
          setError(error.message);
        }
      } else {
        // Subscribe to newsletter if checked
        if (newsletter) {
          await fetch("/api/newsletter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, source: "registration" }),
          });
        }
        if (needsConfirmation) setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    await signInWithGoogle();
  };

  // ── Success state ──
  if (success) {
    return (
      <AuthLayout
        heading="Takmer hotovo."
        subheading="Vytvorte si bezplatný účet a čítajte bez obmedzení."
      >
        <div className="flex flex-col items-center text-center gap-5 py-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}
          >
            <Mail className="w-8 h-8" style={{ color: "#22c55e" }} />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground mb-2">Potvrďte váš email</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Poslali sme potvrdenie na{" "}
              <span className="font-bold text-foreground">{email}</span>.
              <br />
              Kliknite na odkaz v emaili a váš účet bude aktívny.
            </p>
          </div>
          <Link
            href="/prihlasenie"
            className="mt-2 text-sm font-bold text-primary hover:underline underline-offset-4"
          >
            Späť na prihlásenie →
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading="Vytvorte si účet."
      subheading="Bezplatná registrácia. Žiadna kreditná karta."
    >
      {/* Title */}
      <div className="mb-7">
        <h2 className="text-2xl font-black text-foreground tracking-tight mb-1">Registrácia</h2>
        <p className="text-sm text-muted-foreground">Vytvorte si bezplatný účet za pár sekúnd.</p>
      </div>

      {/* Google button */}
      <button
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl border border-border font-semibold text-sm text-foreground bg-background hover:bg-muted transition-all mb-5 disabled:opacity-60"
      >
        {googleLoading ? (
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" className="flex-shrink-0">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        Pokračovať s Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">alebo</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            Email
          </label>
          <input
            type="email"
            placeholder="vas@email.sk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/40 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            Heslo
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Minimálne 6 znakov"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-4 py-3 pr-12 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/40 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {/* Password strength */}
          {password.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex gap-1 flex-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{
                      background: i <= passwordStrength ? strengthColor : "hsl(var(--muted))",
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] font-bold" style={{ color: strengthColor }}>
                {strengthLabel}
              </span>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            Potvrdiť heslo
          </label>
          <div className="relative">
            <input
              type={showPasswordConfirm ? "text" : "password"}
              placeholder="Zopakujte heslo"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-4 py-3 pr-12 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/40 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {passwordConfirm.length > 0 && password === passwordConfirm && (
                <CheckCircle2 size={14} className="text-green-500" />
              )}
              <button
                type="button"
                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                {showPasswordConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Newsletter checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group mt-1">
          <div className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={newsletter}
              onChange={(e) => setNewsletter(e.target.checked)}
              className="sr-only"
            />
            <div
              className="w-4 h-4 rounded flex items-center justify-center transition-all"
              style={{
                background: newsletter ? "hsl(var(--primary))" : "transparent",
                border: newsletter ? "1px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
              }}
            >
              {newsletter && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground leading-snug group-hover:text-foreground transition-colors">
            Chcem dostávať newsletter s najnovšími AI správami a novinkami
          </span>
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-black text-[11px] uppercase tracking-[0.18em] bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Vytvoriť účet
        </button>
      </form>

      {/* Login link */}
      <p className="text-center text-sm text-muted-foreground mt-6">
        Máte už účet?{" "}
        <Link
          href="/prihlasenie"
          className="text-primary font-bold hover:underline underline-offset-4"
        >
          Prihláste sa →
        </Link>
      </p>
    </AuthLayout>
  );
}
