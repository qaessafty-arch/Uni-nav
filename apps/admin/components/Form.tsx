"use client";
import type { LocalizedText, OfficeHour, Weekday } from "@campusnav/core";
import { cx } from "./ui";

export const inputCls = "cn-input w-full !min-h-10 text-sm aria-[invalid=true]:!border-danger";

export function Field({ label, error, children, hint, htmlFor }: { label: string; error?: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="label-caps block mb-1.5">{label}</label>
      {children}
      {hint ? <p className="text-xs text-muted mt-1">{hint}</p> : null}
      {error ? <p className="text-xs text-danger mt-1" role="alert">{error}</p> : null}
    </div>
  );
}

const LANG: { k: keyof LocalizedText; label: string; dir: "ltr" | "rtl" }[] = [
  { k: "en", label: "English", dir: "ltr" },
  { k: "ckb", label: "کوردی", dir: "rtl" },
  { k: "ar", label: "العربية", dir: "rtl" },
];

export function LocalizedInput({ id, value, onChange, invalid, multiline }: { id: string; value: LocalizedText | null | undefined; onChange: (v: LocalizedText) => void; invalid?: boolean; multiline?: boolean }) {
  const v = value ?? { en: "" };
  return (
    <div className="grid gap-1">
      {LANG.map((l) => (
        <div key={l.k} className="flex items-stretch">
          <span className="w-16 shrink-0 grid place-items-center text-[11px] mono text-muted bg-sunken" lang={l.k}>{l.label}</span>
          {multiline ? (
            <textarea
              id={l.k === "en" ? id : undefined}
              dir={l.dir}
              lang={l.k}
              rows={3}
              value={v[l.k] ?? ""}
              aria-invalid={invalid && l.k === "en"}
              onChange={(e) => onChange({ ...v, [l.k]: e.target.value || (l.k === "en" ? "" : undefined) })}
              className={cx(inputCls, "py-2")}
            />
          ) : (
            <input
              id={l.k === "en" ? id : undefined}
              dir={l.dir}
              lang={l.k}
              value={v[l.k] ?? ""}
              aria-invalid={invalid && l.k === "en"}
              onChange={(e) => onChange({ ...v, [l.k]: e.target.value || (l.k === "en" ? "" : undefined) })}
              className={inputCls}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OfficeHoursInput({ value, onChange }: { value: OfficeHour[]; onChange: (v: OfficeHour[]) => void }) {
  return (
    <div className="space-y-1">
      {value.map((h, i) => (
        <div key={i} className="flex gap-1">
          <select value={h.day} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) as Weekday } : x)))} className={cx(inputCls, "w-24")} aria-label="Day">
            {DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
          </select>
          <input type="time" value={h.start} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className={inputCls} aria-label="Start" />
          <input type="time" value={h.end} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className={inputCls} aria-label="End" />
          <button type="button" className="px-3 border border-line-strong text-danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">×</button>
        </div>
      ))}
      <button type="button" className="text-sm underline" onClick={() => onChange([...value, { day: 0, start: "10:00", end: "11:00" }])}>+ Add office hours</button>
    </div>
  );
}
