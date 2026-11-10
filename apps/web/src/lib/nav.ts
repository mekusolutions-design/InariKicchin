/** Blueprint §14 — sidebar sections with role visibility */

import type { Role } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  /** Roles that may see this item. Empty = all authenticated roles. */
  roles?: Role[];
};

export const NAV_SECTIONS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    roles: ["ADMINISTRATOR", "MANAGER"],
  },
  {
    href: "/inventory-received",
    label: "Inventory Received",
    roles: ["ADMINISTRATOR", "MANAGER"],
  },
  {
    href: "/makeline",
    label: "Makeline Inventory",
    roles: ["ADMINISTRATOR", "MANAGER", "KITCHEN_STAFF"],
  },
  {
    href: "/closing-stock",
    label: "Closing Stock",
    roles: ["ADMINISTRATOR", "MANAGER"],
  },
  {
    href: "/stock-history",
    label: "Stock History",
    roles: ["ADMINISTRATOR", "MANAGER"],
  },
  {
    href: "/menu",
    label: "Menu Management",
    roles: ["ADMINISTRATOR", "MANAGER"],
  },
  {
    href: "/pos",
    label: "POS / Sales",
    roles: ["ADMINISTRATOR", "MANAGER", "CASHIER"],
  },
  {
    href: "/kitchen-tickets",
    label: "Kitchen Tickets",
    roles: ["ADMINISTRATOR", "MANAGER", "KITCHEN_STAFF"],
  },
  {
    href: "/reports",
    label: "Reports",
    roles: ["ADMINISTRATOR", "MANAGER"],
  },
  {
    href: "/pos-order-reports",
    label: "POS Order Reports",
    roles: ["ADMINISTRATOR", "MANAGER", "CASHIER"],
  },
  {
    href: "/suppliers",
    label: "Suppliers",
    roles: ["ADMINISTRATOR", "MANAGER"],
  },
  {
    href: "/settings",
    label: "Settings",
    roles: ["ADMINISTRATOR", "MANAGER"],
  },
];

export function navForRole(role?: Role | null): NavItem[] {
  if (!role) return NAV_SECTIONS;
  return NAV_SECTIONS.filter(
    (item) => !item.roles || item.roles.includes(role),
  );
}

/** Default landing path per role after login */
export function homePathForRole(role?: Role | null): string {
  switch (role) {
    case "CASHIER":
      return "/pos";
    case "KITCHEN_STAFF":
      return "/kitchen-tickets";
    default:
      return "/dashboard";
  }
}
