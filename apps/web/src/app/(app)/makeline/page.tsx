"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface MakelineProduct {
  id: string;
  name: string;
  unit: string;
  opening?: number;
  producedToday?: number;
  available?: number;
}

export default function MakelinePage() {
  const [products, setProducts] = useState<MakelineProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(10);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ products?: MakelineProduct[] } | MakelineProduct[]>("/makeline")
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : ((data as { products?: MakelineProduct[] }).products ?? []);
        setProducts(list);
        if (list[0]) setProductId(list[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function save() {
    setMsg("");
    setSaving(true);
    try {
      await api("/makeline", {
        method: "POST",
        body: JSON.stringify({
          productId,
          quantity: qty,
          notes: notes || undefined,
        }),
      });
      setMsg("Production recorded");
      setNotes("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div>
        <h1 className="page-title">Makeline Inventory</h1>
        <p className="mt-2 text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Makeline Inventory</h1>
        <p className="page-sub">
          Products prepared in the kitchen. Tracked by quantity only (no cost in
          version 1).
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel border-purple/15">
          <h3 className="mb-4 text-[0.95rem] font-semibold">
            Record production
          </h3>
          <div className="space-y-3">
            <div>
              <label className="field-label">Makeline product *</label>
              <select
                className="field-input"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.length === 0 ? (
                  <option value="">No makeline products loaded</option>
                ) : (
                  products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Quantity produced *</label>
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
                <label className="field-label">Unit</label>
                <div className="field-readonly">
                  {products.find((p) => p.id === productId)?.unit ?? "—"}
                </div>
              </div>
            </div>
            <div>
              <label className="field-label">Notes (optional)</label>
              <textarea
                className="field-input min-h-[64px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Marinade, rest time, etc."
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={saving || !productId}>
              {saving ? "Saving…" : "Save production"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setQty(10);
                setNotes("");
                setMsg("");
              }}
            >
              Clear
            </Button>
          </div>
          {msg ? (
            <p
              className={`mt-3 text-sm ${
                msg.includes("recorded") ? "text-success" : "text-danger"
              }`}
            >
              {msg}
            </p>
          ) : null}
          <div className="mt-4 rounded-lg bg-purple-soft p-3 text-sm text-[#5b21b6]">
            <strong>How makeline stock works</strong>
            <ul className="mt-1 list-inside list-disc text-xs">
              <li>Kept separate from purchased inventory</li>
              <li>Quantities and history only — no KSh value in v1</li>
              <li>Included in every closing stock count</li>
              <li>Wastage / adjustments need a reason</li>
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[0.95rem] font-semibold">Makeline stock</h3>
            <Badge tone="purple">Separate from purchased</Badge>
          </div>
          <table className="table-base">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th className="text-right">Available</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-ink-muted">
                    No makeline products returned by the API.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.name}</td>
                    <td className="text-ink-muted">{p.unit}</td>
                    <td className="num font-semibold text-purple">
                      {p.available ?? p.opening ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
