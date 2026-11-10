import type { Config } from "tailwindcss";

/**
 * Blueprint §14.1 design system
 * Dark navy sidebar · orange #EA580C primary · semantic status colours
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0f172a",
          hover: "#1e293b",
          active: "#1e3a5f",
        },
        primary: {
          DEFAULT: "#EA580C",
          hover: "#c2410c",
          soft: "#fff7ed",
        },
        success: {
          DEFAULT: "#16a34a",
          soft: "#dcfce7",
        },
        warning: {
          DEFAULT: "#d97706",
          soft: "#fef3c7",
        },
        danger: {
          DEFAULT: "#dc2626",
          soft: "#fee2e2",
        },
        purple: {
          DEFAULT: "#7c3aed",
          soft: "#ede9fe",
        },
        info: {
          DEFAULT: "#2563eb",
          soft: "#dbeafe",
        },
        bg: "#f8fafc",
        surface: "#ffffff",
        border: {
          DEFAULT: "#e2e8f0",
        },
        ink: {
          DEFAULT: "#0f172a",
          muted: "#64748b",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
