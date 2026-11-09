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
  category?: string;
}
interface Meta {
  orderTypes: Array<{ name: string }>;
  paymentMethods?: Array<{ name: string }>;
}

const FALLBACK_ORDER_TYPES = [
  "Dine In",
  "Pick Up",
  "Glovo",
  "Bolt Food",
  "Uber Eats",
  "SpeedyDrop",
  "NAI Deliver",
  "Yum Deliveries",
];

export default function PosPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orderTypes, setOrderTypes] = useState<string[]>(FALLBACK_ORDER_TYPES);
  const [orderType, setOrderType] = useState("Dine In");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [ref, setRef] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("M-Pesa");
  const [mpesaCode, setMpesaCode] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ items: MenuItem[] }>("/menu"),
      api<Meta>("/meta").catch(() => ({ orderTypes: [] as Array<{ name: string }> })),
    ])
      .then(([menu, meta]) => {
        setItems(menu.items ?? []);
        const types =
          meta.orderTypes?.map((t) => t.name).filter(Boolean) ?? [];
        if (types.length) {
          setOrderTypes(types);
          setOrderType(types[0]);
        }
      })
      .catch((e) => setError(e.message));
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
  const subtotal = lines.reduce((s, l) => s + l.line, 0);
  // VAT inclusive assumption matching existing domain
  const vatRate = 0.16;
  const netOfVat = subtotal / (1 + vatRate);
  const vatAmount = subtotal - netOfVat;

  function add(id: string) {
    const item = items.find((m) => m.id === id);
    if (!item?.isAvailable) return;
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  }

  function dec(id: string) {
    setCart((c) => {
      const next = { ...c };
      if ((next[id] || 0) <= 1) delete next[id];
      else next[id] -= 1;
      return next;
    });
  }

  function inc(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  }

  async function complete() {
    setResult("");
    setSubmitting(true);
    try {
      if (!lines.length) throw new Error("Cart is empty");
      const data = await api<{
        order: { orderNo: string; paymentStatus: string; grandTotal: number };
        ticket?: { ticketNo: string };
      }>("/pos/orders", {
        method: "POST",
        headers: {
          "Idempotency-Key": `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({
          orderType,
          idempotencyKey: `next-${Date.now()}`,
          tableNo: orderType === "Dine In" ? ref || undefined : undefined,
          deliveryRef: !["Dine In", "Pick Up"].includes(orderType)
            ? ref || undefined
            : undefined,
          lines: lines.map((l) => ({
            menuItemId: l.item.id,
            quantity: l.quantity,
          })),
          payments: [
            {
              method: paymentMethod,
              amount: subtotal,
              reference:
                paymentMethod === "M-Pesa"
                  ? mpesaCode || "POS-MPESA"
                  : undefined,
            },
          ],
        }),
      });
      setCart({});
      setRef("");
      setMpesaCode("");
      setResult(
        `Order ${data.order.orderNo} · ${money(data.order.grandTotal)} · ${
          data.order.paymentStatus
        }${data.ticket ? ` · Ticket ${data.ticket.ticketNo}` : ""}`,
      );
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <div>
        <h1 className="page-title">POS / Sales</h1>
        <p className="mt-2 text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-3">
      {/* Order type chips — Blueprint §14.8 */}
      <div className="flex flex-wrap items-center gap-2">
        {orderTypes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setOrderType(t)}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              orderType === t
                ? "bg-navy text-white"
                : "bg-slate-100 text-ink-muted hover:bg-slate-200",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_340px]">
        {/* Product browsing */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              className="field-input max-w-xs flex-1"
              placeholder="Search menu items or scan code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={clsx(
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    category === c
                      ? "bg-primary text-white"
                      : "bg-white text-ink-muted border border-border hover:bg-bg",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => {
              const qty = cart[item.id] || 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.isAvailable}
                  onClick={() => add(item.id)}
                  className={clsx(
                    "relative flex min-h-[110px] flex-col items-start justify-between rounded-[10px] border p-3 text-left transition",
                    item.isAvailable
                      ? "border-border bg-surface hover:border-primary hover:shadow-card"
                      : "cursor-not-allowed border-border bg-slate-50 opacity-50",
                  )}
                >
                  {qty > 0 ? (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-white">
                      {qty}
                    </span>
                  ) : null}
                  <span className="pr-6 text-sm font-semibold leading-snug">
                    {item.name}
                  </span>
                  <span className="mt-2 text-sm font-bold text-primary">
                    {money(item.price)}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <p className="col-span-full py-8 text-center text-ink-muted">
                No menu items match the current filter.
              </p>
            ) : null}
          </div>
        </div>

        {/* Cart panel */}
        <aside className="panel flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[0.95rem] font-semibold">Current order</h3>
            <Badge tone="orange">{orderType}</Badge>
          </div>

          {(orderType === "Dine In" ||
            !["Dine In", "Pick Up"].includes(orderType)) && (
            <div className="mb-3">
              <label className="field-label">
                {orderType === "Dine In" ? "Table" : "Delivery reference"}
              </label>
              <input
                className="field-input"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder={
                  orderType === "Dine In" ? "Table 6" : "Platform order code"
                }
              />
            </div>
          )}

          <div className="flex-1 space-y-2 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">
                Tap items to add them to the order
              </p>
            ) : (
              lines.map(({ item, quantity, line }) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 border-b border-border pb-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {item.name}
                    </div>
                    <div className="text-xs text-ink-muted">
                      {money(item.price)} each
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-md border border-border text-sm font-bold"
                      onClick={() => dec(item.id)}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-md border border-border text-sm font-bold"
                      onClick={() => inc(item.id)}
                    >
                      +
                    </button>
                  </div>
                  <div className="w-20 text-right text-sm font-semibold tabular-nums">
                    {money(line)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-ink-muted">
              <span>Subtotal (VAT inclusive)</span>
              <span className="tabular-nums">{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>Net of VAT</span>
              <span className="tabular-nums">{money(netOfVat)}</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>VAT 16% included</span>
              <span className="tabular-nums">{money(vatAmount)}</span>
            </div>
            <div className="flex justify-between pt-1 text-base font-bold">
              <span>TOTAL</span>
              <span className="tabular-nums text-primary">
                {money(subtotal)}
              </span>
            </div>
          </div>

          <div className="mt-3">
            <div className="label-caps mb-2">Payment method</div>
            <div className="flex flex-wrap gap-1.5">
              {["Cash", "M-Pesa", "Card", "Bank"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    paymentMethod === m
                      ? "bg-navy text-white"
                      : "border border-border bg-white text-ink-muted",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            {paymentMethod === "M-Pesa" ? (
              <input
                className="field-input mt-2"
                placeholder="M-Pesa code e.g. SJK4H2L9QX"
                value={mpesaCode}
                onChange={(e) => setMpesaCode(e.target.value)}
              />
            ) : null}
          </div>

          <Button
            className="mt-4 w-full"
            variant="success"
            disabled={submitting || lines.length === 0}
            onClick={complete}
          >
            {submitting ? "Processing…" : "Complete order + receipt"}
          </Button>
          {result ? (
            <p
              className={`mt-2 text-center text-sm ${
                result.includes("failed") || result.includes("empty")
                  ? "text-danger"
                  : "text-success"
              }`}
            >
              {result}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
