"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface Supplier {
  id: string;
  name: string;
  isActive: boolean;
  phone?: string;
  email?: string;
  contactName?: string;
}

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<Supplier[]>("/suppliers")
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (error) {
    return (
      <div>
        <h1 className="page-title">Suppliers</h1>
        <p className="mt-2 text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Suppliers</h1>
        <p className="page-sub">
          Supplier master used by Inventory Received · purchase history per
          supplier
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field-input max-w-xs"
          placeholder="Search suppliers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Badge tone="info">{filtered.length} suppliers</Badge>
      </div>

      <div className="panel">
        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[480px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-ink-muted">
                      No suppliers found
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td className="text-ink-muted">
                        {s.contactName || s.email || "—"}
                      </td>
                      <td className="text-ink-muted">{s.phone || "—"}</td>
                      <td>
                        <Badge tone={s.isActive ? "ok" : "warn"}>
                          {s.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
