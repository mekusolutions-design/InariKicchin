"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface DashboardData {
  todaySales: number;
  todayOrders: number;
  averageOrderValue: number;
  lastClosingValueUsed: number;
  lastClosingValueWasted: number;
  lowStock: Array<{ name: string; onHand: number; min: number }>;
  note?: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="mt-2 text-danger">{error}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Start the API: <code>cd apps/api && npm run start:prod</code>
        </p>
      </div>
    );
  }

  if (!data) return <p className="text-ink-muted">Loading…</p>;

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Today&apos;s performance at a glance
      </p>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Today's sales", value: money(data.todaySales) },
          { label: "Orders", value: String(data.todayOrders) },
          { label: "Avg order value", value: money(data.averageOrderValue) },
          {
            label: "Stock used (last close)",
            value: money(data.lastClosingValueUsed),
            hint: "Not profit",
          },
          {
            label: "Wastage (last close)",
            value: money(data.lastClosingValueWasted),
          },
        ].map((c) => (
          <div key={c.label} className="panel">
            <div className="label-caps">{c.label}</div>
            <div className="mt-1.5 text-xl font-bold tabular-nums">
              {c.value}
            </div>
            {c.hint ? (
              <div className="mt-1 text-xs text-ink-muted">{c.hint}</div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel">
          <h3 className="mb-3 text-[0.95rem] font-semibold">Low-stock alerts</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[0.72rem] uppercase tracking-wide text-ink-muted">
                <th className="pb-2">Product</th>
                <th className="pb-2 text-right">On hand</th>
                <th className="pb-2 text-right">Min</th>
              </tr>
            </thead>
            <tbody>
              {(data.lowStock || []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-2 text-ink-muted">
                    None
                  </td>
                </tr>
              ) : (
                data.lowStock.map((p) => (
                  <tr key={p.name} className="border-t border-border">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-right">
                      <Badge tone="warn">{p.onHand}</Badge>
                    </td>
                    <td className="py-2 text-right tabular-nums">{p.min}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {data.note ? (
            <p className="mt-3 text-xs text-ink-muted">{data.note}</p>
          ) : null}
        </div>
        <div className="panel">
          <h3 className="mb-3 text-[0.95rem] font-semibold">Quick actions</h3>
          <div className="flex flex-col gap-2">
            <Link href="/pos">
              <Button className="w-full">+ New Order (POS)</Button>
            </Link>
            <Link href="/inventory-received">
              <Button variant="secondary" className="w-full">
                + Receive Stock
              </Button>
            </Link>
            <Link href="/makeline">
              <Button variant="secondary" className="w-full">
                + Record Makeline
              </Button>
            </Link>
            <Link href="/closing-stock">
              <Button variant="secondary" className="w-full">
                Start Closing Stock
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
