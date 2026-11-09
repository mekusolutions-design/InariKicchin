"use client";

import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface Closing {
  closingNo: string;
  status: string;
  totalValueUsed: number;
  totalValueWasted: number;
  submittedAt?: string;
  periodDate?: string;
}

interface ProductBalance {
  id: string;
  name: string;
  baseUnit: string;
  onHandQty: number;
  avgUnitCost: number;
  kind?: "purchased" | "makeline";
}

export default function ClosingStockPage() {
  const [rows, setRows] = useState<Closing[]>([]);
  const [products, setProducts] = useState<ProductBalance[]>([]);
  const [closingInputs, setClosingInputs] = useState<Record<string, string>>(
    {},
  );
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api<Closing[]>("/closings").catch(() => [] as Closing[]),
      api<ProductBalance[]>("/products").catch(() => [] as ProductBalance[]),
    ])
      .then(([closings, prods]) => {
        setRows(closings);
        setProducts(prods);
        const init: Record<string, string> = {};
        prods.forEach((p) => {
          init[p.id] = String(p.onHandQty ?? 0);
        });
        setClosingInputs(init);
      })
      .catch((e) => setError(e.message));
  }, []);

  const purchased = products.filter((p) => p.kind !== "makeline");
  const makeline = products.filter((p) => p.kind === "makeline");

  function calcUsed(p: ProductBalance) {
    const close = Number(closingInputs[p.id] ?? p.onHandQty);
    const avail = p.onHandQty; // simplified: opening+recv already reflected in onHand for demo
    return Math.max(0, avail - close);
  }

  async function submitClosing() {
    setMsg("");
    setSubmitting(true);
    try {
      const items = products.map((p) => ({
        productId: p.id,
        closingQty: Number(closingInputs[p.id] ?? 0),
      }));
      await api("/closings", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      setMsg("Closing submitted successfully");
      const refreshed = await api<Closing[]>("/closings").catch(() => rows);
      setRows(refreshed);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <div>
        <h1 className="page-title">Closing Stock</h1>
        <p className="mt-2 text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Closing Stock</h1>
          <p className="page-sub">
            Enter the physical quantity left. Used quantity and value are
            calculated for you.
          </p>
        </div>
        <Badge tone="purple">DRAFT — not submitted</Badge>
      </div>

      {/* A. Purchased inventory */}
      <div className="panel">
        <h3 className="mb-3 text-[0.95rem] font-semibold text-ink">
          A. Purchased inventory
        </h3>
        <div className="overflow-x-auto">
          <table className="table-base min-w-[720px]">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th className="text-right">On hand</th>
                <th className="text-right">Closing (count)</th>
                <th className="text-right">Used</th>
                <th className="text-right">Avg cost</th>
                <th className="text-right">Value used</th>
              </tr>
            </thead>
            <tbody>
              {purchased.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-ink-muted">
                    No purchased products loaded. Closing inputs will appear
                    when product balances are available from the API.
                  </td>
                </tr>
              ) : (
                purchased.map((p) => {
                  const used = calcUsed(p);
                  const value = used * (p.avgUnitCost || 0);
                  return (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-ink-muted">{p.baseUnit}</td>
                      <td className="num">{p.onHandQty}</td>
                      <td className="num">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="field-input w-24 border-primary/40 bg-primary-soft text-right font-semibold text-primary"
                          value={closingInputs[p.id] ?? ""}
                          onChange={(e) =>
                            setClosingInputs((s) => ({
                              ...s,
                              [p.id]: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="num font-medium">{used.toFixed(2)}</td>
                      <td className="num text-ink-muted">
                        {money(p.avgUnitCost)}
                      </td>
                      <td className="num font-medium">{money(value)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* B. Makeline */}
      {makeline.length > 0 ? (
        <div className="panel border-purple/20">
          <h3 className="mb-3 text-[0.95rem] font-semibold text-purple">
            B. Makeline inventory — quantities only
          </h3>
          <div className="overflow-x-auto">
            <table className="table-base min-w-[520px]">
              <thead>
                <tr>
                  <th>Makeline product</th>
                  <th>Unit</th>
                  <th className="text-right">Available</th>
                  <th className="text-right">Closing (count)</th>
                  <th className="text-right">Used</th>
                </tr>
              </thead>
              <tbody>
                {makeline.map((p) => {
                  const used = calcUsed(p);
                  return (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-ink-muted">{p.baseUnit}</td>
                      <td className="num">{p.onHandQty}</td>
                      <td className="num">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="field-input w-24 border-purple/40 bg-purple-soft text-right font-semibold text-purple"
                          value={closingInputs[p.id] ?? ""}
                          onChange={(e) =>
                            setClosingInputs((s) => ({
                              ...s,
                              [p.id]: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="num font-medium">{used.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Only the orange closing count is editable. Used and value calculate
          automatically (blueprint §14.5).
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" disabled>
            Save draft
          </Button>
          <Button
            onClick={submitClosing}
            disabled={submitting || products.length === 0}
          >
            {submitting ? "Submitting…" : "Submit closing stock"}
          </Button>
        </div>
      </div>
      {msg ? (
        <p
          className={`text-sm ${
            msg.includes("success") ? "text-success" : "text-danger"
          }`}
        >
          {msg}
        </p>
      ) : null}

      {/* Past closings */}
      <div className="panel">
        <h3 className="mb-3 text-[0.95rem] font-semibold">
          Recent closings
        </h3>
        <table className="table-base">
          <thead>
            <tr>
              <th>Closing #</th>
              <th>Status</th>
              <th className="text-right">Value used</th>
              <th className="text-right">Wasted</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-ink-muted">
                  No closings yet
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.closingNo}>
                  <td className="font-medium">{c.closingNo}</td>
                  <td>
                    <Badge
                      tone={
                        c.status === "SUBMITTED" || c.status === "LOCKED"
                          ? "ok"
                          : "info"
                      }
                    >
                      {c.status}
                    </Badge>
                  </td>
                  <td className="num">{money(c.totalValueUsed)}</td>
                  <td className="num">{money(c.totalValueWasted)}</td>
                  <td className="text-ink-muted">
                    {c.submittedAt
                      ? new Date(c.submittedAt).toLocaleString("en-KE")
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
