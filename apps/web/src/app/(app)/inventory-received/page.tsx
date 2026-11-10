"use client";

import { useEffect, useMemo, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TypeaheadCombobox } from "@/components/ui/TypeaheadCombobox";

interface Product {
  id: string;
  name: string;
  baseUnit: string;
  category?: string;
  categoryName?: string;
  onHandQty: number;
  avgUnitCost: number;
  minStock?: number;
}
interface Supplier {
  id: string;
  name: string;
  phone?: string;
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
}

const UNITS = ["kg", "g", "l", "ml", "pcs", "pkt", "btl"];
const LAST_SUPPLIER_KEY = "INARI_LAST_SUPPLIER_BY_PRODUCT";

function loadLastSuppliers(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LAST_SUPPLIER_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveLastSupplier(productId: string, supplierId: string) {
  const map = loadLastSuppliers();
  map[productId] = supplierId;
  localStorage.setItem(LAST_SUPPLIER_KEY, JSON.stringify(map));
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

  // inline product create
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newUnit, setNewUnit] = useState("kg");
  const [newMinStock, setNewMinStock] = useState(0);
  const [newCategory, setNewCategory] = useState("General");

  // inline supplier create
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newKra, setNewKra] = useState("");
  const [newSupplierNotes, setNewSupplierNotes] = useState("");

  async function load() {
    try {
      const [p, s] = await Promise.all([
        api<Product[]>("/products"),
        api<Supplier[]>("/suppliers").catch(() => [] as Supplier[]),
      ]);
      setProducts(p);
      setSuppliers(s);
      try {
        const h = await api<PurchaseRow[]>("/purchases").catch(() => []);
        setHistory(Array.isArray(h) ? h.slice(0, 15) : []);
      } catch {
        setHistory([]);
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selected = products.find((p) => p.id === productId);
  const unitPrice = qty > 0 ? total / qty : 0;

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        label: p.name,
        meta: `${p.baseUnit} · ${p.categoryName ?? p.category ?? "—"} · stock ${p.onHandQty}`,
        keywords: `${p.categoryName ?? ""} ${p.category ?? ""}`,
      })),
    [products],
  );

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        id: s.id,
        label: s.name,
        meta: s.phone ?? undefined,
      })),
    [suppliers],
  );

  function onProductSelect(opt: { id: string; label: string } | null) {
    if (!opt) {
      setProductId("");
      return;
    }
    setProductId(opt.id);
    const last = loadLastSuppliers()[opt.id];
    if (last && suppliers.some((s) => s.id === last)) setSupplierId(last);
  }

  async function createProductInline() {
    setError("");
    const name = newProductName.trim();
    if (!name) return;
    const dup = products.find(
      (p) => p.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (dup) {
      setError(`Product “${dup.name}” already exists`);
      return;
    }
    try {
      const created = await api<Product>("/products", {
        method: "POST",
        body: JSON.stringify({
          name,
          baseUnitCode: newUnit,
          categoryName: newCategory,
          minStock: newMinStock,
        }),
      });
      setProducts((prev) => [...prev, created]);
      setProductId(created.id);
      setShowNewProduct(false);
      setNewProductName("");
      setMsg(`Product “${created.name}” created`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create product");
    }
  }

  async function createSupplierInline() {
    setError("");
    const name = newSupplierName.trim();
    if (!name) return;
    try {
      const created = await api<Supplier>("/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone: newPhone || undefined,
          notes: [newKra && `KRA: ${newKra}`, newSupplierNotes]
            .filter(Boolean)
            .join(" | ") || undefined,
        }),
      });
      setSuppliers((prev) => [...prev, created]);
      setSupplierId(created.id);
      setShowNewSupplier(false);
      setNewSupplierName("");
      setMsg(`Supplier “${created.name}” created`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create supplier");
    }
  }

  async function save() {
    setMsg("");
    setError("");
    if (!productId || !supplierId) {
      setError("Product and supplier are required");
      return;
    }
    if (qty <= 0 || total <= 0) {
      setError("Quantity and total must be greater than zero");
      return;
    }
    setSaving(true);
    try {
      await api("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierId,
          dateReceived,
          invoiceNumber: invoice || undefined,
          invoiceNo: invoice || undefined,
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
      saveLastSupplier(productId, supplierId);
      setMsg("Receipt saved — locked; corrections use adjustments");
      setInvoice("");
      setNotes("");
      setExpiry("");
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
        <h1 className="page-title">Inventory Received</h1>
        <p className="page-sub">
          Record every delivery. Type a product or supplier name, or add a new
          one on the spot.
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {msg ? <p className="text-sm text-success">{msg}</p> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel space-y-3">
          <h3 className="text-[0.95rem] font-semibold text-primary">
            New stock receipt
          </h3>

          <TypeaheadCombobox
            label="Product"
            required
            options={productOptions}
            valueId={productId}
            onSelect={onProductSelect}
            onCreate={(typed) => {
              setNewProductName(typed);
              setShowNewProduct(true);
            }}
            createLabel={(t) => `+ Add “${t}” as a new product`}
          />

          {showNewProduct ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="text-sm font-semibold">New product</div>
              <input
                className="field-input"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Name"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label">Unit</label>
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
                </div>
                <div>
                  <label className="field-label">Min stock</label>
                  <input
                    className="field-input"
                    type="number"
                    min={0}
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(Number(e.target.value))}
                  />
                </div>
              </div>
              <input
                className="field-input"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category"
              />
              <div className="flex gap-2">
                <Button type="button" onClick={createProductInline}>
                  Save product
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowNewProduct(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">
                Quantity received <span className="text-danger">*</span>
              </label>
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
              <label className="field-label">
                Total purchase price (KSh) <span className="text-danger">*</span>
              </label>
              <input
                className="field-input"
                type="number"
                min={0.01}
                step="any"
                value={total}
                onChange={(e) => setTotal(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Unit price (auto):{" "}
            <strong>
              {money(unitPrice)} / {selected?.baseUnit ?? "unit"}
            </strong>
          </div>

          <TypeaheadCombobox
            label="Supplier"
            required
            options={supplierOptions}
            valueId={supplierId}
            onSelect={(opt) => setSupplierId(opt?.id ?? "")}
            onCreate={(typed) => {
              setNewSupplierName(typed);
              setShowNewSupplier(true);
            }}
            createLabel={(t) => `+ Add “${t}” as a new supplier`}
          />

          {showNewSupplier ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="text-sm font-semibold">New supplier</div>
              <input
                className="field-input"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Name *"
              />
              <input
                className="field-input"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone"
              />
              <input
                className="field-input"
                value={newKra}
                onChange={(e) => setNewKra(e.target.value)}
                placeholder="KRA PIN (optional)"
              />
              <input
                className="field-input"
                value={newSupplierNotes}
                onChange={(e) => setNewSupplierNotes(e.target.value)}
                placeholder="Notes"
              />
              <div className="flex gap-2">
                <Button type="button" onClick={createSupplierInline}>
                  Save supplier
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowNewSupplier(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Invoice / receipt no.</label>
              <input
                className="field-input"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">
                Date received <span className="text-danger">*</span>
              </label>
              <input
                className="field-input"
                type="date"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="field-label">Expiry date</label>
            <input
              className="field-input"
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
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

          <Button
            onClick={save}
            disabled={saving}
            className="min-h-11 w-full"
          >
            {saving ? "Saving…" : "Save receipt"}
          </Button>
          <p className="text-xs text-ink-muted">
            Saved receipts cannot be edited. Corrections use audited
            adjustments.
          </p>
        </div>

        <div className="panel overflow-x-auto">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[0.95rem] font-semibold">Purchase history</h3>
            <Badge tone="info">{history.length} recent</Badge>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-ink-muted">No receipts yet</p>
          ) : (
            <table className="table-base min-w-[420px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={h.id ?? i}>
                    <td className="text-xs text-ink-muted">
                      {(h.dateReceived ?? "").toString().slice(0, 10)}
                    </td>
                    <td className="font-medium">{h.productName ?? "—"}</td>
                    <td className="num">
                      {h.quantity} {h.unit}
                    </td>
                    <td className="num">{money(h.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
