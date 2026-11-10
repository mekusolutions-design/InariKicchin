"use client";

import {useEffect, useId, useMemo, useRef, useState, type KeyboardEvent} from "react";

export type TypeaheadOption = {
  id: string;
  label: string;
  meta?: string;
  keywords?: string;
};

type Props = {
  label: string;
  required?: boolean;
  placeholder?: string;
  options: TypeaheadOption[];
  valueId: string;
  onSelect: (opt: TypeaheadOption | null) => void;
  onCreate?: (typed: string) => void;
  createLabel?: (typed: string) => string;
  disabled?: boolean;
};

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function TypeaheadCombobox({
  label,
  required,
  placeholder,
  options,
  valueId,
  onSelect,
  onCreate,
  createLabel,
  disabled,
}: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === valueId);

  useEffect(() => {
    if (selected) setQuery(selected.label);
  }, [selected?.id, selected?.label]);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return options.slice(0, 50);
    return options
      .filter((o) => {
        const hay = norm(`${o.label} ${o.meta ?? ""} ${o.keywords ?? ""}`);
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [options, query]);

  const showCreate =
    Boolean(onCreate) &&
    query.trim().length > 0 &&
    !options.some((o) => norm(o.label) === norm(query));

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(opt: TypeaheadOption) {
    onSelect(opt);
    setQuery(opt.label);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    const total = filtered.length + (showCreate ? 1 : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => (h + 1) % Math.max(total, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => (h - 1 + Math.max(total, 1)) % Math.max(total, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showCreate && hi === filtered.length) {
        onCreate?.(query.trim());
        setOpen(false);
      } else if (filtered[hi]) {
        pick(filtered[hi]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="field-label">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <input
        className="field-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        placeholder={placeholder ?? "Type to search…"}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHi(0);
          if (!e.target.value.trim()) onSelect(null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg"
        >
          {filtered.length === 0 && !showCreate ? (
            <li className="px-3 py-2 text-sm text-ink-muted">No matches</li>
          ) : null}
          {filtered.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === hi}>
              <button
                type="button"
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                  i === hi ? "bg-primary/10 text-primary" : "hover:bg-bg"
                }`}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(o)}
              >
                <span className="font-medium">{o.label}</span>
                {o.meta ? (
                  <span className="text-xs text-ink-muted">{o.meta}</span>
                ) : null}
              </button>
            </li>
          ))}
          {showCreate ? (
            <li role="option" aria-selected={hi === filtered.length}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm font-semibold text-primary ${
                  hi === filtered.length ? "bg-primary/10" : "hover:bg-bg"
                }`}
                onMouseEnter={() => setHi(filtered.length)}
                onClick={() => {
                  onCreate?.(query.trim());
                  setOpen(false);
                }}
              >
                {createLabel
                  ? createLabel(query.trim())
                  : `+ Add “${query.trim()}” as new`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
