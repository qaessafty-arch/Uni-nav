"use client";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

/*
 * Presentation primitives. Visual treatment comes from the shared
 * `@campusnav/tokens/ui.css` layer (cn-* classes) and changes with the selected
 * visual style (html[data-style]). APIs are unchanged.
 */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
const btn: Record<BtnVariant, string> = {
  primary: "cn-btn cn-btn-primary",
  secondary: "cn-btn",
  ghost: "cn-btn cn-btn-ghost",
  danger: "cn-btn cn-btn-danger",
};

export function Button({ variant = "secondary", className, ...p }: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return <button type="button" className={cx(btn[variant], className)} {...p} />;
}

export function ButtonLink({ variant = "secondary", className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link className={cx(btn[variant], className)} {...p} />;
}

export function Section({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("mt-10 first:mt-0", className)}>
      {(title || action) && (
        <div className="cn-section-head flex items-end justify-between mb-4 gap-3">
          {title ? <h2 className="label-caps">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "accent" | "warn" | "danger" | "info"; children: ReactNode; className?: string }) {
  const t = { neutral: "text-muted", accent: "text-accent", warn: "text-warn", danger: "text-danger", info: "text-info" }[tone];
  return <span className={cx("cn-badge", t, className)}>{children}</span>;
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-muted py-16 justify-center">
      <span className="inline-flex gap-1" aria-hidden>
        <span className="size-2 bg-accent animate-pulse" />
        <span className="size-2 bg-accent animate-pulse [animation-delay:150ms]" />
        <span className="size-2 bg-accent animate-pulse [animation-delay:300ms]" />
      </span>
      <span className="label-caps">{label}</span>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong rounded-[var(--cn-radius)] px-6 py-8 text-center">
      <span className="cn-mark" aria-hidden />
      <p className="font-semibold mt-3">{title}</p>
      {body ? <p className="text-muted text-sm mt-1">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, body, onRetry, retryLabel }: { title: string; body?: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="border-s-4 border-danger bg-surface p-5">
      <p className="font-semibold text-danger">{title}</p>
      {body ? <p className="text-muted text-sm mt-1 break-words">{body}</p> : null}
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "accent"; children: ReactNode }) {
  const t = { info: "border-info", warn: "border-warn", accent: "border-accent" }[tone];
  return <div className={cx("border-s-4 bg-surface px-4 py-3 text-sm", t)}>{children}</div>;
}

export function Row({ href, title, subtitle, meta, leading }: { href: string; title: ReactNode; subtitle?: ReactNode; meta?: ReactNode; leading?: ReactNode }) {
  return (
    <Link href={href} className="group flex items-center gap-4 border-b border-line py-3.5 min-h-14 px-2 -mx-2 transition-colors hover:bg-surface">
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{title}</div>
        {subtitle ? <div className="text-sm text-muted truncate">{subtitle}</div> : null}
      </div>
      {meta ? <div className="shrink-0 text-sm text-muted">{meta}</div> : null}
      <span aria-hidden className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent rtl:rotate-180 rtl:group-hover:-translate-x-0.5">
        →
      </span>
    </Link>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <span className="mono inline-block border border-line-strong rounded-[var(--cn-radius)] px-1.5 text-sm">{children}</span>;
}

export function PageTitle({ children, eyebrow, actions }: { children: ReactNode; eyebrow?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="label-caps mb-2">{eyebrow}</div> : null}
        <h1 className="cn-display cn-display-lg">{children}</h1>
      </div>
      {actions}
    </header>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex items-start gap-3 py-3 cursor-pointer min-h-11">
      <input type="checkbox" className="mt-1 size-5 accent-[var(--cn-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-medium">{label}</span>
        {description ? <span className="block text-sm text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/** Visual-style selector (UI only). */
export function StyleSelector({ value, onChange, labels, legend }: { value: string; onChange: (v: "minimal" | "editorial" | "brutal") => void; labels: Record<"minimal" | "editorial" | "brutal", string>; legend: string }) {
  const keys = ["minimal", "editorial", "brutal"] as const;
  const preview: Record<(typeof keys)[number], ReactNode> = {
    minimal: <span className="block text-[15px] font-semibold tracking-tight" style={{ fontFamily: "Inter Variable, system-ui" }}>Aa</span>,
    editorial: <span className="block text-[22px] italic leading-none" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>Aa</span>,
    brutal: <span className="block text-[15px] font-black uppercase tracking-tighter" style={{ fontFamily: "Inter Variable, system-ui" }}>AA</span>,
  };
  return (
    <div role="radiogroup" aria-label={legend} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cx("text-start p-3 border min-h-16 flex items-center gap-3", value === k ? "border-accent bg-accent-soft" : "border-line-strong hover:border-fg")}
          style={{ borderRadius: k === "minimal" ? 3 : 0, borderWidth: k === "brutal" ? 2 : 1 }}
        >
          <span className="size-10 grid place-items-center bg-bg border border-line shrink-0" aria-hidden>
            {preview[k]}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold" dir="ltr">{labels[k]}</span>
            {value === k ? <svg viewBox="0 0 24 24" className="size-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5 10 17.5 19 7" /></svg> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
