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

interface PurchasedProduct {
  id: string;
  name: string;
  baseUnit: string;
  onHandQty: number;
}

interface RecipeLine {
  id: string;
  inputProductId: string;
  inputProductName?: string;
  inputUnit?: string;
  quantityPerUnit: number;
}

const UNITS = ["kg", "g", "l", "ml", "pcs", "pkt", "btl"];

export default function MakelinePage() {
  const [products, setProducts] = useState<MakelineProduct[]>([]);
  const [purchased, setPurchased] = useState<PurchasedProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(10);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("kg");
  const [recipes, setRecipes] = useState<RecipeLine[]>([]);
  const [recipeProductId, setRecipeProductId] = useState("");
  const [recipeQty, setRecipeQty] = useState("1");
  const [deductionsOn, setDeductionsOn] = useState(false);

  async function load() {
    try {
      const [data, prods, settings] = await Promise.all([
        api<MakelineProduct[] | { products?: MakelineProduct[] }>("/makeline"),
        api<PurchasedProduct[]>("/products").catch(() => [] as PurchasedProduct[]),
        api<Record<string, string>>("/settings").catch(() => ({} as Record<string, string>)),
      ]);
      const list = Array.isArray(data) ? data : (data.products ?? []);
      setProducts(list);
      setPurchased(Array.isArray(prods) ? prods : []);
      setDeductionsOn(settings.module_makeline_deductions === "1");
      if (list[0] && !productId) setProductId(list[0].id);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  async function loadRecipes(mid: string) {
    if (!mid) {
      setRecipes([]);
      return;
    }
    try {
      const rows = await api<RecipeLine[]>(
        `/recipes?makelineProductId=${encodeURIComponent(mid)}`,
      );
      setRecipes(Array.isArray(rows) ? rows : []);
    } catch {
      setRecipes([]);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadRecipes(productId);
  }, [productId]);

  const options = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        label: p.name,
        meta: `${p.unit} · on hand ${p.onHandQty ?? p.available ?? 0}`,
      })),
    [products],
  );

  const recipePreview = useMemo(() => {
    if (!recipes.length || qty <= 0) return [];
    return recipes.map((r) => ({
      ...r,
      batchNeed: r.quantityPerUnit * qty,
    }));
  }, [recipes, qty]);

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

  async function saveRecipeLine() {
    setError("");
    try {
      if (!productId) throw new Error("Select a makeline product first");
      if (!recipeProductId) throw new Error("Select an ingredient product");
      const q = Number(recipeQty);
      if (!Number.isFinite(q) || q <= 0) throw new Error("Quantity per unit must be positive");
      await api("/recipes", {
        method: "POST",
        body: JSON.stringify({
          outputMakelineId: productId,
          inputProductId: recipeProductId,
          quantityPerUnit: q,
        }),
      });
      setMsg("Recipe line saved");
      setRecipeProductId("");
      setRecipeQty("1");
      await loadRecipes(productId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recipe save failed");
    }
  }

  async function removeRecipe(id: string) {
    try {
      await api(`/recipes/${id}`, { method: "DELETE" });
      await loadRecipes(productId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
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
      const result = await api<{
        recipeDeducted?: Array<{ name: string; qty: number }>;
      }>("/makeline", {
        method: "POST",
        body: JSON.stringify({
          productId,
          makelineProductId: productId,
          quantity: qty,
          notes: notes || undefined,
        }),
      });
      const deducted = result.recipeDeducted ?? [];
      setMsg(
        deducted.length
          ? `Production recorded · deducted ${deducted
              .map((d) => `${d.qty} ${d.name}`)
              .join(", ")}`
          : "Production recorded",
      );
      setNotes("");
      await load();
      await loadRecipes(productId);
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
          {deductionsOn ? " · recipe deductions ON" : ""}
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
            <div className="space-y-2 rounded-lg border border-purple/30 bg-purple-soft/40 p-3">
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

          {recipePreview.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <div className="mb-1 font-semibold">
                Recipe deduction{deductionsOn ? "" : " (preview — enable in Settings)"}
              </div>
              This batch will use:{" "}
              {recipePreview
                .map(
                  (r) =>
                    `${r.inputProductName ?? r.inputProductId} ${r.batchNeed}${
                      r.inputUnit ? ` ${r.inputUnit}` : ""
                    }`,
                )
                .join(", ")}
              {deductionsOn
                ? ". Purchased stock is reduced automatically."
                : ". Turn on “Makeline recipe deductions” in Settings to apply."}
            </div>
          ) : null}

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

      <div className="panel max-w-2xl space-y-3">
        <h3 className="text-[0.95rem] font-semibold">
          Recipe for selected makeline product
        </h3>
        <p className="text-xs text-ink-muted">
          Ingredients per 1 unit produced. Used when Settings → Makeline recipe
          deductions is ON.
        </p>
        {!productId ? (
          <p className="text-sm text-ink-muted">Select a makeline product above.</p>
        ) : (
          <>
            <ul className="space-y-1 text-sm">
              {recipes.length === 0 ? (
                <li className="text-ink-muted">No recipe lines yet.</li>
              ) : (
                recipes.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-1.5"
                  >
                    <span>
                      {r.inputProductName ?? r.inputProductId} ·{" "}
                      <strong>{r.quantityPerUnit}</strong>
                      {r.inputUnit ? ` ${r.inputUnit}` : ""} / unit
                    </span>
                    <button
                      type="button"
                      className="text-xs text-danger underline"
                      onClick={() => removeRecipe(r.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
              <select
                className="field-input"
                value={recipeProductId}
                onChange={(e) => setRecipeProductId(e.target.value)}
              >
                <option value="">Ingredient (purchased)…</option>
                {purchased.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.onHandQty} {p.baseUnit})
                  </option>
                ))}
              </select>
              <input
                className="field-input"
                type="number"
                min="0.0001"
                step="any"
                value={recipeQty}
                onChange={(e) => setRecipeQty(e.target.value)}
                placeholder="Qty/unit"
              />
              <Button type="button" onClick={saveRecipeLine}>
                Add line
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
