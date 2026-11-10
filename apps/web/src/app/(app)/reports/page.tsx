"use client";

import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface SalesReportRaw {
  orders?: number | unknown[];
  orderCount?: number;
  grossSales?: number;
  totalSales?: number;
  vatCollected?: number;
  totalVat?: number;
  netSales?: number;
  averageOrder?: number;
  stockUsedValue?: number;
  wastageValue?: number;
  byOrderType?: Record<string, number>;
  note?: string;
  from?: string;
  to?: string;
}

interface SalesReport {
  orders: number;
  grossSales: number;
  vatCollected: number;
  netSales: number;
  averageOrder: number;
  stockUsedValue?: number;
  wastageValue?: number;
  byOrderType?: Record<string, number>;
  note?: string;
  from?: string;
  to?: string;
}

function normalize(raw: SalesReportRaw): SalesReport {
  const orders =
    typeof raw.orders === "number"
      ? raw.orders
      : typeof raw.orderCount === "number"
        ? raw.orderCount
        : Array.isArray(raw.orders)
          ? raw.orders.length
          : 0;
  const grossSales = Number(raw.grossSales ?? raw.totalSales ?? 0);
  const vatCollected = Number(raw.vatCollected ?? raw.totalVat ?? 0);
  const netSales =
    raw.netSales != null ? Number(raw.netSales) : grossSales - vatCollected;
  return {
    orders,
    grossSales,
    vatCollected,
    netSales,
    averageOrder:
      raw.averageOrder != null
        ? Number(raw.averageOrder)
        : orders
          ? grossSales / orders
          : 0,
    stockUsedValue:
      raw.stockUsedValue != null ? Number(raw.stockUsedValue) : undefined,
    wastageValue:
      raw.wastageValue != null ? Number(raw.wastageValue) : undefined,
    byOrderType: raw.byOrderType,
    note: raw.note,
    from: raw.from,
    to: raw.to,
  };
}

export default function ReportsPage() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [r, setR] = useState<SalesReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(f = from, t = to) {
    setLoading(true);
    setError("");
    try {
      const data = await api<SalesReportRaw>(
        `/reports/sales?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`,
      );
      setR(normalize(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setR(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exportCsv() {
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("INARI_TOKEN")
          : null;
      const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(
        `${base}/reports/sales.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) throw new Error("CSV export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="page-sub">
          Revenue, VAT and stock utilisation shown separately on purpose
        </p>
      </div>

      <div className="panel flex flex-wrap items-end gap-3">
        <div>
          <label className="field-label">From</label>
          <input
            type="date"
            className="field-input w-auto"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">To</label>
          <input
            type="date"
            className="field-input w-auto"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button onClick={() => load(from, to)} disabled={loading} className="min-h-11">
          {loading ? "Loading…" : "Apply"}
        </Button>
        <Button
          variant="secondary"
          className="min-h-11"
          onClick={exportCsv}
          disabled={loading}
        >
          Export CSV
        </Button>
      </div>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      {r ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="kpi-card">
              <div className="label-caps">Gross sales</div>
              <div className="kpi-value text-primary">{money(r.grossSales)}</div>
            </div>
            <div className="kpi-card">
              <div className="label-caps">VAT collected</div>
              <div className="kpi-value">{money(r.vatCollected)}</div>
            </div>
            <div className="kpi-card">
              <div className="label-caps">Net sales</div>
              <div className="kpi-value">{money(r.netSales)}</div>
            </div>
            <div className="kpi-card">
              <div className="label-caps">Orders</div>
              <div className="kpi-value">{r.orders}</div>
              <div className="kpi-hint">
                Avg {money(r.averageOrder)}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel">
              <div className="label-caps">Stock used value</div>
              <div className="mt-1 text-xl font-bold tabular-nums">
                {r.stockUsedValue != null ? money(r.stockUsedValue) : "—"}
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                From closing snapshots · not gross profit
              </p>
            </div>
            <div className="panel">
              <div className="label-caps">Wastage value</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-danger">
                {r.wastageValue != null ? money(r.wastageValue) : "—"}
              </div>
            </div>
          </div>

          {r.byOrderType && Object.keys(r.byOrderType).length > 0 ? (
            <div className="panel">
              <h3 className="mb-3 text-[0.95rem] font-semibold">
                Sales by order type
              </h3>
              <ul className="space-y-2 text-sm">
                {Object.entries(r.byOrderType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, value]) => (
                    <li key={type} className="flex justify-between gap-4">
                      <span className="text-ink-muted">{type}</span>
                      <span className="font-medium tabular-nums">
                        {money(value)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Badge tone="info">Stock used value is not profit</Badge>
            <Badge tone="purple">
              Gross profit requires recipe costing (Phase 4)
            </Badge>
          </div>
          {r.note ? (
            <p className="text-xs text-ink-muted">{r.note}</p>
          ) : null}
          {r.from && r.to ? (
            <p className="text-xs text-ink-muted">
              Period {r.from} → {r.to}
            </p>
          ) : null}
        </>
      ) : !error && !loading ? (
        <p className="text-ink-muted">No report data for the selected range.</p>
      ) : null}
    </div>
  );
}
