import type { ReactNode } from "react";
import clsx from "clsx";

/** Allowed visual tones — keep in sync with all page usages (Netlify typechecks this). */
export type Tone =
  | "ok"
  | "warn"
  | "err"
  | "info"
  | "purple"
  | "orange"
  | "neutral";

const tones: Record<Tone, string> = {
  ok: "bg-success-soft text-[#166534]",
  warn: "bg-warning-soft text-[#92400e]",
  err: "bg-danger-soft text-[#991b1b]",
  info: "bg-info-soft text-[#1e40af]",
  purple: "bg-purple-soft text-[#5b21b6]",
  orange: "bg-primary-soft text-[#9a3412]",
  neutral: "bg-slate-100 text-slate-700",
};

export function Badge({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full px-2 py-0.5 text-[0.72rem] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Map kitchen / order status strings to a valid Badge tone. */
export function statusTone(status: string): Tone {
  switch (status) {
    case "NEW":
      return "info";
    case "PREPARING":
      return "orange";
    case "READY":
      return "ok";
    case "SERVED":
    case "COLLECTED":
      return "purple";
    case "CANCELLED":
      return "err";
    case "SUBMITTED":
    case "LOCKED":
      return "ok";
    default:
      return "neutral";
  }
}
