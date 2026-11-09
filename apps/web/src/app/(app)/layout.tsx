"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg text-ink-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] grid-rows-[56px_1fr] max-md:grid-cols-1">
      <div className="row-span-2 max-md:row-span-1">
        <Sidebar />
      </div>
      <Topbar />
      <main className="ops-page px-7 py-6 max-md:px-4">{children}</main>
    </div>
  );
}
