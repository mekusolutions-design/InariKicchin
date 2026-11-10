"use client";

import { useCallback, useEffect, useMemo, useState , type FormEvent } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  isActive?: boolean;
  category?: string;
  code?: string | null;
  description?: string | null;
}

interface MenuRes {
  items: MenuItem[];
  categories?: string[];
}

type FormState = {
  id?: string;
  name: string;
  code: string;
  category: string;
  price: string;
  description: string;
  isAvailable: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  code: "",
  category: "",
  price: "",
  description: "",
  isAvailable: true,
});

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showCats, setShowCats] = useState(false);
  const [catRows, setCatRows] = useState<Array<{ id: string; name: string; itemCount?: number }>>([]);
  const [newCat, setNewCat] = useState("");
  const [catBusy, setCatBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<MenuRes>("/menu")
      .then((m) => setItems(m.items ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function loadCategories() {
    try {
      const rows = await api<Array<{ id: string; name: string; itemCount?: number }>>(
        "/menu/categories",
      );
      setCatRows(Array.isArray(rows) ? rows : []);
    } catch {
      setCatRows([]);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return ["All", ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!showArchived && item.isActive === false) return false;
      if (category !== "All" && item.category !== category) return false;
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !(item.code ?? "").toLowerCase().includes(q) &&
        !(item.category ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [items, category, search, showArchived]);

  function openCreate() {
    setForm(emptyForm());
    setShowForm(true);
    setError("");
    setMsg("");
  }

  function openEdit(item: MenuItem) {
    setForm({
      id: item.id,
      name: item.name,
      code: item.code ?? "",
      category: item.category ?? "",
      price: String(item.price),
      description: item.description ?? "",
      isAvailable: item.isAvailable,
    });
    setShowForm(true);
    setError("");
    setMsg("");
  }

  async function saveForm(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        category: form.category.trim() || "Uncategorised",
        price: Number(form.price),
        description: form.description.trim() || undefined,
        isAvailable: form.isAvailable,
      };
      if (!payload.name) throw new Error("Name is required");
      if (!Number.isFinite(payload.price) || payload.price <= 0) {
        throw new Error("Price must be greater than zero");
      }
      if (form.id) {
        await api(`/menu/items/${form.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setMsg("Menu item updated");
      } else {
        await api("/menu/items", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMsg("Menu item created");
      }
      setShowForm(false);
      setForm(emptyForm());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(item: MenuItem) {
    setError("");
    try {
      if (item.isActive === false) {
        await api(`/menu/items/${item.id}/archive`, {
          method: "POST",
          body: JSON.stringify({ isActive: true }),
        });
        setMsg("Item restored");
      } else if (item.isAvailable) {
        // Mark unavailable (sold out) without archiving
        await api(`/menu/items/${item.id}`, {
          method: "PUT",
          body: JSON.stringify({ isAvailable: false }),
        });
        setMsg("Marked sold out");
      } else {
        await api(`/menu/items/${item.id}`, {
          method: "PUT",
          body: JSON.stringify({ isAvailable: true }),
        });
        setMsg("Marked available");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function archiveItem(item: MenuItem) {
    if (!confirm(`Archive “${item.name}”? Past orders keep their history.`)) return;
    setError("");
    try {
      await api(`/menu/items/${item.id}/archive`, {
        method: "POST",
        body: JSON.stringify({ archive: true }),
      });
      setMsg("Item archived");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="page-title">Menu Management</h1>
          <p className="page-sub">Items saved here appear in the POS immediately</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setShowCats((v) => !v);
              void loadCategories();
            }}
          >
            Manage categories
          </Button>
          <Button onClick={openCreate}>+ New menu item</Button>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {msg ? <p className="text-sm text-success">{msg}</p> : null}

      {showCats ? (
        <div className="panel max-w-lg space-y-3">
          <h2 className="text-base font-semibold">Categories</h2>
          <ul className="space-y-1 text-sm">
            {catRows.length === 0 ? (
              <li className="text-ink-muted">No categories yet — create one or use a name on a menu item.</li>
            ) : (
              catRows.map((c) => (
                <li key={c.id} className="flex justify-between gap-2 border-b border-border py-1.5">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-ink-muted">{c.itemCount ?? 0} items</span>
                </li>
              ))
            )}
          </ul>
          <div className="flex gap-2">
            <input
              className="field-input flex-1"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="New category name"
            />
            <Button
              disabled={catBusy}
              onClick={async () => {
                setCatBusy(true);
                setError("");
                try {
                  if (!newCat.trim()) throw new Error("Name required");
                  await api("/menu/categories", {
                    method: "POST",
                    body: JSON.stringify({ name: newCat.trim() }),
                  });
                  setNewCat("");
                  setMsg("Category created");
                  await loadCategories();
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                } finally {
                  setCatBusy(false);
                }
              }}
            >
              Add
            </Button>
          </div>
        </div>
      ) : null}


      {showForm ? (
        <div className="panel max-w-lg space-y-3">
          <h2 className="text-base font-semibold">
            {form.id ? "Edit menu item" : "New menu item"}
          </h2>
          <form onSubmit={saveForm} className="space-y-3">
            <div>
              <label className="field-label">Item name *</label>
              <input
                className="field-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Code</label>
                <input
                  className="field-input"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="field-label">Category *</label>
                <input
                  className="field-input"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  list="menu-categories"
                  placeholder="Mains, Sushi…"
                  required
                />
                <datalist id="menu-categories">
                  {categories
                    .filter((c) => c !== "All")
                    .map((c) => (
                      <option key={c} value={c} />
                    ))}
                </datalist>
              </div>
            </div>
            <div>
              <label className="field-label">Price (KSh, VAT inclusive) *</label>
              <input
                className="field-input"
                type="number"
                min="0.01"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="field-label">Description</label>
              <textarea
                className="field-input min-h-[64px]"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isAvailable: e.target.checked }))
                }
              />
              Available on POS
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : form.id ? "Save changes" : "Create item"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field-input max-w-xs"
          placeholder="Search by name, code or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                category === c
                  ? "bg-primary text-white"
                  : "border border-border bg-white text-ink-muted hover:bg-bg"
              }`}
            >
              {c}
              {c === "All" ? ` (${items.length})` : ""}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      <div className="panel">
        {loading ? (
          <p className="text-sm text-ink-muted">Loading menu…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[640px]">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="text-right">Price KSh</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-ink-muted">
                      No menu items match the filter.{" "}
                      <button
                        type="button"
                        className="text-primary underline"
                        onClick={openCreate}
                      >
                        Create one
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((i) => (
                    <tr
                      key={i.id}
                      className={!i.isAvailable || i.isActive === false ? "opacity-60" : undefined}
                    >
                      <td className="text-ink-muted">{i.code ?? "—"}</td>
                      <td className="font-medium">{i.name}</td>
                      <td className="text-ink-muted">{i.category ?? "—"}</td>
                      <td className="num font-semibold">{money(i.price)}</td>
                      <td>
                        <Badge
                          tone={
                            i.isActive === false
                              ? "warn"
                              : i.isAvailable
                                ? "ok"
                                : "warn"
                          }
                        >
                          {i.isActive === false
                            ? "Archived"
                            : i.isAvailable
                              ? "Available"
                              : "Sold out"}
                        </Badge>
                      </td>
                      <td className="space-x-2 whitespace-nowrap text-right">
                        <button
                          type="button"
                          className="text-sm text-primary underline"
                          onClick={() => openEdit(i)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-sm text-ink-muted underline"
                          onClick={() => toggleAvailability(i)}
                        >
                          {i.isActive === false
                            ? "Restore"
                            : i.isAvailable
                              ? "Sold out"
                              : "Available"}
                        </button>
                        {i.isActive !== false ? (
                          <button
                            type="button"
                            className="text-sm text-danger underline"
                            onClick={() => archiveItem(i)}
                          >
                            Archive
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          Price changes apply to new orders only. Past orders keep the price they
          were sold at. Archive instead of delete so history is preserved.
        </p>
      </div>
    </div>
  );
}
