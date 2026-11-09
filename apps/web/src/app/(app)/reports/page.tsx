"use client";
import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface SalesReport {
  orders: number;
  grossSales: number;
  vatCollected: number;
  netSales: number;
  note?: string;
}

export default function ReportsPage() {
  const [r, setR] = useState<SalesReport | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    api<SalesReport>(`/reports/sales?from=${today}&to=${today}`)
      .then(setR)
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="text-danger">{error}</p>;
  if (!r) return <p className="text-ink-muted">Loading…</p>;
  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Reports</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Revenue, VAT and stock utilisation shown separately on purpose
      </p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Gross sales", money(r.grossSales)],
          ["VAT collected", money(r.vatCollected)],
          ["Net sales", money(r.netSales)],
          ["Orders", String(r.orders)],
        ].map(([label, value]) => (
          <div key={label} className="panel">
            <div className="label-caps">{label}</div>
            <div className="mt-1.5 text-xl font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </div>
      {r.note ? <p className="text-xs text-ink-muted">{r.note}</p> : null}
      <p className="mt-2"><Badge tone="info">Stock used value is not profit</Badge></p>
    </div>
  );
}
