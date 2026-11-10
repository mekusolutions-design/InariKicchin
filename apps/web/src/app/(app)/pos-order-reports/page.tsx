"use client";

import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface PosReport {
  from: string;
  to: string;
  timezone?: string;
  orderCount: number;
  voidCount: number;
  grossSales: number;
  vatCollected: number;
  netSales: number;
  averageOrder: number;
  byPaymentMethod: Record<string, number>;
  byOrderType: Record<string, number>;
  byHour?: Record<string, number>;
  orders: Array<{
    id: string;
    orderNo: string;
    createdAt: string;
    orderType: string;
    platformReference?: string;
    totalAmount: number;
    paymentStatus: string;
    status: string;
    payments?: Array<{ method: string; amount: number; reference?: string }>;
  }>;
  dayClose?: {
    expectedCash: number;
    mpesa: number;
    card: number;
    bank: number;
    platformUnsettled: number;
    voids: number;
  };
}

function todayNairobi() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
}

export default function PosOrderReportsPage() {
  const [from, setFrom] = useState(todayNairobi);
  const [to, setTo] = useState(todayNairobi);
  const [data, setData] = useState<PosReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(f = from, t = to) {
    setLoading(true);
    setError("");
    try {
      const r = await api<PosReport>(
        `/reports/pos-orders?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`,
      );
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function preset(which: "today" | "yesterday") {
    const d = todayNairobi();
    if (which === "today") {
      setFrom(d);
      setTo(d);
      void load(d, d);
    } else {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const ys = y.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
      setFrom(ys);
      setTo(ys);
      void load(ys, ys);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">POS Order Reports</h1>
        <p className="page-sub">
          Africa/Nairobi business day · voids separate from gross sales
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
        <Button onClick={() => load(from, to)} disabled={loading}>
          {loading ? "Loading…" : "Apply"}
        </Button>
        <Button variant="secondary" onClick={() => preset("today")}>
          Today
        </Button>
        <Button variant="secondary" onClick={() => preset("yesterday")}>
          Yesterday
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="kpi-card">
              <div className="label-caps">Orders</div>
              <div className="kpi-value">{data.orderCount}</div>
            </div>
            <div className="kpi-card">
              <div className="label-caps">Gross sales</div>
              <div className="kpi-value text-primary">
                {money(data.grossSales)}
              </div>
            </div>
            <div className="kpi-card">
              <div className="label-caps">VAT</div>
              <div className="kpi-value">{money(data.vatCollected)}</div>
            </div>
            <div className="kpi-card">
              <div className="label-caps">Net sales</div>
              <div className="kpi-value">{money(data.netSales)}</div>
            </div>
            <div className="kpi-card">
              <div className="label-caps">Avg order</div>
              <div className="kpi-value">{money(data.averageOrder)}</div>
            </div>
          </div>

          {data.dayClose ? (
            <div className="panel">
              <h3 className="mb-3 text-[0.95rem] font-semibold">Day close</h3>
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <div className="flex justify-between border-b border-border py-1">
                  <span className="text-ink-muted">Expected cash</span>
                  <span className="font-semibold tabular-nums">
                    {money(data.dayClose.expectedCash)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border py-1">
                  <span className="text-ink-muted">M-Pesa</span>
                  <span className="font-semibold tabular-nums">
                    {money(data.dayClose.mpesa)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border py-1">
                  <span className="text-ink-muted">Card</span>
                  <span className="font-semibold tabular-nums">
                    {money(data.dayClose.card)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border py-1">
                  <span className="text-ink-muted">Bank</span>
                  <span className="font-semibold tabular-nums">
                    {money(data.dayClose.bank)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border py-1">
                  <span className="text-ink-muted">Platform unsettled</span>
                  <span className="font-semibold tabular-nums">
                    {money(data.dayClose.platformUnsettled)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border py-1">
                  <span className="text-ink-muted">Voids</span>
                  <span className="font-semibold">{data.dayClose.voids}</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                Platform sales are not included in expected cash.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel">
              <h3 className="mb-2 text-[0.95rem] font-semibold">
                By payment method
              </h3>
              <ul className="space-y-1 text-sm">
                {Object.entries(data.byPaymentMethod || {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-4">
                    <span className="text-ink-muted">{k}</span>
                    <span className="tabular-nums font-medium">{money(v)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h3 className="mb-2 text-[0.95rem] font-semibold">
                By order type
              </h3>
              <ul className="space-y-1 text-sm">
                {Object.entries(data.byOrderType || {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-4">
                    <span className="text-ink-muted">{k}</span>
                    <span className="tabular-nums font-medium">{money(v)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="panel overflow-x-auto">
            <h3 className="mb-3 text-[0.95rem] font-semibold">Orders</h3>
            <table className="table-base min-w-[720px]">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Ref</th>
                  <th className="text-right">Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data.orders || []).map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium">{o.orderNo}</td>
                    <td className="text-xs text-ink-muted whitespace-nowrap">
                      {(o.createdAt || "").slice(0, 19).replace("T", " ")}
                    </td>
                    <td>{o.orderType}</td>
                    <td className="text-ink-muted">
                      {o.platformReference || "—"}
                    </td>
                    <td className="num">{money(o.totalAmount)}</td>
                    <td className="text-xs">
                      {(o.payments || [])
                        .map((p) => p.method)
                        .join(", ") || o.paymentStatus}
                    </td>
                    <td>
                      <Badge
                        tone={o.status === "CANCELLED" ? "warn" : "ok"}
                      >
                        {o.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
