"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import clsx from "clsx";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  isActive?: boolean;
  category?: string;
  code?: string | null;
}
interface Meta {
  orderTypes: Array<{
    name: string;
    isDelivery?: boolean;
    requiresReference?: boolean;
    isActive?: boolean;
  }>;
  paymentMethods?: Array<{ name: string } | string>;
  vat?: {
    enabled?: boolean;
    ratePercent?: number;
    pricesIncludeVat?: boolean;
  };
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
  const [orderTypeMeta, setOrderTypeMeta] = useState<Meta["orderTypes"]>([]);
  const [orderType, setOrderType] = useState("Dine In");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tableNo, setTableNo] = useState("");
  const [platformCode, setPlatformCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("M-Pesa");
  const [mpesaCode, setMpesaCode] = useState("");
  const [cashTendered, setCashTendered] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [result, setResult] = useState("");
  const [resultOk, setResultOk] = useState(false);
  const [lastOrderId, setLastOrderId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [vatRate, setVatRate] = useState(0.16);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatInclusive, setVatInclusive] = useState(true);

  useEffect(() => {
    Promise.all([
      api<{ items: MenuItem[] }>("/menu"),
      api<Meta>("/meta").catch(() => ({ orderTypes: [] as Meta["orderTypes"] })),
      api<Record<string, string>>("/settings").catch(() => ({} as Record<string, string>)),
    ])
      .then(([menu, meta, s]) => {
        const activeItems = (menu.items ?? []).filter((i) => i.isActive !== false);
        setItems(activeItems);
        setSettings(s);
        const modulesOn = s.module_dine_pickup_delivery !== "0";
        let ot = (meta.orderTypes ?? []).filter((t) => t.isActive !== false);
        if (!modulesOn) {
          // Module off: only keep classic in-house tabs if present
          ot = ot.filter((t) =>
            ["Dine In", "Pick Up", "Dine-In"].includes(t.name),
          );
        }
        setOrderTypeMeta(ot);
        const types = ot.map((t) => t.name).filter(Boolean);
        if (types.length) {
          setOrderTypes(types);
          setOrderType(types[0]);
        } else if (modulesOn) {
          setOrderTypes(FALLBACK_ORDER_TYPES);
          setOrderType(FALLBACK_ORDER_TYPES[0]);
        }
        const rate =
          meta.vat?.ratePercent ??
          (s.vat_rate ? Number(s.vat_rate) : 16);
        setVatRate(Number.isFinite(rate) ? rate / 100 : 0.16);
        setVatEnabled(
          meta.vat?.enabled !== false && s.vat_enabled !== "0",
        );
        setVatInclusive(
          meta.vat?.pricesIncludeVat !== false && s.vat_inclusive !== "0",
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const moduleOn = (key: string, defaultOn = true) => {
    const v = settings[key];
    if (v === undefined || v === "") return defaultOn;
    return v !== "0";
  };

  const showTableField =
    moduleOn("module_table_number", true) && orderType === "Dine In";
  const showPrint =
    moduleOn("module_print_receipt", true);

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
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !(item.code ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
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
  const netOfVat = vatEnabled && vatInclusive ? subtotal / (1 + vatRate) : subtotal;
  const vatAmount = vatEnabled
    ? vatInclusive
      ? subtotal - netOfVat
      : subtotal * vatRate
    : 0;
  const grandTotal = vatEnabled && !vatInclusive ? subtotal + vatAmount : subtotal;

  const currentMeta = orderTypeMeta.find((t) => t.name === orderType);
  const isDelivery =
    currentMeta?.isDelivery === true ||
    (!currentMeta && !["Dine In", "Pick Up"].includes(orderType));
  const needsPlatformCode =
    isDelivery || currentMeta?.requiresReference === true;

  const cashChange =
    paymentMethod === "Cash" && cashTendered
      ? Math.max(0, Number(cashTendered) - grandTotal)
      : null;

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

  function newOrder() {
    setCart({});
    setTableNo("");
    setPlatformCode("");
    setMpesaCode("");
    setCashTendered("");
    setResult("");
    setResultOk(false);
    setLastOrderId("");
  }

  async function complete() {
    setResult("");
    setResultOk(false);
    setSubmitting(true);
    try {
      if (!lines.length) throw new Error("Cart is empty");
      if (needsPlatformCode && !platformCode.trim()) {
        throw new Error("Platform order code is required for delivery orders");
      }
      if (
        !isDelivery &&
        paymentMethod === "M-Pesa" &&
        !mpesaCode.trim()
      ) {
        // soft requirement — still allow with placeholder in payload
      }
      const data = await api<{
        order: {
          id?: string;
          orderNo: string;
          paymentStatus: string;
          grandTotal?: number;
          totalAmount?: number;
        };
        ticket?: { ticketNo: string };
      }>("/pos/orders", {
        method: "POST",
        headers: {
          "Idempotency-Key": `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({
          orderType,
          idempotencyKey: `next-${Date.now()}`,
          tableNo: orderType === "Dine In" ? tableNo || undefined : undefined,
          deliveryRef: needsPlatformCode ? platformCode || undefined : undefined,
          lines: lines.map((l) => ({
            menuItemId: l.item.id,
            quantity: l.quantity,
          })),
          discountAmount: discountAmount ? Number(discountAmount) : undefined,
          payments: [
            isDelivery
              ? {
                  method: `Platform - ${orderType} (unsettled)`,
                  amount: Math.max(0, grandTotal - (Number(discountAmount) || 0)),
                  reference: platformCode || undefined,
                }
              : {
                  method: paymentMethod,
                  amount: Math.max(0, grandTotal - (Number(discountAmount) || 0)),
                  reference:
                    paymentMethod === "M-Pesa"
                      ? mpesaCode || undefined
                      : paymentMethod === "Cash" && cashTendered
                        ? `Tendered ${cashTendered}`
                        : undefined,
                },
          ],
        }),
      });
      setCart({});
      setPlatformCode("");
      setMpesaCode("");
      setCashTendered("");
      const oid =
        (data as { order: { id?: string; orderNo: string } }).order.id ||
        data.order.orderNo;
      setLastOrderId(oid);
      setResultOk(true);
      setResult(
        `Order ${data.order.orderNo} · ${money(
          data.order.grandTotal ?? data.order.totalAmount ?? grandTotal,
        )} · ${data.order.paymentStatus}${
          data.ticket ? ` · Ticket ${data.ticket.ticketNo}` : ""
        }`,
      );
    } catch (e) {
      setResultOk(false);
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
      <div className="flex flex-wrap items-center gap-2">
        {orderTypes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setOrderType(t);
              setPlatformCode("");
            }}
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
                  {!item.isAvailable ? (
                    <span className="absolute left-2 top-2 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      Sold out
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

        <aside className="panel flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[0.95rem] font-semibold">Current order</h3>
            <Badge tone="orange">{orderType}</Badge>
          </div>

          {showTableField ? (
            <div className="mb-3">
              <label className="field-label">Table number</label>
              <input
                className="field-input"
                value={tableNo}
                onChange={(e) => setTableNo(e.target.value)}
                placeholder="Table 6"
              />
            </div>
          ) : null}

          {needsPlatformCode ? (
            <div className="mb-3">
              <label className="field-label">
                Platform order code <span className="text-danger">*</span>
              </label>
              <input
                className="field-input"
                value={platformCode}
                onChange={(e) => setPlatformCode(e.target.value)}
                placeholder="e.g. GL-48291"
                required
              />
            </div>
          ) : null}

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
                    <div className="truncate text-sm font-medium">{item.name}</div>
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
              <span>
                Subtotal{vatEnabled && vatInclusive ? " (VAT inclusive)" : ""}
              </span>
              <span className="tabular-nums">{money(subtotal)}</span>
            </div>
            {vatEnabled ? (
              <>
                <div className="flex justify-between text-ink-muted">
                  <span>Net of VAT</span>
                  <span className="tabular-nums">{money(netOfVat)}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>
                    VAT {(vatRate * 100).toFixed(0)}%
                    {vatInclusive ? " included" : ""}
                  </span>
                  <span className="tabular-nums">{money(vatAmount)}</span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between pt-1 text-base font-bold">
              <span>TOTAL</span>
              <span className="tabular-nums text-primary">
                {money(grandTotal)}
              </span>
            </div>
          </div>

          {moduleOn("module_discounts", false) && !isDelivery ? (
            <div className="mt-3">
              <label className="field-label">Discount (KSh)</label>
              <input
                className="field-input"
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          ) : null}

          <div className="mt-3">
            {isDelivery || needsPlatformCode ? (

              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Delivery platform order — customer pays the platform. Payment
                recorded as <strong>Platform - {orderType} (unsettled)</strong>.
              </div>
            ) : (
              <>
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
                {paymentMethod === "Cash" ? (
                  <div className="mt-2 space-y-1">
                    <input
                      className="field-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Cash tendered"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                    />
                    {cashChange !== null && Number.isFinite(cashChange) ? (
                      <p className="text-xs text-ink-muted">
                        Change: <strong>{money(cashChange)}</strong>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {resultOk && lastOrderId && showPrint ? (
            <Link
              className="mt-2 block text-center text-sm font-semibold text-primary underline"
              href={`/receipts/${lastOrderId}`}
            >
              View / print receipt
            </Link>
          ) : null}

          <Button
            className="mt-4 w-full"
            variant="success"
            disabled={submitting || lines.length === 0}
            onClick={complete}
          >
            {submitting ? "Processing…" : "Complete order + receipt"}
          </Button>

          {resultOk ? (
            <Button
              className="mt-2 w-full"
              variant="secondary"
              onClick={newOrder}
            >
              New order
            </Button>
          ) : null}

          {result ? (
            <p
              className={`mt-2 text-center text-sm ${
                resultOk ? "text-success" : "text-danger"
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
