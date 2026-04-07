"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

// Emails that always get admin access (via Supabase login OR manual login)
const ADMIN_EMAILS = ["cmelo.marek@gmail.com"];

export type LoadingToastState = {
  message: string;
  subMessage?: string;
  color?: string; // accent color e.g. "#60a5fa" (blue), "#f472b6" (pink), "#f59e0b" (amber)
} | null;

type AdminContextType = {
  isLoggedIn: boolean;
  isHydrated: boolean;
  login: (email: string, password: string) => string | null;
  logout: () => void;
  loadingToast: LoadingToastState;
  showLoading: (message: string, subMessage?: string, color?: string) => void;
  hideLoading: () => void;
};

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [loadingToast, setLoadingToast] = useState<LoadingToastState>(null);

  const showLoading = (message: string, subMessage?: string, color?: string) => {
    setLoadingToast({ message, subMessage, color });
  };
  const hideLoading = () => setLoadingToast(null);

  useEffect(() => {
    const init = async () => {
      // 1. Check localStorage (manual admin login)
      const localAdmin =
        typeof window !== "undefined" &&
        localStorage.getItem("admin_logged_in") === "true";

      // 2. Check Supabase session (Google / email login via Supabase)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const supabaseAdmin = !!(
        session?.user?.email && ADMIN_EMAILS.includes(session.user.email)
      );

      setIsLoggedIn(localAdmin || supabaseAdmin);
      setIsHydrated(true);
    };

    init();

    // Listen for Supabase auth state changes (sign-in / sign-out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const supabaseAdmin = !!(
        session?.user?.email && ADMIN_EMAILS.includes(session.user.email)
      );
      if (supabaseAdmin) {
        setIsLoggedIn(true);
      } else {
        // Only log out if also not manually logged in
        const localAdmin =
          typeof window !== "undefined" &&
          localStorage.getItem("admin_logged_in") === "true";
        if (!localAdmin) setIsLoggedIn(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = (email: string, password: string): string | null => {
    if (email === "cmelo.marek@gmail.com" && password === "Marek6296") {
      setIsLoggedIn(true);
      localStorage.setItem("admin_logged_in", "true");
      return null;
    }
    return "Nesprávny e-mail alebo heslo";
  };

  const logout = () => {
    setIsLoggedIn(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("admin_logged_in");
    }
  };

  return (
    <AdminContext.Provider value={{ isLoggedIn, isHydrated, login, logout, loadingToast, showLoading, hideLoading }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
