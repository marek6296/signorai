"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AdminEditButtonProps {
    articleId: string;
}

export function AdminEditButton({ articleId }: AdminEditButtonProps) {
    const [isAdmin, setIsAdmin] = useState(false);
    const router = useRouter();

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!confirm("Naozaj vymazať článok? Túto akciu nie je možné vrátiť späť.")) return;

        try {
            const { error } = await supabase.from("articles").delete().eq("id", articleId);
            if (error) throw error;

            await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
            router.push("/");
            router.refresh();
        } catch (error: any) {
            alert("Chyba pri mazaní: " + error.message);
        }
    };

    useEffect(() => {
        const checkAdmin = () => setIsAdmin(localStorage.getItem("admin_logged_in") === "true");
        checkAdmin();
        window.addEventListener('storage', checkAdmin);
        return () => window.removeEventListener('storage', checkAdmin);
    }, []);

    if (!isAdmin) return null;

    return (
        <div className="flex items-center gap-2">
            <Link
                href={`/admin/edit/${articleId}`}
                className="inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-full font-black uppercase tracking-widest text-[10px] transition-colors border border-primary/20 shadow-sm"
                title="Upraviť tento článok v Admin Panele"
            >
                <Edit className="w-3.5 h-3.5" />
                Upraviť Článok
            </Link>
            <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-1.5 rounded-full font-black uppercase tracking-widest text-[10px] transition-colors border border-red-500/20 shadow-sm"
                title="Odstrániť tento článok natrvalo"
            >
                <Trash2 className="w-3.5 h-3.5" />
                Odstrániť
            </button>
        </div>
    );
}
