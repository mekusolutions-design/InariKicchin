"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TypeaheadCombobox } from "@/components/ui/TypeaheadCombobox";

interface MakelineProduct {
  id: string;
  name: string;
  unit: string;
  onHandQty?: number;
  available?: number;
}

const UNITS = ["kg", "g", "l", "ml", "pcs", "pkt", "btl"];

export default function MakelinePage() {
  const [products, setProducts] = useState<MakelineProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(10);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("kg");

  async function load() {
    try {
      const data = await api<MakelineProduct[] | { products?: MakelineProduct[] }>(
        "/makeline",
      );
      const list = Array.isArray(data) ? data : (data.products ?? []);
      setProducts(list);
      if (list[0] && !productId) setProductId(list[0].id);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        label: p.name,
        meta: `${p.unit} · on hand ${p.onHandQty ?? p.available ?? 0}`,
      })),
    [products],
  );

  async function createProduct() {
    setError("");
    try {
      const created = await api<MakelineProduct>("/makeline/products", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), unitCode: newUnit }),
      });
      setProducts((prev) => [...prev, created]);
      setProductId(created.id);
      setShowNew(false);
      setNewName("");
      setMsg(`“${created.name}” added to makeline`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function save() {
    setMsg("");
    setError("");
    if (!productId || qty <= 0) {
      setError("Select a product and enter a positive quantity");
      return;
    }
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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Makeline Inventory</h1>
        <p className="page-sub">
          Kitchen-prepared items · quantity only · separate from purchased stock
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {msg ? <p className="text-sm text-success">{msg}</p> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel space-y-3">
          <h3 className="text-[0.95rem] font-semibold">Record production</h3>
          <TypeaheadCombobox
            label="Makeline product"
            required
            options={options}
            valueId={productId}
            onSelect={(o) => setProductId(o?.id ?? "")}
            onCreate={(typed) => {
              setNewName(typed);
              setShowNew(true);
            }}
            createLabel={(t) => `+ Add “${t}” as makeline product`}
          />
          {showNew ? (
            <div className="rounded-lg border border-purple/30 bg-purple-soft/40 p-3 space-y-2">
              <input
                className="field-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
              />
              <select
                className="field-input"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button type="button" onClick={createProduct}>
                  Save product
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowNew(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
          <div>
            <label className="field-label">Quantity produced *</label>
            <input
              className="field-input"
              type="number"
              min={0.0001}
              step="any"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea
              className="field-input min-h-[64px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button onClick={save} disabled={saving} className="min-h-11">
            {saving ? "Saving…" : "Save production"}
          </Button>
        </div>

        <div className="panel overflow-x-auto">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[0.95rem] font-semibold">Makeline stock</h3>
            <Badge tone="purple">Separate ledger</Badge>
          </div>
          <table className="table-base">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th className="text-right">On hand</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-ink-muted">
                    No makeline products — type a name and add one.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.name}</td>
                    <td className="text-ink-muted">{p.unit}</td>
                    <td className="num font-semibold text-purple">
                      {p.onHandQty ?? p.available ?? 0}
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
