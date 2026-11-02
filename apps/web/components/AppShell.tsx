"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { lt } from "@campusnav/core";
import { formatInstant } from "@campusnav/i18n";
import { useApp } from "@/lib/store";
import { cx } from "./ui";
import { Logo } from "./Logo";

const NAV = [
  { href: "/", key: "nav.home", icon: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" },
  { href: "/map", key: "nav.map", icon: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" },
  { href: "/scan", key: "nav.scan", icon: "M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4zM15 15h2v2h-2zM19 19h1v1h-1zM12 4v3M12 12h8M12 12v8" },
  { href: "/lecturers", key: "nav.lecturers", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
  { href: "/timetable", key: "nav.timetable", icon: "M4 5h16v15H4zM4 9h16M9 3v4M15 3v4" },
] as const;

export function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-5", className)} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="square" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, bundleState, online, prefs } = useApp();
  const path = usePathname();
  const bundle = bundleState.status === "ready" ? bundleState.bundle : null;
  const isDemo = bundle?.university.dataStatus === "demo";
  const showCachedBanner = bundleState.status === "ready" && (bundleState.origin === "cache" || !online);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="min-h-dvh flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 bg-accent text-accent-fg px-3 py-2 z-50">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-6xl flex items-center gap-4 px-4 h-14">
          <Link href="/" className="flex items-center gap-2 min-w-0" aria-label={t("brand.product")}>
            <Logo />
            <span className="mono font-semibold tracking-wider truncate">{bundle?.university.branding.productName ?? t("brand.product")}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ms-6" aria-label="Primary">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={cx("px-3 py-2 text-sm border-b-2", active(n.href) ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg")}>
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <Link href="/assistant" className="p-2.5 text-muted hover:text-fg" aria-label={t("assistant.title")} title={t("assistant.title")}>
              <Icon d="M4 5h16v11H8l-4 4zM8 9h8M8 12h5" />
            </Link>
            <Link href="/notifications" className="p-2.5 text-muted hover:text-fg" aria-label={t("nav.notifications")} title={t("nav.notifications")}>
              <Icon d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4" />
            </Link>
            <Link href="/settings" className="p-2.5 text-muted hover:text-fg" aria-label={t("nav.settings")} title={t("nav.settings")}>
              <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.3L17 5l-3-1-1 2h-2L10 4 7 5l.3 2L6 8.2 4 8 3 11l2 1v0l-2 1 1 3 2-.2 1.3 1.3L7 19l3 1 1-2h2l1 2 3-1-.3-2 1.3-1.3 2 .3 1-3z" />
            </Link>
          </div>
        </div>
        {isDemo ? (
          <div className="border-t border-warn/40 bg-[color-mix(in_srgb,var(--cn-warning)_10%,transparent)]">
            <p className="mx-auto max-w-6xl px-4 py-1.5 text-xs flex items-center gap-2">
              <span className="mono font-semibold text-warn">{t("data.demo")}</span>
              <span className="text-muted">{t("data.demoLong")}</span>
            </p>
          </div>
        ) : null}
        {showCachedBanner && bundleState.status === "ready" ? (
          <div className="border-t border-info/40" role="status">
            <p className="mx-auto max-w-6xl px-4 py-1.5 text-xs text-muted">
              <span className="mono font-semibold text-info me-2">{online ? t("offline.cached") : t("offline.title")}</span>
              {t("offline.body", { date: formatInstant(prefs.locale, bundleState.cachedAt, bundle?.university.settings.timezone ?? "UTC") })}
            </p>
          </div>
        ) : null}
      </header>

      <main id="main" className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:pb-10">
        {children}
      </main>

      <footer className="hidden md:block border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between text-xs text-faint mono">
          <span>
            {t("brand.product")} · {bundle ? lt(bundle.university.name, prefs.locale) : ""}
          </span>
          <span>{t("brand.studio")}</span>
        </div>
      </footer>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-bg border-t border-line grid grid-cols-5 pb-[env(safe-area-inset-bottom)]" aria-label="Primary">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={cx("flex flex-col items-center justify-center gap-1 h-16 text-[11px]", active(n.href) ? "text-accent" : "text-muted")}>
            <Icon d={n.icon} />
            <span>{t(n.key)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
