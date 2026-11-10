"use client";

import { useEffect, useState , type FormEvent } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface Supplier {
  id: string;
  name: string;
  isActive: boolean;
  phone?: string;
  email?: string;
  contactName?: string;
}

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [kra, setKra] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api<Supplier[]>("/suppliers");
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = rows.filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function createSupplier(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const n = name.trim();
      if (!n) throw new Error("Supplier name is required");
      await api("/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: n,
          phone: phone.trim() || undefined,
          notes:
            [kra.trim() && `KRA: ${kra.trim()}`, notes.trim()]
              .filter(Boolean)
              .join(" | ") || undefined,
        }),
      });
      setMsg(`Supplier “${n}” created`);
      setName("");
      setPhone("");
      setKra("");
      setNotes("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  if (error && rows.length === 0 && !loading) {
    return (
      <div>
        <h1 className="page-title">Suppliers</h1>
        <p className="mt-2 text-danger">{error}</p>
        <Button className="mt-3" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-sub">
            Supplier master used by Inventory Received · also creatable inline
            on receipt form
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New supplier"}
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {msg ? <p className="text-sm text-success">{msg}</p> : null}

      {showForm ? (
        <form onSubmit={createSupplier} className="panel max-w-lg space-y-3">
          <div>
            <label className="field-label">Name *</label>
            <input
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label">Phone</label>
            <input
              className="field-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">KRA PIN (optional)</label>
            <input
              className="field-input"
              value={kra}
              onChange={(e) => setKra(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea
              className="field-input min-h-[56px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save supplier"}
          </Button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field-input max-w-xs"
          placeholder="Search suppliers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Badge tone="info">{filtered.length} suppliers</Badge>
      </div>

      <div className="panel">
        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[480px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-ink-muted">
                      No suppliers found.{" "}
                      <button
                        type="button"
                        className="text-primary underline"
                        onClick={() => setShowForm(true)}
                      >
                        Add one
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td className="text-ink-muted">
                        {s.contactName || s.email || "—"}
                      </td>
                      <td className="text-ink-muted">{s.phone || "—"}</td>
                      <td>
                        <Badge tone={s.isActive ? "ok" : "warn"}>
                          {s.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
