"use client";

import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface Closing {
  closingNo: string;
  status: string;
  totalValueUsed: number;
  totalValueWasted: number;
  submittedAt?: string;
  periodEnd?: string;
}

export default function StockHistoryPage() {
  const [rows, setRows] = useState<Closing[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Closing[]>("/closings")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-danger">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Stock History</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Every closing is saved as a permanent snapshot · reads locked data only
        (never recalculated)
      </p>
      <div className="panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[0.72rem] uppercase text-ink-muted">
              <th className="pb-2">Closing #</th>
              <th className="pb-2">Status</th>
              <th className="pb-2 text-right">Value used</th>
              <th className="pb-2 text-right">Wasted</th>
              <th className="pb-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-2 text-ink-muted">
                  No closings yet
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.closingNo} className="border-t border-border">
                  <td className="py-2">{c.closingNo}</td>
                  <td className="py-2">
                    <Badge tone={c.status === "SUBMITTED" ? "ok" : "info"}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {money(c.totalValueUsed)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {money(c.totalValueWasted)}
                  </td>
                  <td className="py-2">
                    {c.submittedAt
                      ? new Date(c.submittedAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink-muted">
          Blueprint §14.6 — export Excel/PDF and day compare are Phase 3 report
          enhancements; snapshots remain immutable.
        </p>
      </div>
    </div>
  );
}
