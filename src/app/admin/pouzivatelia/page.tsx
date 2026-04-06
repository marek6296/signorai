"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Crown,
  User,
  Edit3,
  X,
} from "lucide-react";
import Image from "next/image";

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "editor" | "moderator" | "admin";
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
};

const ROLES = ["user", "editor", "moderator", "admin"] as const;

const roleStyle: Record<string, { bg: string; color: string; border: string; label: string }> = {
  admin:     { bg: "rgba(234,179,8,0.12)",   color: "#fbbf24", border: "rgba(234,179,8,0.3)",   label: "Admin" },
  moderator: { bg: "rgba(168,85,247,0.12)",  color: "#c084fc", border: "rgba(168,85,247,0.3)",  label: "Moderátor" },
  editor:    { bg: "rgba(59,130,246,0.12)",  color: "#60a5fa", border: "rgba(59,130,246,0.3)",  label: "Editor" },
  user:      { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "rgba(255,255,255,0.12)", label: "Používateľ" },
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function RoleDropdown({ userId, current, onChanged }: { userId: string; current: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const changeRole = async (role: string) => {
    setLoading(true);
    setOpen(false);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, role }),
    });
    setLoading(false);
    onChanged();
  };

  const s = roleStyle[current];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all hover:opacity-80 disabled:opacity-50"
        style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
      >
        {loading ? <RefreshCw size={10} className="animate-spin" /> : null}
        {s.label}
        <ChevronDown size={10} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-36 rounded-xl overflow-hidden z-50 shadow-2xl"
            style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
            {ROLES.map((r) => {
              const rs = roleStyle[r];
              return (
                <button
                  key={r}
                  onClick={() => changeRole(r)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all hover:bg-white/5"
                  style={{ color: rs.color }}
                >
                  {r === current && <CheckCircle2 size={10} />}
                  {rs.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DeleteModal({ user, onConfirm, onCancel }: { user: UserRow; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <button onClick={onCancel} className="text-white/30 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div>
          <h3 className="text-white font-black text-base mb-1">Zmazať používateľa?</h3>
          <p className="text-white/40 text-sm">Táto akcia je nevratná. Používateľ <span className="text-white/70 font-bold">{user.email}</span> bude natrvalo vymazaný.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition-all">Zrušiť</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-red-500/90 hover:bg-red-500 text-white transition-all">Zmazať</button>
        </div>
      </div>
    </div>
  );
}

export default function PouzivatepiaPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteTarget.id }),
    });
    setDeleteTarget(null);
    fetchUsers();
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const counts = ROLES.reduce((acc, r) => { acc[r] = users.filter((u) => u.role === r).length; return acc; }, {} as Record<string, number>);

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: "#080808" }}>
      {deleteTarget && <DeleteModal user={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Users size={15} className="text-cyan-400" />
          </div>
          <h1 className="text-xl font-black text-white uppercase tracking-wider">Používatelia</h1>
        </div>
        <p className="text-white/30 text-sm ml-11">Správa účtov a rolí</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Celkom", value: users.length, color: "#fff" },
          { label: "Admini", value: counts.admin ?? 0, color: "#fbbf24" },
          { label: "Editori", value: counts.editor ?? 0, color: "#60a5fa" },
          { label: "Používatelia", value: counts.user ?? 0, color: "rgba(255,255,255,0.4)" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            placeholder="Hľadať podľa emailu alebo mena..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-all"
          />
        </div>

        <div className="flex gap-2">
          {["all", ...ROLES].map((r) => {
            const s = r === "all" ? null : roleStyle[r];
            return (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                style={
                  roleFilter === r
                    ? { background: s?.bg ?? "rgba(255,255,255,0.1)", color: s?.color ?? "#fff", border: `1px solid ${s?.border ?? "rgba(255,255,255,0.2)"}` }
                    : { background: "transparent", color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.08)" }
                }
              >
                {r === "all" ? "Všetci" : s?.label}
              </button>
            );
          })}

          <button onClick={fetchUsers} disabled={loading} className="px-3 py-2 rounded-xl text-white/30 hover:text-white border border-white/8 hover:border-white/20 transition-all">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Header */}
        <div className="hidden md:grid grid-cols-[2fr_1.2fr_1fr_1fr_auto] px-5 py-3 gap-4 text-[9px] font-black uppercase tracking-widest text-white/20"
          style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span>Používateľ</span>
          <span>Registrácia</span>
          <span>Posledné prihlásenie</span>
          <span>Rola</span>
          <span></span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-white/20" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-white/20">
            <Users size={32} />
            <p className="text-sm font-bold uppercase tracking-widest">Žiadni používatelia</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {filtered.map((u) => {
              const rs = roleStyle[u.role];
              const initials = (u.full_name || u.email || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

              return (
                <div
                  key={u.id}
                  className="grid md:grid-cols-[2fr_1.2fr_1fr_1fr_auto] grid-cols-1 px-5 py-4 gap-4 items-center hover:bg-white/[0.02] transition-colors"
                >
                  {/* User info */}
                  <div className="flex items-center gap-3">
                    {u.avatar_url ? (
                      <Image src={u.avatar_url} alt={u.full_name ?? ""} width={36} height={36} className="w-9 h-9 rounded-full object-cover flex-shrink-0" unoptimized />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-[11px] font-black text-white/50 flex-shrink-0">
                        {initials}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-white truncate">{u.full_name || "—"}</span>
                        {u.role === "admin" && <Crown size={11} className="text-yellow-400 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {u.email_confirmed
                          ? <CheckCircle2 size={10} className="text-green-400 flex-shrink-0" />
                          : <XCircle size={10} className="text-red-400 flex-shrink-0" />}
                        <span className="text-[11px] text-white/35 truncate">{u.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Created at */}
                  <div className="text-[11px] text-white/30 md:block hidden">{fmt(u.created_at)}</div>

                  {/* Last sign in */}
                  <div className="text-[11px] text-white/30 md:block hidden">{fmt(u.last_sign_in_at)}</div>

                  {/* Role */}
                  <div className="md:block hidden">
                    <RoleDropdown userId={u.id} current={u.role} onChanged={fetchUsers} />
                  </div>

                  {/* Mobile: role + date row */}
                  <div className="md:hidden flex items-center justify-between">
                    <RoleDropdown userId={u.id} current={u.role} onChanged={fetchUsers} />
                    <span className="text-[10px] text-white/25">{fmt(u.created_at)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Zmazať"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[10px] text-white/15 mt-4 text-right">
        {filtered.length} z {users.length} používateľov
      </p>
    </div>
  );
}
