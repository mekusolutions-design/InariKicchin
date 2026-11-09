import clsx from "clsx";

type Tone = "ok" | "warn" | "err" | "info" | "purple" | "orange";

const tones: Record<Tone, string> = {
  ok: "bg-success-soft text-[#166534]",
  warn: "bg-warning-soft text-[#92400e]",
  err: "bg-danger-soft text-[#991b1b]",
  info: "bg-info-soft text-[#1e40af]",
  purple: "bg-purple-soft text-[#5b21b6]",
  orange: "bg-primary-soft text-[#9a3412]",
};

export function Badge({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
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
