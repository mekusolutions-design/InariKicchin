"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface Supplier { id: string; name: string; isActive: boolean }

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Supplier[]>("/suppliers").then(setRows).catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="text-danger">{error}</p>;
  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Suppliers</h1>
      <p className="mb-5 text-sm text-ink-muted">Supplier master used by Inventory Received</p>
      <div className="panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[0.72rem] uppercase text-ink-muted">
              <th className="pb-2">Name</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={2} className="py-2 text-ink-muted">No suppliers</td></tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2">{s.name}</td>
                  <td className="py-2">
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
    </div>
  );
}
