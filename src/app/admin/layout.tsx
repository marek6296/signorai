"use client";
import { useState } from "react";
import { AdminProvider, useAdmin } from "@/app/admin/_context/AdminContext";
import AdminSidebar from "@/app/admin/_components/AdminSidebar";
import LoginPage from "@/app/admin/_components/LoginPage";
import { ReactNode } from "react";
import { Menu, Sparkles } from "lucide-react";

function GlobalLoadingToast() {
  const { loadingToast } = useAdmin();
  if (!loadingToast) return null;
  const color = loadingToast.color || "#60a5fa";
  const colorDim = color + "30";
  const colorBorder = color + "55";
  return (
    <div
      className="fixed inset-x-0 top-0 z-[9999] flex justify-center pt-4"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="rounded-2xl px-5 py-3.5 flex items-center gap-3.5"
        style={{
          background: "linear-gradient(145deg, #141414 0%, #0f0f0f 100%)",
          border: `1px solid ${colorBorder}`,
          boxShadow: `0 8px 40px rgba(0,0,0,0.8), 0 0 24px ${colorDim}`,
          minWidth: 280, maxWidth: 440,
          animation: "globalToastSlide 0.3s ease",
        }}
      >
        <style>{`@keyframes globalToastSlide { from { opacity:0; transform:translateY(-14px); } to { opacity:1; transform:translateY(0); } }`}</style>
        {/* Spinner */}
        <div className="relative w-8 h-8 shrink-0">
          <div className="absolute inset-0 rounded-full" style={{ border: "2px solid rgba(255,255,255,0.06)" }} />
          <div
            className="absolute inset-0 rounded-full animate-spin"
            style={{ border: "2px solid transparent", borderTopColor: color, borderRightColor: colorDim }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" style={{ color }} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">{loadingToast.message}</p>
          {loadingToast.subMessage && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{loadingToast.subMessage}</p>
          )}
        </div>
        {/* Animated progress bar */}
        <div className="w-16 h-1 rounded-full overflow-hidden shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: "40%",
              background: `linear-gradient(to right, ${color}, ${color}aa)`,
              animation: "globalToastBar 1.4s ease-in-out infinite",
            }}
          />
          <style>{`@keyframes globalToastBar { 0%{margin-left:0;width:35%} 50%{margin-left:55%;width:45%} 100%{margin-left:0;width:35%} }`}</style>
        </div>
      </div>
    </div>
  );
}

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const { isLoggedIn, isHydrated } = useAdmin();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (!isHydrated) {
    return <div className="min-h-screen" style={{ background: "#050505" }} />;
  }

  if (!isLoggedIn) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      {/* ── Mobile top bar ── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-50"
        style={{
          background: "rgba(8,8,8,0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 -ml-1 rounded-xl transition-all"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 ml-3">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black text-black"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #d0d0d0 100%)",
            }}
          >
            AI
          </div>
          <span
            className="font-black uppercase tracking-[0.12em] text-sm"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AIWai
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">Admin</span>
        </div>
      </div>

      {/* ── Mobile backdrop ── */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <AdminSidebar
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
      />

      {/* ── Global loading toast — always on top ── */}
      <GlobalLoadingToast />

      {/* ── Main content ── */}
      <main className="md:ml-[264px] min-h-screen pt-14 md:pt-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminProvider>
  );
}
