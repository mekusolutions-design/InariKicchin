"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getStoredUser } from "@/lib/auth";

type Tab = "modules" | "vat" | "receipt" | "payment" | "users" | "orders";

const MODULE_KEYS: Array<{ key: string; label: string; effect: string }> = [
  {
    key: "module_dine_pickup_delivery",
    label: "Dine In / Pick Up / Delivery tabs",
    effect: "Controls which order types appear on POS",
  },
  {
    key: "module_table_number",
    label: "Table number",
    effect: "Show table field on Dine In orders",
  },
  {
    key: "module_kitchen_tickets",
    label: "Kitchen tickets",
    effect: "Create kitchen tickets on complete",
  },
  {
    key: "module_print_receipt",
    label: "Print receipt",
    effect: "Show print actions after order",
  },
  {
    key: "module_discounts",
    label: "Discounts",
    effect: "Allow discount entry on POS",
  },
  {
    key: "module_makeline_deductions",
    label: "Makeline recipe deductions",
    effect: "Deduct purchased stock on production (when recipes exist)",
  },
  {
    key: "module_low_stock_alerts",
    label: "Low-stock alerts",
    effect: "Show low-stock on dashboard",
  },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("modules");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<{
    vat?: { ratePercent: number; pricesIncludeVat: boolean; enabled?: boolean };
    users?: Array<{ fullName: string; email: string; role: string }>;
    orderTypes?: Array<{ name: string }>;
    paymentMethods?: string[];
  } | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const role = getStoredUser()?.role;

  const canWrite =
    role === "ADMINISTRATOR" || role === "MANAGER";
  const canUsers = role === "ADMINISTRATOR";

  async function load() {
    try {
      const [s, m] = await Promise.all([
        api<Record<string, string>>("/settings").catch(() => ({})),
        api<typeof meta>("/meta").catch(() => null),
      ]);
      setSettings(s);
      setMeta(m);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function setKey(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings() {
    if (!canWrite) {
      setError("You do not have permission to update settings");
      return;
    }
    setSaving(true);
    setMsg("");
    setError("");
    try {
      const next = await api<Record<string, string>>("/settings", {
        method: "PUT",
        body: JSON.stringify({ settings }),
      });
      setSettings(next);
      setMsg("Settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "modules", label: "Modules" },
    { id: "vat", label: "VAT" },
    { id: "receipt", label: "Receipt" },
    { id: "payment", label: "Payment details" },
    { id: "users", label: "Users" },
    { id: "orders", label: "Order types" },
  ];

  if (role === "CASHIER" || role === "KITCHEN_STAFF") {
    return (
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-2 text-danger">
          Cashiers and kitchen staff cannot access Settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">
          POS modules, VAT, receipt & payment configuration · audited changes
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {msg ? <p className="text-sm text-success">{msg}</p> : null}

      <div className="flex flex-wrap gap-1 border-b border-border pb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.id
                ? "border border-b-0 border-border bg-surface text-primary"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "modules" && (
        <div className="panel space-y-3 max-w-2xl">
          <h3 className="text-[0.95rem] font-semibold">POS module switches</h3>
          {MODULE_KEYS.map((m) => (
            <label
              key={m.key}
              className="flex items-start gap-3 rounded-lg border border-border p-3"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={settings[m.key] !== "0"}
                disabled={!canWrite}
                onChange={(e) => setKey(m.key, e.target.checked ? "1" : "0")}
              />
              <span>
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="text-xs text-ink-muted">{m.effect}</span>
              </span>
            </label>
          ))}
          {canWrite ? (
            <Button onClick={saveSettings} disabled={saving} className="min-h-11">
              {saving ? "Saving…" : "Save modules"}
            </Button>
          ) : null}
        </div>
      )}

      {tab === "vat" && (
        <div className="panel max-w-lg space-y-3">
          <h3 className="text-[0.95rem] font-semibold">VAT</h3>
          <p className="text-sm text-ink-muted">
            Current rate from database:{" "}
            <strong>{meta?.vat?.ratePercent ?? 16}%</strong>
            {meta?.vat?.pricesIncludeVat ? " · prices include VAT" : ""}
          </p>
          <p className="text-xs text-ink-muted">
            Changing VAT rate uses an effective-from history row so past orders
            are not rewritten. Use the API{" "}
            <code>PUT /settings/vat</code> when that route is deployed, or
            update VatSetting via admin process.
          </p>
        </div>
      )}

      {tab === "receipt" && (
        <div className="panel max-w-lg space-y-3">
          <h3 className="text-[0.95rem] font-semibold">Receipt header</h3>
          {(
            [
              ["receipt_business_name", "Business name"],
              ["receipt_address", "Address"],
              ["receipt_phone", "Phone"],
              ["receipt_kra_pin", "KRA PIN"],
              ["receipt_vat_number", "VAT number"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="field-label">{label}</label>
              <input
                className="field-input"
                value={settings[key] ?? ""}
                disabled={!canWrite}
                onChange={(e) => setKey(key, e.target.value)}
              />
            </div>
          ))}
          <div>
            <label className="field-label">Receipt note (max 200)</label>
            <textarea
              className="field-input min-h-[72px]"
              maxLength={200}
              value={settings.receipt_note ?? ""}
              disabled={!canWrite}
              onChange={(e) => setKey("receipt_note", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Paper width</label>
            <select
              className="field-input"
              value={settings.receipt_paper_width ?? "80"}
              disabled={!canWrite}
              onChange={(e) => setKey("receipt_paper_width", e.target.value)}
            >
              <option value="80">80 mm</option>
              <option value="58">58 mm</option>
            </select>
          </div>
          {canWrite ? (
            <Button onClick={saveSettings} disabled={saving} className="min-h-11">
              {saving ? "Saving…" : "Save receipt settings"}
            </Button>
          ) : null}
        </div>
      )}

      {tab === "payment" && (
        <div className="panel max-w-lg space-y-3">
          <h3 className="text-[0.95rem] font-semibold">
            Payment box (in-house receipts)
          </h3>
          {(
            [
              ["paybill_business_number", "Paybill business number"],
              ["paybill_till_number", "Till number"],
              ["bank_name", "Bank name"],
              ["bank_account", "Bank account"],
              ["payment_instruction", "Custom payment instruction"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="field-label">{label}</label>
              <input
                className="field-input"
                value={settings[key] ?? ""}
                disabled={!canWrite}
                onChange={(e) => setKey(key, e.target.value)}
              />
            </div>
          ))}
          <div>
            <label className="field-label">Account format</label>
            <select
              className="field-input"
              value={settings.paybill_account_format ?? "ORDER"}
              disabled={!canWrite}
              onChange={(e) =>
                setKey("paybill_account_format", e.target.value)
              }
            >
              <option value="ORDER">Order number</option>
              <option value="TABLE">Table number</option>
              <option value="FIXED">Fixed text</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.print_payment_box !== "0"}
              disabled={!canWrite}
              onChange={(e) =>
                setKey("print_payment_box", e.target.checked ? "1" : "0")
              }
            />
            Print payment box on in-house receipts
          </label>
          {canWrite ? (
            <Button onClick={saveSettings} disabled={saving} className="min-h-11">
              {saving ? "Saving…" : "Save payment details"}
            </Button>
          ) : null}
        </div>
      )}

      {tab === "users" && (
        <div className="panel overflow-x-auto">
          <h3 className="mb-3 text-[0.95rem] font-semibold">Users</h3>
          {!canUsers ? (
            <p className="text-sm text-ink-muted">
              Only administrators manage users.
            </p>
          ) : null}
          <table className="table-base min-w-[400px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {(meta?.users ?? []).map((u) => (
                <tr key={u.email}>
                  <td className="font-medium">{u.fullName}</td>
                  <td className="text-ink-muted">{u.email}</td>
                  <td>
                    <Badge tone="info">{u.role}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "orders" && (
        <div className="panel max-w-lg">
          <h3 className="mb-3 text-[0.95rem] font-semibold">Order types</h3>
          <ul className="space-y-2">
            {(meta?.orderTypes ?? []).map((t) => (
              <li
                key={t.name}
                className="flex justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{t.name}</span>
                <Badge tone="ok">Active</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Add/edit order types via database seed or future order-type manager
            API. Kind (in-house vs delivery) drives POS payment behaviour.
          </p>
        </div>
      )}
    </div>
  );
}
