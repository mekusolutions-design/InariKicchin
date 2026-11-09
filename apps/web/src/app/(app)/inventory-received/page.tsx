"use client";

import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface Product {
  id: string;
  name: string;
  baseUnit: string;
  category?: string;
  onHandQty: number;
  avgUnitCost: number;
}
interface Supplier {
  id: string;
  name: string;
}
interface PurchaseRow {
  id?: string;
  dateReceived?: string;
  productName?: string;
  quantity?: number;
  unit?: string;
  totalPrice?: number;
  unitPrice?: number;
  supplierName?: string;
  invoiceNumber?: string;
  expiryDate?: string;
}

export default function InventoryReceivedPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [history, setHistory] = useState<PurchaseRow[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(20);
  const [total, setTotal] = useState(6000);
  const [supplierId, setSupplierId] = useState("");
  const [invoice, setInvoice] = useState("");
  const [dateReceived, setDateReceived] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [p, s] = await Promise.all([
        api<Product[]>("/products"),
        api<Supplier[]>("/suppliers").catch(() => [] as Supplier[]),
      ]);
      setProducts(p);
      setSuppliers(s);
      if (p[0] && !productId) setProductId(p[0].id);
      if (s[0] && !supplierId) setSupplierId(s[0].id);
      // Optional history endpoint; tolerate absence
      try {
        const h = await api<PurchaseRow[]>("/purchases").catch(() => []);
        setHistory(Array.isArray(h) ? h.slice(0, 20) : []);
      } catch {
        setHistory([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unitPrice = qty > 0 ? total / qty : 0;
  const selected = products.find((p) => p.id === productId);

  async function save() {
    setMsg("");
    setSaving(true);
    try {
      await api("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierId,
          dateReceived,
          invoiceNumber: invoice || undefined,
          notes: notes || undefined,
          items: [
            {
              productId,
              quantity: qty,
              unit: selected?.baseUnit ?? "kg",
              totalPrice: total,
              expiryDate: expiry || undefined,
            },
          ],
        }),
      });
      setMsg("Receipt saved successfully");
      setInvoice("");
      setNotes("");
      setExpiry("");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function clearForm() {
    setQty(20);
    setTotal(6000);
    setInvoice("");
    setNotes("");
    setExpiry("");
    setMsg("");
  }

  if (error) {
    return (
      <div>
        <h1 className="page-title">Inventory Received</h1>
        <p className="mt-2 text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Inventory Received</h1>
        <p className="page-sub">
          Record every delivery. Unit price is calculated automatically.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: New stock receipt form — Blueprint §14.3 */}
        <div className="panel">
          <h3 className="mb-4 text-[0.95rem] font-semibold">
            New stock receipt
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="field-label">Product *</label>
              <select
                className="field-input"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Category (auto)</label>
              <div className="field-readonly">
                {selected?.category ?? "—"}
              </div>
            </div>
            <div>
              <label className="field-label">Unit *</label>
              <div className="field-readonly">
                {selected?.baseUnit ?? "—"}
              </div>
            </div>
            <div>
              <label className="field-label">Quantity received *</label>
              <input
                type="number"
                min={0.001}
                step="any"
                className="field-input"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="field-label">
                Total purchase price (KSh) *
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="field-input"
                value={total}
                onChange={(e) => setTotal(Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Unit price (auto)</label>
              <div className="field-readonly">
                {money(unitPrice)} / {selected?.baseUnit ?? "unit"}
              </div>
            </div>
            <div>
              <label className="field-label">Supplier *</label>
              <select
                className="field-input"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                {suppliers.length === 0 ? (
                  <option value="">No suppliers loaded</option>
                ) : (
                  suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="field-label">Invoice / receipt no.</label>
              <input
                className="field-input"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
                placeholder="INV-20418"
              />
            </div>
            <div>
              <label className="field-label">Date received *</label>
              <input
                type="date"
                className="field-input"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Expiry date</label>
              <input
                type="date"
                className="field-input"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Notes (optional)</label>
              <textarea
                className="field-input min-h-[72px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Delivered condition, jerrycans, etc."
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-slate-50 p-3 text-sm">
            <div className="label-caps mb-1">Live unit-price calculation</div>
            <p className="text-ink-muted">
              Unit price = Total purchase price / Quantity
            </p>
            <p className="mt-1 font-medium text-success">
              {money(total)} / {qty} {selected?.baseUnit ?? "units"} ={" "}
              {money(unitPrice)} per {selected?.baseUnit ?? "unit"}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving || !productId}>
              {saving ? "Saving…" : "Save receipt"}
            </Button>
            <Button variant="secondary" onClick={clearForm}>
              Clear
            </Button>
          </div>
          {msg ? (
            <p
              className={`mt-3 text-sm ${
                msg.includes("success") ? "text-success" : "text-danger"
              }`}
            >
              {msg}
            </p>
          ) : null}
        </div>

        {/* Right: Purchase history */}
        <div className="panel">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[0.95rem] font-semibold">Purchase history</h3>
            <Badge tone="info">{history.length} recent</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base min-w-[480px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Unit</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-ink-muted">
                      No purchase history returned by the API yet. Saved
                      receipts will appear here when the endpoint is available.
                    </td>
                  </tr>
                ) : (
                  history.map((row, i) => (
                    <tr key={row.id ?? i}>
                      <td className="whitespace-nowrap text-ink-muted">
                        {row.dateReceived ?? "—"}
                      </td>
                      <td className="font-medium">
                        {row.productName ?? "—"}
                      </td>
                      <td className="num">
                        {row.quantity ?? "—"} {row.unit ?? ""}
                      </td>
                      <td className="num">
                        {row.totalPrice != null
                          ? money(row.totalPrice)
                          : "—"}
                      </td>
                      <td className="num text-ink-muted">
                        {row.unitPrice != null
                          ? money(row.unitPrice)
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Saved receipts cannot be edited. Corrections use audited
            adjustments.
          </p>
        </div>
      </div>
    </div>
  );
}
