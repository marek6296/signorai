"use client";
import { useState } from "react";
import { AdminProvider, useAdmin } from "@/app/admin/_context/AdminContext";
import AdminSidebar from "@/app/admin/_components/AdminSidebar";
import LoginPage from "@/app/admin/_components/LoginPage";
import { ReactNode } from "react";
import { Menu } from "lucide-react";

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
