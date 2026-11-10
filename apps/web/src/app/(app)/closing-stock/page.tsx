"use client";

import { useCallback, useEffect, useState } from "react";
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
  baseUnit?: string;
  unit?: string;
  onHandQty: number;
  avgUnitCost?: number;
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
  const [loading, setLoading] = useState(true);
  const [wasteProductId, setWasteProductId] = useState("");
  const [wasteQty, setWasteQty] = useState("");
  const [wasteReason, setWasteReason] = useState("");
  const [wasteSaving, setWasteSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [closings, prods, makeline] = await Promise.all([
        api<Closing[]>("/closings").catch(() => [] as Closing[]),
        api<ProductBalance[]>("/products").catch(() => [] as ProductBalance[]),
        api<ProductBalance[] | { products?: ProductBalance[] }>("/makeline").catch(
          () => [] as ProductBalance[],
        ),
      ]);
      const mkList = Array.isArray(makeline)
        ? makeline
        : (makeline as { products?: ProductBalance[] }).products ?? [];
      const mk = mkList.map((m) => ({
        ...m,
        baseUnit: m.baseUnit || m.unit || "pcs",
        avgUnitCost: m.avgUnitCost ?? 0,
        kind: "makeline" as const,
      }));
      const purchased = prods.map((p) => ({
        ...p,
        kind: (p.kind || "purchased") as "purchased",
      }));
      const all = [...purchased, ...mk];
      setRows(Array.isArray(closings) ? closings : []);
      setProducts(all);
      const init: Record<string, string> = {};
      all.forEach((p) => {
        init[p.id] = String(p.onHandQty ?? 0);
      });
      setClosingInputs(init);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const purchased = products.filter((p) => p.kind !== "makeline");
  const makeline = products.filter((p) => p.kind === "makeline");

  function calcUsed(p: ProductBalance) {
    const close = Number(closingInputs[p.id] ?? p.onHandQty);
    if (!Number.isFinite(close)) return 0;
    return Math.max(0, (p.onHandQty ?? 0) - close);
  }

  async function submitClosing() {
    setMsg("");
    setError("");
    setSubmitting(true);
    try {
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Africa/Nairobi",
      });
      const items = products.map((p) => {
        const closingQty = Number(closingInputs[p.id] ?? 0);
        if (!Number.isFinite(closingQty) || closingQty < 0) {
          throw new Error(`Invalid closing quantity for ${p.name}`);
        }
        if (p.kind === "makeline") {
          return {
            itemType: "MAKELINE" as const,
            makelineProductId: p.id,
            closingQty,
          };
        }
        return {
          itemType: "PRODUCT" as const,
          productId: p.id,
          closingQty,
        };
      });
      const idem = `close-${today}-${Date.now()}`;
      await api("/closings", {
        method: "POST",
        headers: { "Idempotency-Key": idem },
        body: JSON.stringify({
          items,
          periodStart: `${today}T00:00:00+03:00`,
          periodEnd: `${today}T23:59:59+03:00`,
          idempotencyKey: idem,
        }),
      });
      setMsg("Closing submitted successfully");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  function section(
    title: string,
    list: ProductBalance[],
    showCost: boolean,
  ) {
    return (
      <div className="panel">
        <h3 className="mb-3 text-[0.95rem] font-semibold text-ink">{title}</h3>
        <div className="overflow-x-auto">
          <table className="table-base min-w-[720px]">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th className="text-right">On hand</th>
                <th className="text-right">Closing (count)</th>
                <th className="text-right">Used</th>
                {showCost ? (
                  <>
                    <th className="text-right">Avg cost</th>
                    <th className="text-right">Value used</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td
                    colSpan={showCost ? 7 : 5}
                    className="py-4 text-ink-muted"
                  >
                    No products in this group.
                  </td>
                </tr>
              ) : (
                list.map((p) => {
                  const used = calcUsed(p);
                  const value = used * (p.avgUnitCost || 0);
                  return (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-ink-muted">
                        {p.baseUnit || p.unit || "—"}
                      </td>
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
                      <td className="num font-semibold">{used.toFixed(3)}</td>
                      {showCost ? (
                        <>
                          <td className="num text-ink-muted">
                            {money(p.avgUnitCost || 0)}
                          </td>
                          <td className="num font-semibold">{money(value)}</td>
                        </>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error && products.length === 0 && !loading) {
    return (
      <div>
        <h1 className="page-title">Closing Stock</h1>
        <p className="mt-2 text-danger">{error}</p>
        <Button className="mt-3" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  const totalUsedValue = purchased.reduce(
    (s, p) => s + calcUsed(p) * (p.avgUnitCost || 0),
    0,
  );

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
        <Badge tone="purple">
          {loading ? "Loading…" : "Ready to submit"}
        </Badge>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {msg ? <p className="text-sm text-success">{msg}</p> : null}

      {section("A. Purchased inventory", purchased, true)}
      {section("B. Makeline inventory (quantity only)", makeline, false)}

      <div className="panel flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-ink-muted">Estimated purchased value used: </span>
          <strong className="tabular-nums">{money(totalUsedValue)}</strong>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} disabled={submitting}>
            Reload balances
          </Button>
          <Button
            onClick={submitClosing}
            disabled={submitting || products.length === 0}
          >
            {submitting ? "Submitting…" : "Submit closing"}
          </Button>
        </div>
      </div>


      <div className="panel max-w-xl space-y-3">
        <h3 className="text-[0.95rem] font-semibold">Record wastage</h3>
        <p className="text-xs text-ink-muted">
          Reduces on-hand stock with a required reason. Shown separately from normal use in closings.
        </p>
        <div>
          <label className="field-label">Product</label>
          <select
            className="field-input"
            value={wasteProductId}
            onChange={(e) => setWasteProductId(e.target.value)}
          >
            <option value="">Select…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.kind === "makeline" ? "[Makeline] " : ""}
                {p.name} ({p.onHandQty} {p.baseUnit || p.unit || ""})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Quantity</label>
            <input
              className="field-input"
              type="number"
              min="0.0001"
              step="any"
              value={wasteQty}
              onChange={(e) => setWasteQty(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Reason *</label>
            <input
              className="field-input"
              value={wasteReason}
              onChange={(e) => setWasteReason(e.target.value)}
              placeholder="Spoilage, drop, overcook…"
            />
          </div>
        </div>
        <Button
          disabled={wasteSaving}
          onClick={async () => {
            setError("");
            setMsg("");
            setWasteSaving(true);
            try {
              const p = products.find((x) => x.id === wasteProductId);
              if (!p) throw new Error("Select a product");
              const q = Number(wasteQty);
              if (!Number.isFinite(q) || q <= 0) throw new Error("Quantity must be positive");
              if (!wasteReason.trim()) throw new Error("Reason is required");
              await api("/wastage", {
                method: "POST",
                body: JSON.stringify({
                  productId: p.kind === "makeline" ? undefined : p.id,
                  makelineProductId: p.kind === "makeline" ? p.id : undefined,
                  quantityBase: q,
                  reasonCode: wasteReason.trim(),
                  wastedOn: new Date().toISOString().slice(0, 10),
                }),
              });
              setMsg("Wastage recorded");
              setWasteQty("");
              setWasteReason("");
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Wastage failed");
            } finally {
              setWasteSaving(false);
            }
          }}
        >
          {wasteSaving ? "Saving…" : "Save wastage"}
        </Button>
      </div>

      {rows.length > 0 ? (
        <div className="panel">
          <h3 className="mb-2 text-[0.95rem] font-semibold">Recent closings</h3>
          <ul className="space-y-1 text-sm">
            {rows.slice(0, 8).map((c) => (
              <li
                key={c.closingNo}
                className="flex flex-wrap justify-between gap-2 border-b border-border py-1.5"
              >
                <span className="font-medium">{c.closingNo}</span>
                <span className="text-ink-muted">
                  {c.periodDate ||
                    (c.submittedAt
                      ? new Date(c.submittedAt).toLocaleString("en-KE")
                      : "")}
                </span>
                <span className="tabular-nums">
                  Used {money(c.totalValueUsed)} · Waste{" "}
                  {money(c.totalValueWasted)}
                </span>
                <Badge tone={c.status === "SUBMITTED" ? "ok" : "info"}>
                  {c.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
