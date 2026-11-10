"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface Line {
  quantity: number;
  nameSnapshot?: string;
  name?: string;
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
  createdAt?: string;
}

function isInHouse(orderType?: string): boolean {
  if (!orderType) return true;
  const t = orderType.toLowerCase();
  return t === "dine in" || t === "dine-in" || t === "pickup" || t === "pick up" || t === "pick-up";
}

function finalStatusFor(orderType?: string): "SERVED" | "COLLECTED" {
  if (!orderType) return "SERVED";
  const t = orderType.toLowerCase();
  if (t.includes("pick")) return "COLLECTED";
  if (t === "dine in" || t === "dine-in") return "SERVED";
  // Delivery platforms typically treat as collected once ready / handed off
  return "COLLECTED";
}

export default function KitchenTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const load = useCallback(() => {
    Promise.all([api<Ticket[]>("/kitchen/tickets"), api<Order[]>("/orders")])
      .then(([t, o]) => {
        setTickets(Array.isArray(t) ? t : []);
        setOrders(Array.isArray(o) ? o : []);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  async function advance(id: string, status: string) {
    if (busy) return;
    setBusy(id);
    setError("");
    setSuccessMsg("");
    try {
      await api(`/kitchen/tickets/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      // Optimistic local update so button disappears immediately
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status } : t)),
      );
      setSuccessMsg(`Ticket updated to ${status}`);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      // If already in final state, treat as success (idempotent)
      if (msg.includes("Invalid kitchen transition") && (msg.includes("SERVED") || msg.includes("COLLECTED"))) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, status: status as Ticket["status"] } : t,
          ),
        );
        setSuccessMsg("Ticket already completed");
        await load();
      } else {
        setError(msg);
      }
    } finally {
      setBusy(null);
    }
  }

  if (error && tickets.length === 0) {
    return (
      <div>
        <h1 className="page-title">Kitchen Tickets</h1>
        <p className="mt-2 text-danger">{error}</p>
        <Button className="mt-3" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  const cols: Record<string, Ticket[]> = {
    NEW: [],
    PREPARING: [],
    READY: [],
  };
  for (const t of tickets) {
    if (t.status === "NEW") cols.NEW.push(t);
    else if (t.status === "PREPARING") cols.PREPARING.push(t);
    else if (t.status === "READY") cols.READY.push(t);
    // SERVED / COLLECTED / CANCELLED intentionally excluded from active board
  }

  function column(
    title: string,
    list: Ticket[],
    getNext: (t: Ticket, o?: Order) => { status: string; label: string } | null,
    success?: boolean,
  ) {
    return (
      <div className="min-h-[220px] rounded-[10px] border border-border bg-bg p-3">
        <h3 className="mb-3 flex items-center gap-2 text-[0.8rem] font-semibold uppercase tracking-wide text-ink-muted">
          {title}
          <Badge tone="info">{list.length}</Badge>
        </h3>
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">No tickets</p>
        ) : (
          list.map((t) => {
            const o = orders.find((x) => x.id === t.orderId);
            const next = getNext(t, o);
            return (
              <div
                key={t.id}
                className="mb-2.5 rounded-lg border border-border bg-surface p-3 shadow-card"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-base">#{t.ticketNo}</strong>
                  <Badge tone="orange">{o?.orderType ?? "—"}</Badge>
                  <Badge tone="neutral">{t.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-ink-muted">
                  {o?.orderNo}
                  {o?.tableNo ? ` · Table ${o.tableNo}` : ""}
                  {o?.deliveryRef ? ` · ${o.deliveryRef}` : ""}
                  {t.createdAt
                    ? ` · ${new Date(t.createdAt).toLocaleTimeString("en-KE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""}
                </div>
                <ul className="mt-2 space-y-0.5 text-sm">
                  {(o?.lines || []).map((l, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-bold tabular-nums text-primary">
                        {l.quantity}×
                      </span>
                      <span>{l.nameSnapshot ?? l.name ?? "Item"}</span>
                    </li>
                  ))}
                </ul>
                {next ? (
                  <Button
                    variant={success ? "success" : "primary"}
                    className="mt-3 w-full"
                    disabled={busy === t.id || busy !== null}
                    onClick={() => advance(t.id, next.status)}
                  >
                    {busy === t.id ? "Updating…" : next.label}
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="page-title">Kitchen Tickets</h1>
          <p className="page-sub">
            New → Preparing → Ready → Served / Collected
          </p>
        </div>
        <Button variant="secondary" className="min-h-9" onClick={load}>
          Refresh
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {successMsg ? <p className="text-sm text-success">{successMsg}</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        {column("New", cols.NEW, () => ({
          status: "PREPARING",
          label: "Start preparing",
        }))}
        {column("Preparing", cols.PREPARING, () => ({
          status: "READY",
          label: "Mark ready",
        }))}
        {column(
          "Ready",
          cols.READY,
          (_t, o) => {
            const final = finalStatusFor(o?.orderType);
            return {
              status: final,
              label: final === "SERVED" ? "Served" : "Collected",
            };
          },
          true,
        )}
      </div>
    </div>
  );
}
