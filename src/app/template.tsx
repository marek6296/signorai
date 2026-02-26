"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function Template({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    return (
        <div key={pathname} className="w-full h-full flex-grow flex flex-col smooth-page-transition">
            {children}
        </div>
    );
}
