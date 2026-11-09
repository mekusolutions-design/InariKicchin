"use client";
import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface MenuItem { id: string; name: string; price: number; isAvailable: boolean }
interface MenuRes { items: MenuItem[] }

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<MenuRes>("/menu").then((m) => setItems(m.items)).catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="text-danger">{error}</p>;
  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Menu Management</h1>
      <p className="mb-5 text-sm text-ink-muted">Items saved here appear in the POS immediately</p>
      <div className="panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[0.72rem] uppercase text-ink-muted">
              <th className="pb-2">Name</th>
              <th className="pb-2 text-right">Price</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="py-2">{i.name}</td>
                <td className="py-2 text-right tabular-nums">{money(i.price)}</td>
                <td className="py-2">
                  <Badge tone={i.isAvailable ? "ok" : "warn"}>
                    {i.isAvailable ? "Available" : "Unavailable"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
