"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface Row { id: string; name: string; unit: string; onHandQty: number }

export default function MakelinePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Row[]>("/makeline").then(setRows).catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="text-danger">{error}</p>;
  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Makeline Inventory</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Kitchen-prepared items · quantity only (no cost in v1) ·{" "}
        <Badge tone="purple">Makeline</Badge>
      </p>
      <div className="panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[0.72rem] uppercase text-ink-muted">
              <th className="pb-2">Item</th>
              <th className="pb-2 text-right">On hand</th>
              <th className="pb-2">Unit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id} className="border-t border-border">
                <td className="py-2">{x.name}</td>
                <td className="py-2 text-right tabular-nums">{x.onHandQty}</td>
                <td className="py-2">{x.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
