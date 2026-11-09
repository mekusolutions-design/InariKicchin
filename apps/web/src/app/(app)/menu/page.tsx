"use client";

import { useEffect, useMemo, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  category?: string;
  code?: string;
}

interface MenuRes {
  items: MenuItem[];
  categories?: string[];
}

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<MenuRes>("/menu")
      .then((m) => setItems(m.items ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
      if (category !== "All" && item.category !== category) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, category, search]);

  if (error) {
    return (
      <div>
        <h1 className="page-title">Menu Management</h1>
        <p className="mt-2 text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Menu Management</h1>
        <p className="page-sub">
          Items saved here appear in the POS immediately
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field-input max-w-xs"
          placeholder="Search menu items…"
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
      </div>

      <div className="panel">
        {loading ? (
          <p className="text-sm text-ink-muted">Loading menu…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[560px]">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="text-right">Price KSh</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-ink-muted">
                      No menu items match the filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((i) => (
                    <tr
                      key={i.id}
                      className={!i.isAvailable ? "opacity-60" : undefined}
                    >
                      <td className="text-ink-muted">{i.code ?? "—"}</td>
                      <td className="font-medium">{i.name}</td>
                      <td className="text-ink-muted">{i.category ?? "—"}</td>
                      <td className="num font-semibold">{money(i.price)}</td>
                      <td>
                        <Badge tone={i.isAvailable ? "ok" : "warn"}>
                          {i.isAvailable ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          Price changes and deactivation write through the API when those
          endpoints are available. Deactivate instead of delete so history is
          preserved (blueprint §14.7).
        </p>
      </div>
    </div>
  );
}
