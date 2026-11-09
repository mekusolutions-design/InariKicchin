"use client";

import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface Product {
  id: string;
  name: string;
  baseUnit: string;
  onHandQty: number;
  avgUnitCost: number;
}
interface Supplier {
  id: string;
  name: string;
}

export default function InventoryReceivedPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(5);
  const [total, setTotal] = useState(2500);
  const [supplierId, setSupplierId] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [p, s] = await Promise.all([
        api<Product[]>("/products"),
        api<Supplier[]>("/suppliers").catch(() => [] as Supplier[]),
      ]);
      setProducts(p);
      setSuppliers(s);
      if (p[0]) setProductId(p[0].id);
      if (s[0]) setSupplierId(s[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const unitPrice = qty > 0 ? total / qty : 0;
  const selected = products.find((p) => p.id === productId);

  async function save() {
    setMsg("");
    try {
      await api("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierId,
          dateReceived: new Date().toISOString().slice(0, 10),
          items: [
            {
              productId,
              quantity: qty,
              unit: selected?.baseUnit ?? "kg",
              totalPrice: total,
            },
          ],
        }),
      });
      setMsg("Receipt saved");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  if (error) return <p className="text-danger">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Inventory Received</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Record every delivery. Unit price is calculated automatically.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel">
          <h3 className="mb-3 text-[0.95rem] font-semibold">New stock receipt</h3>
          <div className="mb-3 flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-[0.72rem] font-semibold text-ink-muted">
              Product *
              <select
                className="min-h-11 rounded-lg border border-border px-3 text-sm"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.baseUnit})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[0.72rem] font-semibold text-ink-muted">
              Qty *
              <input
                type="number"
                step="0.001"
                className="min-h-11 w-28 rounded-lg border border-border px-3 text-sm"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-[0.72rem] font-semibold text-ink-muted">
              Total KSh *
              <input
                type="number"
                step="0.01"
                className="min-h-11 w-32 rounded-lg border border-border px-3 text-sm"
                value={total}
                onChange={(e) => setTotal(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-[0.72rem] font-semibold text-ink-muted">
              Unit price (auto)
              <input
                readOnly
                className="min-h-11 rounded-lg border border-success/30 bg-success-soft px-3 text-sm font-semibold text-[#166534]"
                value={qty > 0 ? `${money(unitPrice)} / unit` : "—"}
              />
            </label>
            <label className="flex flex-col gap-1 text-[0.72rem] font-semibold text-ink-muted">
              Supplier *
              <select
                className="min-h-11 rounded-lg border border-border px-3 text-sm"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save}>Save receipt</Button>
            <Button variant="danger-outline">
              Record supplier return / damaged delivery
            </Button>
          </div>
          {msg ? (
            <p className="mt-3">
              <Badge tone={msg.includes("saved") ? "ok" : "err"}>{msg}</Badge>
            </p>
          ) : null}
          <p className="mt-3 text-xs text-ink-muted">
            Saved receipts cannot be edited or deleted. Corrections use audited
            adjustments.
          </p>
        </div>
        <div className="panel">
          <h3 className="mb-3 text-[0.95rem] font-semibold">On-hand stock</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[0.72rem] uppercase text-ink-muted">
                <th className="pb-2">Product</th>
                <th className="pb-2 text-right">On hand</th>
                <th className="pb-2 text-right">Avg cost</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-right tabular-nums">
                    {p.onHandQty} {p.baseUnit}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {money(p.avgUnitCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
