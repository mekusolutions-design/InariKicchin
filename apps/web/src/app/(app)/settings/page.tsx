"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface Meta {
  vat: { enabled: boolean; ratePercent: number; pricesIncludeVat: boolean };
  orderTypes: Array<{ name: string }>;
  paymentMethods: string[];
  users: Array<{ fullName: string; email: string; role: string }>;
}

type Tab = "users" | "vat" | "payments" | "orders" | "security";

export default function SettingsPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("users");

  useEffect(() => {
    api<Meta>("/meta")
      .then(setMeta)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-2 text-danger">{error}</p>
      </div>
    );
  }

  if (!meta) {
    return (
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Loading…</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "users", label: "Users" },
    { id: "vat", label: "VAT" },
    { id: "payments", label: "Payment methods" },
    { id: "orders", label: "Order types" },
    { id: "security", label: "Security" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Users and System Settings</h1>
        <p className="page-sub">
          Administrator controls · every change is audited
        </p>
      </div>

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

      {tab === "users" && (
        <div className="panel">
          <h3 className="mb-3 text-[0.95rem] font-semibold">Users</h3>
          <div className="overflow-x-auto">
            <table className="table-base min-w-[400px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {meta.users.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-3 text-ink-muted">
                      No users returned
                    </td>
                  </tr>
                ) : (
                  meta.users.map((u) => (
                    <tr key={u.email}>
                      <td className="font-medium">{u.fullName}</td>
                      <td className="text-ink-muted">{u.email}</td>
                      <td>
                        <Badge tone="info">{u.role}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            User create / role changes are managed through the authenticated API
            when those endpoints are enabled.
          </p>
        </div>
      )}

      {tab === "vat" && (
        <div className="panel max-w-lg">
          <h3 className="mb-3 text-[0.95rem] font-semibold">VAT configuration</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-ink-muted">Enabled</dt>
              <dd>
                <Badge tone={meta.vat.enabled ? "ok" : "warn"}>
                  {meta.vat.enabled ? "Yes" : "No"}
                </Badge>
              </dd>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-ink-muted">Rate</dt>
              <dd className="font-semibold">{meta.vat.ratePercent}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Prices include VAT</dt>
              <dd className="font-semibold">
                {meta.vat.pricesIncludeVat ? "Yes" : "No"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-ink-muted">
            Rate is never typed on menu items — it follows this global setting
            (blueprint §14.7 / §14.11).
          </p>
        </div>
      )}

      {tab === "payments" && (
        <div className="panel max-w-lg">
          <h3 className="mb-3 text-[0.95rem] font-semibold">Payment methods</h3>
          <ul className="space-y-2">
            {(meta.paymentMethods || []).map((m) => (
              <li
                key={m}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
              >
                <span className="font-medium">{m}</span>
                <Badge tone="ok">Active</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "orders" && (
        <div className="panel max-w-lg">
          <h3 className="mb-3 text-[0.95rem] font-semibold">
            Order types & delivery platforms
          </h3>
          <ul className="space-y-2">
            {(meta.orderTypes || []).map((t) => (
              <li
                key={t.name}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
              >
                <span className="font-medium">{t.name}</span>
                <Badge tone="ok">Active</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "security" && (
        <div className="panel max-w-lg">
          <h3 className="mb-3 text-[0.95rem] font-semibold">Security</h3>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li>• Session tokens are opaque and stored as digests server-side</li>
            <li>• Protected routes require a valid Bearer token</li>
            <li>• Login lockout is enforced after repeated failures</li>
            <li>• Role permissions are checked on mutating API routes</li>
          </ul>
          <p className="mt-4 text-xs text-ink-muted">
            Inactivity timeout and password policy are configured via environment
            / system settings on the API.
          </p>
        </div>
      )}
    </div>
  );
}
