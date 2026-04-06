"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type AdminContextType = {
  isLoggedIn: boolean;
  isHydrated: boolean;
  login: (email: string, password: string) => string | null; // returns error or null
  logout: () => void;
};

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    if (typeof window !== "undefined") {
      setIsLoggedIn(localStorage.getItem("admin_logged_in") === "true");
    }
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
    <AdminContext.Provider value={{ isLoggedIn, isHydrated, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
