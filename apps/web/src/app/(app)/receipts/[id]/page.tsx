"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, money } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface Order {
  id: string;
  orderNo: string;
  orderType: string;
  tableNo?: string;
  platformReference?: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  createdAt: string;
  status: string;
  cashierName?: string;
  lines: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payments: Array<{ method: string; amount: number; reference?: string }>;
}

export default function ReceiptPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api<Order>(`/orders/${id}`),
      api<Record<string, string>>("/settings").catch(() => ({})),
    ])
      .then(([o, s]) => {
        setOrder(o);
        setSettings(s);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-danger">{error}</p>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="p-6">
        <p className="text-ink-muted">Loading receipt…</p>
      </div>
    );
  }

  const isDelivery = (order.payments || []).some((p) =>
    String(p.method).startsWith("Platform"),
  );
  const vatEnabled = settings.vat_enabled !== "0";
  const netOfVat = order.totalAmount - (order.vatAmount || 0);
  const accountFormat = settings.paybill_account_format || "ORDER";
  const accountNo =
    accountFormat === "TABLE" && order.tableNo
      ? order.tableNo
      : order.orderNo;

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 print:p-0">
      <div className="flex gap-2 print:hidden">
        <Button
          onClick={() => {
            setDuplicate(true);
            setTimeout(() => window.print(), 50);
          }}
        >
          Print receipt
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setDuplicate(false);
            setTimeout(() => window.print(), 50);
          }}
        >
          Print original
        </Button>
        <Button variant="secondary" onClick={() => window.history.back()}>
          Back
        </Button>
      </div>

      <article
        className={`rounded-lg border border-border bg-white p-4 text-sm shadow-sm print:border-0 print:shadow-none ${
          settings.receipt_paper_width === "58" ? "max-w-[220px]" : ""
        }`}
      >
        {duplicate ? (
          <div className="mb-2 text-center text-xs font-bold tracking-widest">
            *** DUPLICATE ***
          </div>
        ) : null}
        <header className="mb-3 text-center">
          <div className="text-base font-bold">
            {settings.receipt_business_name || "Inari Kicchin"}
          </div>
          {settings.receipt_address ? (
            <div className="text-xs text-ink-muted">{settings.receipt_address}</div>
          ) : null}
          {settings.receipt_phone ? (
            <div className="text-xs text-ink-muted">{settings.receipt_phone}</div>
          ) : null}
          {settings.receipt_kra_pin ? (
            <div className="text-xs">KRA PIN: {settings.receipt_kra_pin}</div>
          ) : null}
          {settings.receipt_vat_number ? (
            <div className="text-xs">VAT: {settings.receipt_vat_number}</div>
          ) : null}
        </header>

        <div className="mb-2 space-y-0.5 border-b border-dashed border-border pb-2 text-xs">
          <div className="flex justify-between">
            <span>Receipt</span>
            <span className="font-semibold">{order.orderNo}</span>
          </div>
          <div className="flex justify-between">
            <span>Date</span>
            <span>
              {order.createdAt
                ? new Date(order.createdAt).toLocaleString("en-KE", {
                    timeZone: "Africa/Nairobi",
                  })
                : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Type</span>
            <span>{order.orderType}</span>
          </div>
          {order.tableNo ? (
            <div className="flex justify-between">
              <span>Table</span>
              <span>{order.tableNo}</span>
            </div>
          ) : null}
          {order.platformReference ? (
            <div className="flex justify-between">
              <span>Platform code</span>
              <span>{order.platformReference}</span>
            </div>
          ) : null}
          {order.cashierName ? (
            <div className="flex justify-between">
              <span>Cashier</span>
              <span>{order.cashierName}</span>
            </div>
          ) : null}
        </div>

        <table className="mb-2 w-full text-xs">
          <thead>
            <tr className="border-b border-dashed border-border">
              <th className="py-1 text-left">Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.lines || []).map((l, i) => (
              <tr key={i}>
                <td className="py-0.5">
                  {l.name}
                  <div className="text-[10px] text-ink-muted">
                    {money(l.unitPrice)}
                  </div>
                </td>
                <td className="text-right align-top">{l.quantity}</td>
                <td className="text-right align-top">{money(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-0.5 border-t border-dashed border-border pt-2 text-xs">
          <div className="flex justify-between">
            <span>
              Subtotal{vatEnabled ? " (VAT incl)" : ""}
            </span>
            <span>{money(order.subtotal || order.totalAmount)}</span>
          </div>
          {vatEnabled ? (
            <>
              <div className="flex justify-between">
                <span>Net of VAT</span>
                <span>{money(netOfVat)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT</span>
                <span>{money(order.vatAmount)}</span>
              </div>
            </>
          ) : null}
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span>{money(order.totalAmount)}</span>
          </div>
        </div>

        <div className="mt-2 space-y-0.5 text-xs">
          {(order.payments || []).map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>Paid: {p.method}</span>
              <span>
                {money(p.amount)}
                {p.reference ? ` · ${p.reference}` : ""}
              </span>
            </div>
          ))}
        </div>

        {!isDelivery && settings.print_payment_box !== "0" ? (
          <div className="mt-3 border border-dashed border-border p-2 text-xs">
            <div className="font-semibold">PAY VIA M-PESA PAYBILL</div>
            {settings.paybill_business_number ? (
              <div>Business No: {settings.paybill_business_number}</div>
            ) : (
              <div className="text-ink-muted">Configure paybill in Settings</div>
            )}
            <div>Account No: {accountNo}</div>
            {settings.paybill_till_number ? (
              <div>Till: {settings.paybill_till_number}</div>
            ) : null}
            {settings.payment_instruction ? (
              <div className="mt-1">{settings.payment_instruction}</div>
            ) : null}
          </div>
        ) : null}

        {settings.receipt_note ? (
          <p className="mt-3 text-center text-xs text-ink-muted">
            {settings.receipt_note}
          </p>
        ) : null}
      </article>
    </div>
  );
}
