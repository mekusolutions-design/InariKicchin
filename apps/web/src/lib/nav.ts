/** Blueprint §14 — 11 sidebar sections in order */
export const NAV_SECTIONS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inventory-received", label: "Inventory Received" },
  { href: "/makeline", label: "Makeline Inventory" },
  { href: "/closing-stock", label: "Closing Stock" },
  { href: "/stock-history", label: "Stock History" },
  { href: "/menu", label: "Menu Management" },
  { href: "/pos", label: "POS / Sales" },
  { href: "/kitchen-tickets", label: "Kitchen Tickets" },
  { href: "/reports", label: "Reports" },
  { href: "/pos-order-reports", label: "POS Order Reports" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/settings", label: "Settings" },
] as const;
