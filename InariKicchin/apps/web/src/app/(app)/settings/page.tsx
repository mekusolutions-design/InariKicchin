"use client";

import { useEffect, useState , type FormEvent } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getStoredUser } from "@/lib/auth";

type Tab = "modules" | "vat" | "receipt" | "payment" | "users" | "orders" | "security";

const MODULE_KEYS: Array<{ key: string; label: string; effect: string }> = [
  { key: "module_dine_pickup_delivery", label: "Dine In / Pick Up / Delivery tabs", effect: "Order type visibility on POS" },
  { key: "module_table_number", label: "Table number", effect: "Show table field on Dine In" },
  { key: "module_kitchen_tickets", label: "Kitchen tickets", effect: "Create tickets on complete" },
  { key: "module_print_receipt", label: "Print receipt", effect: "Show print / receipt link" },
  { key: "module_discounts", label: "Discounts", effect: "Allow discount entry on POS" },
  { key: "module_makeline_deductions", label: "Makeline recipe deductions", effect: "When recipes exist" },
  { key: "module_low_stock_alerts", label: "Low-stock alerts", effect: "Dashboard low-stock" },
];

interface OrderTypeRow {
  id: string;
  name: string;
  isDelivery: boolean;
  requiresReference: boolean;
  isActive: boolean;
  sortOrder?: number;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("modules");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<{
    vat?: { ratePercent: number; pricesIncludeVat: boolean };
    users?: Array<{ id?: string; fullName: string; email: string; role: string; isActive?: boolean }>;
  } | null>(null);
  const [orderTypes, setOrderTypes] = useState<OrderTypeRow[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string | undefined>(undefined);
  const canWrite = role === "ADMINISTRATOR" || role === "MANAGER";
  const canUsers = role === "ADMINISTRATOR";

  const [otName, setOtName] = useState("");
  const [otDelivery, setOtDelivery] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState("CASHIER");
  const [managerPin, setManagerPin] = useState("");
  const [managerPin2, setManagerPin2] = useState("");

  async function load() {
    try {
      const [s, m, ot] = await Promise.all([
        api<Record<string, string>>("/settings").catch(() => ({} as Record<string, string>)),
        api<typeof meta>("/meta").catch(() => null),
        api<OrderTypeRow[]>("/order-types").catch(() => [] as OrderTypeRow[]),
      ]);
      setSettings(s);
      setMeta(m);
      setOrderTypes(ot);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    setRole(getStoredUser()?.role);
  }, []);

  useEffect(() => {
    void load();
  }, []);

  function setKey(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings() {
    if (!canWrite) return;
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

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({ fullName, email, password, role: newRole }),
      });
      setMsg("User created");
      setFullName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function saveOrderType(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/order-types", {
        method: "POST",
        body: JSON.stringify({
          name: otName,
          isDelivery: otDelivery,
          requiresReference: otDelivery,
          isActive: true,
        }),
      });
      setMsg("Order type saved");
      setOtName("");
      setOtDelivery(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order type failed");
    }
  }

  async function toggleOrderType(ot: OrderTypeRow) {
    try {
      await api(`/order-types/${ot.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: ot.name,
          isDelivery: ot.isDelivery,
          requiresReference: ot.requiresReference,
          isActive: !ot.isActive,
          sortOrder: ot.sortOrder ?? 0,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function saveManagerPin(e: FormEvent) {
    e.preventDefault();
    if (managerPin !== managerPin2) {
      setError("PIN confirmation does not match");
      return;
    }
    setError("");
    try {
      await api("/settings/manager-pin", {
        method: "PUT",
        body: JSON.stringify({ pin: managerPin }),
      });
      setMsg("Manager authorization PIN set");
      setManagerPin("");
      setManagerPin2("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PIN save failed");
    }
  }

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

  const tabs: { id: Tab; label: string }[] = [
    { id: "modules", label: "Modules" },
    { id: "vat", label: "VAT" },
    { id: "receipt", label: "Receipt" },
    { id: "payment", label: "Payment" },
    { id: "users", label: "Users" },
    { id: "orders", label: "Order types" },
    { id: "security", label: "Security" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">
          Modules, VAT, receipt, payment, users, order types · audited
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
            className={`rounded-t-lg px-3 py-2.5 text-sm font-semibold ${
              tab === t.id
                ? "border border-b-0 border-border bg-surface text-primary"
                : "text-ink-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "modules" && (
        <div className="panel max-w-2xl space-y-3">
          {MODULE_KEYS.map((m) => (
            <label key={m.key} className="flex items-start gap-3 rounded-lg border border-border p-3">
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
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving…" : "Save modules"}
            </Button>
          ) : null}
        </div>
      )}

      {tab === "vat" && (
        <div className="panel max-w-lg space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.vat_enabled !== "0"}
              disabled={!canWrite}
              onChange={(e) => setKey("vat_enabled", e.target.checked ? "1" : "0")}
            />
            VAT enabled on POS and receipts
          </label>
          <div>
            <label className="field-label">VAT rate (%)</label>
            <input
              className="field-input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={settings.vat_rate ?? String(meta?.vat?.ratePercent ?? 16)}
              disabled={!canWrite}
              onChange={(e) => setKey("vat_rate", e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.vat_inclusive !== "0"}
              disabled={!canWrite}
              onChange={(e) => setKey("vat_inclusive", e.target.checked ? "1" : "0")}
            />
            Prices include VAT (inclusive mode)
          </label>
          <p className="text-xs text-ink-muted">
            Historical orders keep the VAT values stored at sale time. New orders use these settings.
            Current meta rate: {meta?.vat?.ratePercent ?? 16}%
            {meta?.vat?.pricesIncludeVat ? " inclusive" : ""}.
          </p>
          {canWrite ? (
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving…" : "Save VAT settings"}
            </Button>
          ) : null}
        </div>
      )}

      {tab === "receipt" && (
        <div className="panel max-w-lg space-y-3">
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
            <Button onClick={saveSettings} disabled={saving}>
              Save receipt settings
            </Button>
          ) : null}
        </div>
      )}

      {tab === "payment" && (
        <div className="panel max-w-lg space-y-3">
          {(
            [
              ["paybill_business_number", "Paybill business number"],
              ["paybill_till_number", "Till number"],
              ["bank_name", "Bank name"],
              ["bank_account", "Bank account"],
              ["payment_instruction", "Payment instruction"],
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
            <Button onClick={saveSettings} disabled={saving}>
              Save payment details
            </Button>
          ) : null}
        </div>
      )}

      {tab === "users" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="panel overflow-x-auto">
            <h3 className="mb-3 text-[0.95rem] font-semibold">Users</h3>
            <table className="table-base min-w-[360px]">
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
                    <td className="text-ink-muted text-sm">{u.email}</td>
                    <td>
                      <Badge tone="info">{u.role}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canUsers ? (
            <form onSubmit={createUser} className="panel space-y-3">
              <h3 className="text-[0.95rem] font-semibold">Create user</h3>
              <input
                className="field-input"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <input
                className="field-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                className="field-input"
                type="password"
                placeholder="Password (min 8)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <select
                className="field-input"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="CASHIER">CASHIER</option>
                <option value="MANAGER">MANAGER</option>
                <option value="KITCHEN_STAFF">KITCHEN_STAFF</option>
                <option value="ADMINISTRATOR">ADMINISTRATOR</option>
              </select>
              <Button type="submit">Create user</Button>
            </form>
          ) : (
            <p className="text-sm text-ink-muted">Only administrators create users.</p>
          )}
        </div>
      )}

      {tab === "orders" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="panel">
            <h3 className="mb-3 text-[0.95rem] font-semibold">Order types</h3>
            <ul className="space-y-2">
              {orderTypes.map((ot) => (
                <li
                  key={ot.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{ot.name}</span>
                    <span className="ml-2 text-xs text-ink-muted">
                      {ot.isDelivery ? "Delivery" : "In-house"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={ot.isActive ? "ok" : "warn"}>
                      {ot.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {canWrite ? (
                      <Button
                        variant="secondary"
                        className="min-h-8 text-xs"
                        onClick={() => toggleOrderType(ot)}
                      >
                        {ot.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {canWrite ? (
            <form onSubmit={saveOrderType} className="panel space-y-3">
              <h3 className="text-[0.95rem] font-semibold">Add order type</h3>
              <input
                className="field-input"
                placeholder="Name e.g. Glovo"
                value={otName}
                onChange={(e) => setOtName(e.target.value)}
                required
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={otDelivery}
                  onChange={(e) => setOtDelivery(e.target.checked)}
                />
                Delivery platform (requires platform order code on POS)
              </label>
              <Button type="submit">Save order type</Button>
            </form>
          ) : null}
        </div>
      )}

      {tab === "security" && (
        <div className="panel max-w-md space-y-3">
          <h3 className="text-[0.95rem] font-semibold">Manager authorization PIN</h3>
          <p className="text-xs text-ink-muted">
            Required for voids by non-administrators. Stored as a scrypt hash in
            SystemSetting. Only administrators can set it.
          </p>
          {role === "ADMINISTRATOR" ? (
            <form onSubmit={saveManagerPin} className="space-y-3">
              <input
                className="field-input"
                type="password"
                inputMode="numeric"
                placeholder="New PIN (4–8 digits)"
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value)}
                pattern="\d{4,8}"
                required
              />
              <input
                className="field-input"
                type="password"
                inputMode="numeric"
                placeholder="Confirm PIN"
                value={managerPin2}
                onChange={(e) => setManagerPin2(e.target.value)}
                required
              />
              <Button type="submit">Set manager PIN</Button>
            </form>
          ) : (
            <p className="text-sm text-ink-muted">Only administrators can set the PIN.</p>
          )}
        </div>
      )}
    </div>
  );
}
