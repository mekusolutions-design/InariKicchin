"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface MetaRaw {
  vat?: {
    enabled?: boolean;
    ratePercent?: number;
    rate?: number;
    pricesIncludeVat?: boolean;
  };
  orderTypes?: Array<{ name: string } | string>;
  paymentMethods?: string[];
  users?: Array<{
    id?: string;
    fullName?: string;
    full_name?: string;
    email: string;
    role: string;
  }>;
  durable?: boolean;
}

interface Meta {
  vat: { enabled: boolean; ratePercent: number; pricesIncludeVat: boolean };
  orderTypes: Array<{ name: string }>;
  paymentMethods: string[];
  users: Array<{ fullName: string; email: string; role: string }>;
  durable?: boolean;
}

function normalize(raw: MetaRaw): Meta {
  const ratePercent =
    raw.vat?.ratePercent != null
      ? Number(raw.vat.ratePercent)
      : raw.vat?.rate != null
        ? Number(raw.vat.rate) <= 1
          ? Number(raw.vat.rate) * 100
          : Number(raw.vat.rate)
        : 16;
  return {
    vat: {
      enabled: raw.vat?.enabled ?? true,
      ratePercent,
      pricesIncludeVat: raw.vat?.pricesIncludeVat ?? true,
    },
    orderTypes: (raw.orderTypes ?? []).map((t) =>
      typeof t === "string" ? { name: t } : { name: t.name },
    ),
    paymentMethods: raw.paymentMethods ?? [],
    users: (raw.users ?? []).map((u) => ({
      fullName: u.fullName ?? u.full_name ?? u.email,
      email: u.email,
      role: u.role,
    })),
    durable: raw.durable,
  };
}

type Tab = "users" | "vat" | "payments" | "orders" | "security";

export default function SettingsPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("users");

  useEffect(() => {
    api<MetaRaw>("/meta")
      .then((raw) => setMeta(normalize(raw)))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-2 text-danger">{error}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Settings reads configuration from <code>GET /meta</code>. Ensure you
          are signed in and the API is reachable.
        </p>
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
          {meta.durable ? " · PostgreSQL-backed" : ""}
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
                      No users returned by the API. Seed or bootstrap an
                      administrator if the database is empty.
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
            User create / role changes require administrator endpoints when
            enabled. This view is read-only from <code>/meta</code>.
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
        </div>
      )}

      {tab === "payments" && (
        <div className="panel max-w-lg">
          <h3 className="mb-3 text-[0.95rem] font-semibold">Payment methods</h3>
          <ul className="space-y-2">
            {meta.paymentMethods.length === 0 ? (
              <li className="text-sm text-ink-muted">None configured</li>
            ) : (
              meta.paymentMethods.map((m) => (
                <li
                  key={m}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{m}</span>
                  <Badge tone="ok">Active</Badge>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {tab === "orders" && (
        <div className="panel max-w-lg">
          <h3 className="mb-3 text-[0.95rem] font-semibold">
            Order types & delivery platforms
          </h3>
          <ul className="space-y-2">
            {meta.orderTypes.length === 0 ? (
              <li className="text-sm text-ink-muted">None configured</li>
            ) : (
              meta.orderTypes.map((t) => (
                <li
                  key={t.name}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{t.name}</span>
                  <Badge tone="ok">Active</Badge>
                </li>
              ))
            )}
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
        </div>
      )}
    </div>
  );
}
