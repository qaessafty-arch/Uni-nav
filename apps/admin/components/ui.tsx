"use client";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
const btn: Record<BtnVariant, string> = {
  primary: "bg-accent text-accent-fg border-accent hover:brightness-110",
  secondary: "bg-surface text-fg border-line-strong hover:border-fg",
  ghost: "bg-transparent text-fg border-transparent hover:border-line-strong",
  danger: "bg-transparent text-danger border-danger hover:bg-danger hover:text-bg",
};
const btnBase = "inline-flex items-center justify-center gap-2 min-h-11 px-4 border text-sm font-semibold tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

export function Button({ variant = "secondary", className, ...p }: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return <button type="button" className={cx(btnBase, btn[variant], className)} {...p} />;
}

export function ButtonLink({ variant = "secondary", className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link className={cx(btnBase, btn[variant], className)} {...p} />;
}

export function Section({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("border-t border-line pt-4 mt-6 first:mt-0 first:border-0 first:pt-0", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3 gap-3">
          {title ? <h2 className="label-caps">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "accent" | "warn" | "danger" | "info"; children: ReactNode; className?: string }) {
  const t = {
    neutral: "border-line-strong text-muted",
    accent: "border-accent text-accent",
    warn: "border-warn text-warn",
    danger: "border-danger text-danger",
    info: "border-info text-info",
  }[tone];
  return <span className={cx("inline-flex items-center gap-1 border px-1.5 py-0.5 mono text-[11px] uppercase tracking-wider whitespace-nowrap", t, className)}>{children}</span>;
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-muted py-10 justify-center">
      <span className="inline-block size-3 bg-accent animate-pulse" aria-hidden />
      <span className="mono text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong p-6 text-center">
      <p className="font-semibold">{title}</p>
      {body ? <p className="text-muted text-sm mt-1">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, body, onRetry, retryLabel }: { title: string; body?: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="border border-danger p-5">
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
    <Link href={href} className="flex items-center gap-3 border-b border-line py-3 min-h-14 hover:bg-surface px-2 -mx-2">
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{title}</div>
        {subtitle ? <div className="text-sm text-muted truncate">{subtitle}</div> : null}
      </div>
      {meta ? <div className="shrink-0 text-sm text-muted">{meta}</div> : null}
      <span aria-hidden className="text-faint rtl:rotate-180">→</span>
    </Link>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <span className="mono inline-block border border-line-strong px-1.5 text-sm">{children}</span>;
}

export function PageTitle({ children, eyebrow, actions }: { children: ReactNode; eyebrow?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="label-caps mb-1">{eyebrow}</div> : null}
        <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
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
