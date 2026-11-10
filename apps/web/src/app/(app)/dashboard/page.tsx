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
  stockReceivedToday?: number;
  lowStock: Array<{ name: string; onHand: number; min: number; unit?: string }>;
  expiryAlerts?: Array<{ name: string; qty: number; unit?: string; status: string; days?: number }>;
  bestSellers?: Array<{ name: string; sold: number }>;
  salesByHour?: Array<{ hour: number; value: number }>;
  salesByOrderType?: Array<{ type: string; value: number }>;
  note?: string;
}

const HOUR_LABELS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [showLowStock, setShowLowStock] = useState(true);

  useEffect(() => {
    Promise.all([
      api<DashboardData>("/dashboard"),
      api<Record<string, string>>("/settings").catch(() => ({})),
    ])
      .then(([d, s]) => {
        setData(d);
        setShowLowStock(s.module_low_stock_alerts !== "0");
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="mt-2 text-danger">{error}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Ensure the API is running and <code>NEXT_PUBLIC_API_URL</code> is set.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Today&apos;s performance at a glance</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="kpi-card animate-pulse">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="mt-2 h-7 w-28 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Only show chart series when the API returns real data — never invent sales.
  const hourValues = data.salesByHour?.map((h) => h.value) ?? [];
  const maxHour = Math.max(...hourValues, 1);

  const orderTypeRows = data.salesByOrderType ?? [];
  const maxOrderType = Math.max(...orderTypeRows.map((r) => r.value), 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">Today&apos;s performance at a glance</p>
      </div>

      {/* KPI row — Blueprint §14.2 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="kpi-card">
          <div className="label-caps">Today&apos;s sales</div>
          <div className="kpi-value text-primary">{money(data.todaySales)}</div>
          <div className="kpi-hint">Live from orders</div>
        </div>
        <div className="kpi-card">
          <div className="label-caps">Orders</div>
          <div className="kpi-value">{data.todayOrders}</div>
          <div className="kpi-hint">Today</div>
        </div>
        <div className="kpi-card">
          <div className="label-caps">Avg order value</div>
          <div className="kpi-value">{money(data.averageOrderValue)}</div>
          <div className="kpi-hint">
            {data.todayOrders > 0
              ? `${money(data.todaySales)} / ${data.todayOrders} orders`
              : "—"}
          </div>
        </div>
        <div className="kpi-card">
          <div className="label-caps">Stock received</div>
          <div className="kpi-value">
            {money(data.stockReceivedToday ?? 0)}
          </div>
          <div className="kpi-hint">Purchases today</div>
        </div>
        <div className="kpi-card">
          <div className="label-caps">Stock used</div>
          <div className="kpi-value">{money(data.lastClosingValueUsed)}</div>
          <div className="kpi-hint">From last closing · not profit</div>
        </div>
        <div className="kpi-card">
          <div className="label-caps">Wastage</div>
          <div className="kpi-value text-danger">
            {money(data.lastClosingValueWasted)}
          </div>
          <div className="kpi-hint">Last closing period</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Sales by hour */}
        <div className="panel lg:col-span-2">
          <h3 className="mb-4 text-[0.95rem] font-semibold">
            Sales by hour (KSh 000)
          </h3>
          <div className="bar-chart">
            {HOUR_LABELS.map((h, i) => (
              <div key={h} className="bar-wrap">
                <div
                  className="bar"
                  style={{
                    height: `${Math.max(4, (hourValues[i] / maxHour) * 100)}%`,
                  }}
                  title={`${h}:00 — ${hourValues[i]}`}
                />
                <div className="bar-label">{h}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Illustrative pattern when the API does not yet return hourly series.
          </p>
        </div>

        {/* Sales by order type */}
        <div className="panel">
          <h3 className="mb-3 text-[0.95rem] font-semibold">
            Sales by order type
          </h3>
          <ul className="space-y-2">
            {orderTypeRows.map((row) => (
              <li key={row.type} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-ink-muted">{row.type}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.max(4, (row.value / maxOrderType) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-16 text-right tabular-nums font-medium">
                  {money(row.value).replace("KSh ", "")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Quick actions */}
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

        {/* Low-stock alerts */}
        <div className="panel">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[0.95rem] font-semibold">Low-stock alerts</h3>
            <Badge tone="warn">{data.lowStock?.length ?? 0} items</Badge>
          </div>
          <table className="table-base">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-right">On hand</th>
                <th className="text-right">Min</th>
              </tr>
            </thead>
            <tbody>
              {!showLowStock ? (
                <tr>
                  <td colSpan={3} className="py-3 text-ink-muted">
                    Low-stock alerts disabled in Settings.
                  </td>
                </tr>
              ) : (data.lowStock || []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-ink-muted">
                    All stock above minimum levels
                  </td>
                </tr>
              ) : (
                data.lowStock.map((p) => (
                  <tr key={p.name}>
                    <td className="font-medium">{p.name}</td>
                    <td className="num">
                      <Badge tone="warn">
                        {p.onHand}
                        {p.unit ? ` ${p.unit}` : ""}
                      </Badge>
                    </td>
                    <td className="num text-ink-muted">{p.min}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Best sellers / expiry */}
        <div className="panel">
          <h3 className="mb-3 text-[0.95rem] font-semibold">
            Best-selling items today
          </h3>
          {(data.bestSellers || []).length > 0 ? (
            <ol className="space-y-2 text-sm">
              {data.bestSellers!.slice(0, 5).map((item, i) => (
                <li key={item.name} className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-medium">{item.name}</span>
                  <span className="tabular-nums text-ink-muted">
                    {item.sold} sold
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-muted">
              Best-seller ranking appears when the API returns sales-by-item
              data.
            </p>
          )}
          {data.note ? (
            <p className="mt-3 text-xs text-ink-muted">{data.note}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
