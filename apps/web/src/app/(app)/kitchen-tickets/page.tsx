"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface Line {
  quantity: number;
  nameSnapshot: string;
}
interface Order {
  id: string;
  orderNo: string;
  orderType: string;
  tableNo?: string;
  deliveryRef?: string;
  lines: Line[];
}
interface Ticket {
  id: string;
  ticketNo: string;
  orderId: string;
  status: string;
}

export default function KitchenTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    Promise.all([api<Ticket[]>("/kitchen/tickets"), api<Order[]>("/orders")])
      .then(([t, o]) => {
        setTickets(t);
        setOrders(o);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function advance(id: string, status: string) {
    await api(`/kitchen/tickets/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    load();
  }

  if (error) return <p className="text-danger">{error}</p>;

  const cols: Record<string, Ticket[]> = {
    NEW: [],
    PREPARING: [],
    READY: [],
  };
  for (const t of tickets) {
    if (t.status === "NEW") cols.NEW.push(t);
    else if (t.status === "PREPARING") cols.PREPARING.push(t);
    else if (["READY", "SERVED", "COLLECTED"].includes(t.status))
      cols.READY.push(t);
  }

  function column(
    title: string,
    list: Ticket[],
    next: string | null,
    label: string,
    success?: boolean,
  ) {
    return (
      <div className="min-h-[200px] rounded-[10px] border border-border bg-bg p-3">
        <h3 className="mb-2 text-[0.8rem] font-semibold uppercase tracking-wide text-ink-muted">
          {title}{" "}
          <Badge tone="info">{list.length}</Badge>
        </h3>
        {list.length === 0 ? (
          <p className="text-sm text-ink-muted">Empty</p>
        ) : (
          list.map((t) => {
            const o = orders.find((x) => x.id === t.orderId);
            return (
              <div
                key={t.id}
                className="mb-2.5 rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex items-center gap-2">
                  <strong>#{t.ticketNo}</strong>
                  <Badge tone="orange">{o?.orderType ?? ""}</Badge>
                </div>
                <div className="mt-1 text-xs text-ink-muted">
                  {o?.orderNo} · {o?.tableNo || o?.deliveryRef || ""}
                </div>
                <ul className="mt-2 list-disc pl-4 text-sm">
                  {(o?.lines || []).map((l, i) => (
                    <li key={i}>
                      {l.quantity} × {l.nameSnapshot}
                    </li>
                  ))}
                </ul>
                {next ? (
                  <Button
                    variant={success ? "success" : "primary"}
                    className="mt-2 w-full"
                    onClick={() => advance(t.id, next)}
                  >
                    {label}
                  </Button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Kitchen Tickets</h1>
      <p className="mb-5 text-sm text-ink-muted">
        New → Preparing → Ready → Served / Collected
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {column("New", cols.NEW, "PREPARING", "Start preparing")}
        {column("Preparing", cols.PREPARING, "READY", "Mark ready")}
        {column("Ready", cols.READY, "SERVED", "Served", true)}
      </div>
    </div>
  );
}
