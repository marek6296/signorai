"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Zap,
  Sparkles,
  FileText,
  Share2,
  BarChart3,
  Settings,
  LogOut,
  X,
  ExternalLink,
  GitBranch,
  Users,
  Mail,
} from "lucide-react";
import { useAdmin } from "@/app/admin/_context/AdminContext";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  description: string;
  gradient: string;
  iconBg: string;
  iconColor: string;
  glowColor: string;
};

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
    description: "Prehľad systému",
    gradient: "from-white/[0.07]",
    iconBg: "bg-white/15",
    iconColor: "text-white",
    glowColor: "shadow-white/10",
  },
  {
    href: "/admin/bot-layout",
    label: "Bot Layout",
    icon: GitBranch,
    description: "Workflow Builder",
    gradient: "from-emerald-500/10",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
    glowColor: "shadow-emerald-500/20",
  },
  {
    href: "/admin/autopilot",
    label: "AI Autopilot",
    icon: Zap,
    description: "Automatizácia",
    gradient: "from-yellow-500/10",
    iconBg: "bg-yellow-500/20",
    iconColor: "text-yellow-400",
    glowColor: "shadow-yellow-500/20",
  },
  {
    href: "/admin/tvorba",
    label: "Tvorba Článkov",
    icon: Sparkles,
    description: "Generovanie",
    gradient: "from-purple-500/10",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
    glowColor: "shadow-purple-500/20",
  },
  {
    href: "/admin/clanky",
    label: "Zoznam Článkov",
    icon: FileText,
    description: "Správa obsahu",
    gradient: "from-green-500/10",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-400",
    glowColor: "shadow-green-500/20",
  },
  {
    href: "/admin/socialne",
    label: "Sociálne Siete",
    icon: Share2,
    description: "Promo",
    gradient: "from-pink-500/10",
    iconBg: "bg-pink-500/20",
    iconColor: "text-pink-400",
    glowColor: "shadow-pink-500/20",
  },
  {
    href: "/admin/analytika",
    label: "Analytika",
    icon: BarChart3,
    description: "Štatistiky",
    gradient: "from-orange-500/10",
    iconBg: "bg-orange-500/20",
    iconColor: "text-orange-400",
    glowColor: "shadow-orange-500/20",
  },
  {
    href: "/admin/pouzivatelia",
    label: "Používatelia",
    icon: Users,
    description: "Správa účtov & rolí",
    gradient: "from-cyan-500/10",
    iconBg: "bg-cyan-500/20",
    iconColor: "text-cyan-400",
    glowColor: "shadow-cyan-500/20",
  },
  {
    href: "/admin/newsletter",
    label: "Newsletter",
    icon: Mail,
    description: "Odberatelia",
    gradient: "from-violet-500/10",
    iconBg: "bg-violet-500/20",
    iconColor: "text-violet-400",
    glowColor: "shadow-violet-500/20",
  },
  {
    href: "/admin/zdroje",
    label: "Zdroje & Nastavenia",
    icon: Settings,
    description: "Konfigurácia",
    gradient: "from-blue-500/10",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
    glowColor: "shadow-blue-500/20",
  },
];

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { logout } = useAdmin();

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 h-full w-[264px] flex flex-col z-50 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{
          background: "linear-gradient(180deg, #0c0c0c 0%, #080808 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Subtle noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />

        {/* ── Header ── */}
        <div className="relative flex items-center justify-between px-4 py-4 shrink-0">
          {/* Top separator glow line */}
          <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

          <div className="flex items-center gap-3">
            <div>
              <div
                className="text-[13px] font-black uppercase tracking-[0.15em] leading-none"
                style={{
                  background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AIWai
              </div>
              <div className="text-[9px] text-white/25 uppercase tracking-[0.2em] mt-0.5 font-medium">
                Admin Panel
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Close button on mobile */}
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="flex items-center gap-2 px-3 mb-4">
            <div className="text-[8px] font-bold text-white/25 uppercase tracking-[0.3em]">
              Menu
            </div>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group overflow-hidden",
                  active
                    ? "text-white"
                    : "text-white/35 hover:text-white/75"
                )}
                style={
                  active
                    ? {
                        background: `linear-gradient(to right, rgba(255,255,255,0.07), transparent)`,
                        border: "1px solid rgba(255,255,255,0.08)",
                      }
                    : {}
                }
              >
                {/* Active left accent */}
                {active && (
                  <div
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                    style={{
                      background: `linear-gradient(to bottom, transparent, white, transparent)`,
                      opacity: 0.5,
                    }}
                  />
                )}

                {/* Hover background */}
                {!active && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl bg-white/[0.04]" />
                )}

                {/* Icon */}
                <div
                  className={cn(
                    "relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
                    active
                      ? `${item.iconBg} shadow-lg ${item.glowColor}`
                      : "bg-white/[0.04] group-hover:bg-white/[0.07]"
                  )}
                >
                  <Icon
                    size={14}
                    className={cn(
                      "transition-colors duration-200",
                      active ? item.iconColor : "text-white/25 group-hover:text-white/50"
                    )}
                  />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] leading-tight truncate">
                    {item.label}
                  </div>
                  {!active && (
                    <div className="text-[10px] text-white/18 group-hover:text-white/35 truncate leading-tight transition-colors mt-0.5">
                      {item.description}
                    </div>
                  )}
                </div>

                {/* Active dot */}
                {active && (
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: "rgba(255,255,255,0.4)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="relative px-3 py-3 shrink-0 space-y-0.5">
          {/* Top separator glow line */}
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/25 hover:text-white/60 transition-all text-[12px] font-medium group overflow-hidden"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl bg-white/[0.03]" />
            <div className="relative w-7 h-7 rounded-lg bg-white/[0.04] group-hover:bg-white/[0.07] flex items-center justify-center transition-all">
              <ExternalLink size={13} className="text-white/25 group-hover:text-white/50 transition-colors" />
            </div>
            <span className="relative">Zobraziť web</span>
            <span className="relative ml-auto text-[10px] text-white/15 font-mono">aiwai.news</span>
          </a>

          <button
            onClick={() => { logout(); onClose(); }}
            className="relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-white/25 hover:text-red-400 transition-all text-[12px] font-medium group overflow-hidden"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl bg-red-500/[0.06]" />
            <div className="relative w-7 h-7 rounded-lg bg-white/[0.04] group-hover:bg-red-500/10 flex items-center justify-center transition-all">
              <LogOut size={13} className="text-white/25 group-hover:text-red-400 transition-colors" />
            </div>
            <span className="relative">Odhlásiť sa</span>
          </button>
        </div>
      </div>
    </>
  );
}
