"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  clearSession,
  getStoredUser,
  initials,
  type AuthUser,
} from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export function Topbar() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    setUser(getStoredUser());
    setDateLabel(
      new Date().toLocaleString("en-KE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, []);

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    clearSession();
    router.replace("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-7">
      <div className="text-sm text-ink-muted">{dateLabel}</div>
      <div className="flex items-center gap-3 text-sm">
        <div className="text-right">
          <div className="font-semibold">{user?.fullName ?? "—"}</div>
          <div className="text-[0.7rem] font-medium text-ink-muted">
            {user?.role ?? ""}
          </div>
        </div>
        <div className="grid h-[34px] w-[34px] place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
          {user ? initials(user.fullName) : "IK"}
        </div>
        <Button variant="secondary" className="min-h-9 px-3 py-1.5" onClick={logout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
