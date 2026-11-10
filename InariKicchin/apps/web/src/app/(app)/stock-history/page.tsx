"use client";

import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface ClosingItem {
  itemType?: string;
  name?: string;
  unit?: string;
  openingQty?: number;
  receivedQty?: number;
  wastageQty?: number;
  availableQty?: number;
  closingQty?: number;
  usedQty?: number;
  avgUnitCost?: number;
  usedValue?: number;
}
interface Closing {
  closingNo: string;
  status: string;
  totalValueUsed: number;
  totalValueWasted: number;
  submittedAt?: string;
  periodEnd?: string;
  periodStart?: string;
  periodDate?: string;
  items?: ClosingItem[];
}

export default function StockHistoryPage() {
  const [rows, setRows] = useState<Closing[]>([]);
  const [selected, setSelected] = useState<Closing | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Closing[]>("/closings")
      .then((data) => {
        setRows(data);
        if (data[0]) setSelected(data[0]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function exportClosingCsv() {
    if (!selected) return;
    const headers = [
      "name",
      "itemType",
      "unit",
      "openingQty",
      "receivedQty",
      "wastageQty",
      "closingQty",
      "usedQty",
      "usedValue",
    ];
    const lines = [headers.join(",")];
    for (const it of selected.items || []) {
      lines.push(
        [
          JSON.stringify(it.name ?? ""),
          it.itemType ?? "",
          it.unit ?? "",
          it.openingQty ?? "",
          it.receivedQty ?? "",
          it.wastageQty ?? "",
          it.closingQty ?? "",
          it.usedQty ?? "",
          it.usedValue ?? "",
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `closing-${selected.closingNo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div>
        <h1 className="page-title">Stock History</h1>
        <p className="mt-2 text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Stock History</h1>
        <p className="page-sub">
          Every closing is saved as a permanent snapshot · reads locked data
          only (never recalculated)
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <div className="panel-tight">
          <h3 className="mb-3 text-[0.85rem] font-semibold">Past closings</h3>
          {loading ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-ink-muted">No closings yet</p>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((c) => {
                const active = selected?.closingNo === c.closingNo;
                return (
                  <li key={c.closingNo}>
                    <button
                      type="button"
                      onClick={() => setSelected(c)}
                      className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                        active
                          ? "bg-purple-soft text-purple"
                          : "hover:bg-bg text-ink"
                      }`}
                    >
                      <div className="text-sm font-semibold">
                        {c.periodDate ||
                          c.periodEnd ||
                          (c.submittedAt
                            ? new Date(c.submittedAt).toLocaleDateString("en-KE")
                            : c.closingNo)}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-muted">
                        Used {money(c.totalValueUsed)}
                      </div>
                      <Badge
                        tone={
                          c.status === "SUBMITTED" || c.status === "LOCKED"
                            ? "ok"
                            : "info"
                        }
                        className="mt-1"
                      >
                        {c.status}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          {selected ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="panel">
                  <div className="label-caps">Value of stock used</div>
                  <div className="kpi-value text-purple">
                    {money(selected.totalValueUsed)}
                  </div>
                </div>
                <div className="panel">
                  <div className="label-caps">Wastage</div>
                  <div className="kpi-value text-danger">
                    {money(selected.totalValueWasted)}
                  </div>
                </div>
                <div className="panel">
                  <div className="label-caps">Status</div>
                  <div className="mt-1.5">
                    <Badge
                      tone={
                        selected.status === "SUBMITTED" ||
                        selected.status === "LOCKED"
                          ? "ok"
                          : "info"
                      }
                    >
                      {selected.status}
                    </Badge>
                  </div>
                </div>
                <div className="panel">
                  <div className="label-caps">Closing #</div>
                  <div className="mt-1.5 text-sm font-semibold">
                    {selected.closingNo}
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[0.95rem] font-semibold">
                    Snapshot detail
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3 py-1.5"
                      onClick={exportClosingCsv}
                      disabled={!selected?.items?.length}
                    >
                      Export CSV
                    </Button>
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3 py-1.5"
                      onClick={() => window.print()}
                    >
                      Print / PDF
                    </Button>
                  </div>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-muted">Submitted</dt>
                    <dd className="font-medium">
                      {selected.submittedAt
                        ? new Date(selected.submittedAt).toLocaleString("en-KE")
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Costing method</dt>
                    <dd className="font-medium">Weighted average</dd>
                  </div>
                </dl>
                {(selected.items || []).length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="table-base min-w-[640px]">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Type</th>
                          <th className="text-right">Open</th>
                          <th className="text-right">Recv</th>
                          <th className="text-right">Waste</th>
                          <th className="text-right">Close</th>
                          <th className="text-right">Used</th>
                          <th className="text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.items!.map((it, idx) => (
                          <tr key={idx}>
                            <td className="font-medium">
                              {it.name || "—"}
                              {it.unit ? (
                                <span className="text-xs text-ink-muted">
                                  {" "}
                                  ({it.unit})
                                </span>
                              ) : null}
                            </td>
                            <td className="text-ink-muted text-xs">
                              {it.itemType || "—"}
                            </td>
                            <td className="num">{it.openingQty ?? "—"}</td>
                            <td className="num">{it.receivedQty ?? "—"}</td>
                            <td className="num">{it.wastageQty ?? "—"}</td>
                            <td className="num">{it.closingQty ?? "—"}</td>
                            <td className="num font-semibold">
                              {it.usedQty ?? "—"}
                            </td>
                            <td className="num">
                              {it.usedValue != null ? money(it.usedValue) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg bg-purple-soft px-3 py-2 text-xs text-[#5b21b6]">
                    Snapshot is locked after submit. Line items will appear when
                    the closing session stored item detail.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="panel">
              <p className="text-sm text-ink-muted">
                Select a closing from the list to inspect the snapshot.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
