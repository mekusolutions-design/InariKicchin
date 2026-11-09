"use client";

import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface SalesReport {
  orders: number;
  grossSales: number;
  vatCollected: number;
  netSales: number;
  stockUsedValue?: number;
  wastageValue?: number;
  note?: string;
}

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [r, setR] = useState<SalesReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(f = from, t = to) {
    setLoading(true);
    setError("");
    try {
      const data = await api<SalesReport>(
        `/reports/sales?from=${f}&to=${t}`,
      );
      setR(data);
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
        <Button
          onClick={() => load(from, to)}
          disabled={loading}
          className="min-h-11"
        >
          {loading ? "Loading…" : "Apply"}
        </Button>
        <Button variant="secondary" className="min-h-11" disabled>
          Export Excel
        </Button>
        <Button variant="secondary" className="min-h-11" disabled>
          Export PDF
        </Button>
      </div>

      {error ? <p className="text-danger">{error}</p> : null}

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
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel">
              <div className="label-caps">Stock used value</div>
              <div className="mt-1 text-xl font-bold tabular-nums">
                {r.stockUsedValue != null
                  ? money(r.stockUsedValue)
                  : "—"}
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

          <div className="flex flex-wrap gap-2">
            <Badge tone="info">Stock used value is not profit</Badge>
            <Badge tone="purple">
              Gross profit requires recipe costing (Phase 4)
            </Badge>
          </div>
          {r.note ? (
            <p className="text-xs text-ink-muted">{r.note}</p>
          ) : null}
        </>
      ) : !error && !loading ? (
        <p className="text-ink-muted">No report data for the selected range.</p>
      ) : null}
    </div>
  );
}
