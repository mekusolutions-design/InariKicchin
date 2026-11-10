"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { saveSession, type LoginResponse } from "@/lib/auth";
import { homePathForRole } from "@/lib/nav";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as LoginResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Login failed");
      saveSession(data);
      router.replace(homePathForRole(data.user?.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-navy p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-[14px] bg-surface p-7 shadow-xl"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-white">
            IK
          </div>
          <div>
            <strong className="block text-ink">Inari Kicchin</strong>
            <span className="text-[0.7rem] text-ink-muted">
              Restaurant management
            </span>
          </div>
        </div>
        <h1 className="mb-1 text-xl font-bold tracking-tight">Sign in</h1>
        <p className="mb-5 text-sm text-ink-muted">Use your staff account</p>
        <label className="mb-3 flex flex-col gap-1 text-[0.72rem] font-semibold text-ink-muted">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 rounded-lg border border-border px-3 text-sm text-ink"
            autoComplete="username"
            placeholder="name@restaurant.com"
            required
          />
        </label>
        <label className="mb-3 flex flex-col gap-1 text-[0.72rem] font-semibold text-ink-muted">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-11 rounded-lg border border-border px-3 text-sm text-ink"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
        </label>
        {error ? (
          <p className="mb-3 text-sm text-danger">{error}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
        <p className="mt-3 text-xs text-ink-muted">
          Next.js + TypeScript · Blueprint §14 (navy + orange #EA580C)
        </p>
      </form>
    </div>
  );
}
