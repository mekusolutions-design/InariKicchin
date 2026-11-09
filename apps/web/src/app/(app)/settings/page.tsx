"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Meta {
  vat: { enabled: boolean; ratePercent: number; pricesIncludeVat: boolean };
  orderTypes: Array<{ name: string }>;
  paymentMethods: string[];
  users: Array<{ fullName: string; email: string; role: string }>;
}

export default function SettingsPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Meta>("/meta").then(setMeta).catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="text-danger">{error}</p>;
  if (!meta) return <p className="text-ink-muted">Loading…</p>;
  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Users and System Settings</h1>
      <p className="mb-5 text-sm text-ink-muted">Administrator controls · every change is audited</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel">
          <h3 className="mb-3 text-[0.95rem] font-semibold">Users</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[0.72rem] uppercase text-ink-muted">
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {meta.users.map((u) => (
                <tr key={u.email} className="border-t border-border">
                  <td className="py-2">{u.fullName}</td>
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3 className="mb-2 text-[0.95rem] font-semibold">VAT</h3>
          <p className="text-sm">
            <strong>{meta.vat.enabled ? `${meta.vat.ratePercent}%` : "Off"}</strong>
            {" · "}
            {meta.vat.pricesIncludeVat ? "Prices include VAT" : "Prices exclude VAT"}
          </p>
          <h3 className="mb-2 mt-4 text-[0.95rem] font-semibold">Order types</h3>
          <p className="text-sm">{meta.orderTypes.map((t) => t.name).join(" · ")}</p>
          <h3 className="mb-2 mt-4 text-[0.95rem] font-semibold">Payment methods</h3>
          <p className="text-sm">{meta.paymentMethods.join(" · ")}</p>
        </div>
      </div>
    </div>
  );
}
