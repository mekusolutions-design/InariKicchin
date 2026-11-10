"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { navForRole } from "@/lib/nav";
import { getStoredUser, type Role } from "@/lib/auth";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    setRole(getStoredUser()?.role ?? null);
  }, []);

  const items = navForRole(role);

  return (
    <aside className="flex h-full min-h-screen w-60 flex-col bg-navy px-3 py-4 text-slate-200">
      <div className="mb-5 flex items-center gap-2.5 px-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-white">
          IK
        </div>
        <div>
          <strong className="block text-[0.95rem] tracking-tight text-white">
            Inari Kicchin
          </strong>
          <span className="text-[0.7rem] text-slate-400">
            Restaurant Manager
          </span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                "rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-navy-active text-white shadow-[inset_3px_0_0_#EA580C]"
                  : "text-slate-300 hover:bg-navy-hover hover:text-white",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-2.5 pt-3 text-[0.7rem] text-slate-500">
        v1.0 · Blueprint UI · Next.js
      </div>
    </aside>
  );
}
