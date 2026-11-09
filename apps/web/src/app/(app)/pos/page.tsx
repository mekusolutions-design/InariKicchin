"use client";

import { useEffect, useMemo, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import clsx from "clsx";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
}
interface Meta {
  orderTypes: Array<{ name: string }>;
}

export default function PosPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orderTypes, setOrderTypes] = useState<string[]>([]);
  const [orderType, setOrderType] = useState("Dine In");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [ref, setRef] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<{ items: MenuItem[] }>("/menu"), api<Meta>("/meta")])
      .then(([menu, meta]) => {
        setItems(menu.items);
        setOrderTypes(meta.orderTypes.map((t) => t.name));
        if (meta.orderTypes[0]) setOrderType(meta.orderTypes[0].name);
      })
      .catch((e) => setError(e.message));
  }, []);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([id, quantity]) => {
          const item = items.find((m) => m.id === id)!;
          return { item, quantity, line: item.price * quantity };
        }),
    [cart, items],
  );
  const total = lines.reduce((s, l) => s + l.line, 0);

  function add(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  }

  async function complete() {
    setResult("");
    try {
      if (!lines.length) throw new Error("Cart is empty");
      const data = await api<{
        order: { orderNo: string; paymentStatus: string; grandTotal: number };
        ticket?: { ticketNo: string };
      }>("/pos/orders", {
        method: "POST",
        body: JSON.stringify({
          orderType,
          idempotencyKey: `next-${Date.now()}`,
          tableNo: orderType === "Dine In" ? ref : undefined,
          deliveryRef: !["Dine In", "Pick Up"].includes(orderType)
            ? ref
            : undefined,
          lines: lines.map((l) => ({
            menuItemId: l.item.id,
            quantity: l.quantity,
          })),
          payments: [
            { method: "M-Pesa", amount: total, reference: "NEXT-DEMO" },
          ],
        }),
      });
      setCart({});
      setResult(
        `${data.order.paymentStatus} · ${data.order.orderNo} · ${money(data.order.grandTotal)} · ticket #${data.ticket?.ticketNo ?? "—"}`,
      );
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Failed");
    }
  }

  if (error) return <p className="text-danger">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">POS / Sales</h1>
      <p className="mb-4 text-sm text-ink-muted">
        Fast order entry — tablet friendly
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {orderTypes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setOrderType(t)}
            className={clsx(
              "min-h-11 rounded-full border px-3.5 text-sm font-semibold",
              orderType === t
                ? "border-navy bg-navy text-white"
                : "border-border bg-surface text-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => add(item.id)}
                className="relative min-h-[110px] rounded-[10px] border border-border bg-surface p-3 text-left hover:border-primary hover:shadow-card"
              >
                {cart[item.id] ? (
                  <span className="absolute right-2 top-2 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-primary text-[0.7rem] font-bold text-white">
                    {cart[item.id]}
                  </span>
                ) : null}
                <div className="text-[0.85rem] font-semibold">{item.name}</div>
                <div className="mt-2 text-sm font-bold text-primary">
                  {money(item.price)}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3 className="mb-3 text-[0.95rem] font-semibold">Cart</h3>
          {lines.length === 0 ? (
            <p className="text-sm text-ink-muted">Tap items to add</p>
          ) : (
            lines.map((l) => (
              <div
                key={l.item.id}
                className="flex justify-between border-b border-border py-1.5 text-sm"
              >
                <span>
                  {l.item.name} × {l.quantity}
                </span>
                <strong className="tabular-nums">{money(l.line)}</strong>
              </div>
            ))
          )}
          <div className="mt-3 text-lg font-bold tabular-nums">
            TOTAL {money(total)}
          </div>
          <label className="mt-3 flex flex-col gap-1 text-[0.72rem] font-semibold text-ink-muted">
            Table / ref
            <input
              className="min-h-11 rounded-lg border border-border px-3 text-sm"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Table 6 or GLV-…"
            />
          </label>
          <Button variant="success" className="mt-3 w-full" onClick={complete}>
            Complete order + receipt
          </Button>
          {result ? (
            <p className="mt-3 text-sm">
              <Badge tone={result.includes("PAID") || result.includes("ticket") ? "ok" : "err"}>
                {result}
              </Badge>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
