"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken, clearSession } from "@/lib/auth";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  async function mobileLogout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    clearSession();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg text-ink-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Desktop shell */}
      <div className="hidden min-h-screen grid-cols-[240px_1fr] grid-rows-[56px_1fr] md:grid">
        <div className="row-span-2">
          <Sidebar />
        </div>
        <Topbar />
        <main className="ops-page px-7 py-6">{children}</main>
      </div>

      {/* Mobile shell */}
      <div className="md:hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-3">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-lg border border-border text-ink"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="text-sm font-semibold">Inari Kicchin</div>
          <button
            type="button"
            onClick={mobileLogout}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink-muted"
          >
            Log out
          </button>
        </header>
        {mobileNavOpen ? (
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          >
            <div
              className="h-full w-64 max-w-[80vw] overflow-y-auto bg-navy shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>
        ) : null}
        <main className="px-4 py-4 pb-24">{children}</main>
      </div>
    </div>
  );
}
