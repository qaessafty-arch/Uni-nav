"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { lt, type CampusBundle } from "@campusnav/core";
import { formatInstant } from "@campusnav/i18n";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";
import { cx } from "./ui";
import { Logo } from "./Logo";
import { Icon as IconBase } from "./Icon";
import { I } from "./icons";
import { CommandPalette, type PageLink } from "./CommandPalette";
import { LocationDialog, nodeName } from "./LocationPicker";

/** Kept for existing imports. */
export const Icon = IconBase;

const GROUPS: { key: "nav.group.explore" | "nav.group.academic" | "nav.group.you"; items: PageLink[] }[] = [
  {
    key: "nav.group.explore",
    items: [
      { href: "/", key: "nav.home", icon: I.home },
      { href: "/search", key: "nav.search", icon: I.search },
      { href: "/map", key: "nav.map", icon: I.map },
      { href: "/nearby", key: "nav.nearby", icon: I.nearby },
      { href: "/scan", key: "nav.scan", icon: I.scan },
    ],
  },
  {
    key: "nav.group.academic",
    items: [
      { href: "/timetable", key: "nav.timetable", icon: I.timetable },
      { href: "/lecturers", key: "nav.lecturers", icon: I.lecturers },
    ],
  },
  {
    key: "nav.group.you",
    items: [
      { href: "/saved", key: "nav.saved", icon: I.saved },
      { href: "/notifications", key: "nav.notifications", icon: I.bell },
      { href: "/assistant", key: "assistant.title", icon: I.ask },
      { href: "/settings", key: "nav.settings", icon: I.settings },
    ],
  },
];
const ALL_PAGES: PageLink[] = [...GROUPS.flatMap((g) => g.items), { href: "/report", key: "nav.report", icon: I.flag }];

const TABS: PageLink[] = [
  { href: "/", key: "nav.home", icon: I.home },
  { href: "/map", key: "nav.map", icon: I.map },
  { href: "/scan", key: "nav.scan", icon: I.scan },
  { href: "/timetable", key: "nav.timetable", icon: I.timetable },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
}

/** "You are here" bar: shows the current starting point and opens the location picker. */
function LocationBar({ bundle, onOpen, className }: { bundle: CampusBundle | null; onOpen: () => void; className?: string }) {
  const { t, prefs, start } = useApp();
  const node = bundle && start ? lookup(bundle).nodes.get(start.nodeId) : undefined;
  return (
    <button type="button" className={cx("cn-locbar", className)} onClick={onOpen} aria-haspopup="dialog" disabled={!bundle}>
      <span className={cx("cn-dot", node ? "bg-accent cn-pulse" : "bg-[var(--cn-text-faint)]")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-muted leading-tight">{t("shell.location")}</span>
        <span className="block font-medium truncate leading-tight">{node && bundle ? nodeName(node, lookup(bundle), prefs.locale) : t("shell.noLocation")}</span>
      </span>
      <span className="text-xs text-accent font-semibold shrink-0">{node ? t("shell.change") : t("shell.setLocation")}</span>
    </button>
  );
}

function SidebarContent({ bundle, onNavigate, onOpenLocation }: { bundle: CampusBundle | null; onNavigate?: () => void; onOpenLocation: () => void }) {
  const { t, prefs, online } = useApp();
  const isActive = useActive();
  return (
    <>
      <div className="px-5 h-16 flex items-center gap-3 border-b border-line shrink-0">
        <Link href="/" className="flex items-center gap-2.5 min-w-0" onClick={onNavigate} aria-label={t("brand.product")}>
          <Logo />
          <span className="flex flex-col leading-none min-w-0">
            <span className="mono font-semibold tracking-[0.12em] truncate text-[13px]">{bundle?.university.branding.productName ?? t("brand.product")}</span>
            <span className="text-[11px] text-muted truncate mt-1">{bundle ? lt(bundle.university.name, prefs.locale) : t("brand.studio")}</span>
          </span>
        </Link>
      </div>
      <div className="p-3 pb-1">
        <LocationBar bundle={bundle} onOpen={onOpenLocation} />
      </div>
      <nav aria-label="Primary" className="flex-1">
        {GROUPS.map((g) => (
          <div key={g.key} className="cn-side-group">
            <div className="cn-side-label">{t(g.key)}</div>
            <ul className="space-y-0.5">
              {g.items.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} onClick={onNavigate} aria-current={isActive(n.href) ? "page" : undefined} className="cn-navitem">
                    <IconBase d={n.icon} />
                    <span className="truncate">{t(n.key)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-line space-y-2">
        <Link href="/report" onClick={onNavigate} aria-current={isActive("/report") ? "page" : undefined} className="cn-navitem">
          <IconBase d={I.flag} />
          <span>{t("nav.report")}</span>
        </Link>
        <div className="flex items-center justify-between px-2.5 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span className={cx("cn-dot", online ? "bg-accent" : "bg-[var(--cn-warning)]")} aria-hidden />
            {online ? t("shell.online") : t("shell.offline")}
          </span>
          {bundle?.university.dataStatus === "demo" ? <span className="mono font-semibold text-warn">{t("data.demo")}</span> : null}
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, bundleState, online, prefs } = useApp();
  const path = usePathname();
  const isActive = useActive();
  const bundle = bundleState.status === "ready" ? bundleState.bundle : null;
  const index = bundleState.status === "ready" ? bundleState.index : null;
  const isDemo = bundle?.university.dataStatus === "demo";
  const showCachedBanner = bundleState.status === "ready" && (bundleState.origin === "cache" || !online);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  /** Map pages fill the screen; the explorer brings its own search and location row. */
  const fullBleed = path === "/" || path === "/map";
  const openLocation = useCallback(() => {
    setDrawer(false);
    setLocOpen(true);
  }, []);

  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setPalette(true);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setPalette(true);
      } else if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="cn-app">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 bg-accent text-accent-fg px-3 py-2 z-50">
        Skip to content
      </a>
      <aside className="cn-rail hidden lg:flex">
        <SidebarContent bundle={bundle} onOpenLocation={openLocation} />
      </aside>

      <div className={cx("min-w-0 flex flex-col", fullBleed && "h-dvh overflow-hidden")}>
        <header className="cn-topbar">
          <div className="flex items-center gap-2 px-3 md:px-6 h-16">
            <button type="button" className="lg:hidden p-2.5 -ms-1 text-muted hover:text-fg" onClick={() => setDrawer(true)} aria-label={t("shell.menu")} aria-expanded={drawer}>
              <IconBase d={I.menu} />
            </button>
            <Link href="/" className="lg:hidden flex items-center gap-2 me-1" aria-label={t("brand.product")}>
              <Logo />
              <span className="hidden sm:inline mono font-semibold tracking-[0.12em] text-[13px]">{bundle?.university.branding.productName ?? t("brand.product")}</span>
            </Link>
            <button type="button" className={cx("cn-searchtrigger max-w-xl min-w-0 flex-1", fullBleed && "!hidden")} onClick={() => setPalette(true)} aria-haspopup="dialog">
              <IconBase d={I.search} />
              <span className="flex-1 truncate">{t("shell.searchHint")}</span>
              <span className="cn-kbd hidden md:inline">Ctrl K</span>
            </button>
            <div className="ms-auto flex items-center gap-0.5 shrink-0">
              <span className={cx("hidden md:inline-flex items-center gap-2 text-xs px-2.5 py-1 me-1 rounded-full border", online ? "border-line text-muted" : "border-warn text-warn")} role="status">
                <span className={cx("cn-dot", online ? "bg-accent" : "bg-[var(--cn-warning)]")} aria-hidden />
                {online ? t("shell.online") : t("shell.offline")}
              </span>
              <Link href="/notifications" className="p-2.5 text-muted hover:text-fg" aria-label={t("nav.notifications")} title={t("nav.notifications")}>
                <IconBase d={I.bell} />
              </Link>
              <Link href="/settings" className="hidden md:inline-flex p-2.5 text-muted hover:text-fg" aria-label={t("nav.settings")} title={t("nav.settings")}>
                <IconBase d={I.settings} />
              </Link>
            </div>
          </div>
          <div className={cx("lg:hidden px-3 md:px-6 pb-2.5", fullBleed && "hidden")}>
            <LocationBar bundle={bundle} onOpen={openLocation} className="!min-h-10 !py-1.5" />
          </div>
          {isDemo ? (
            <div className="cn-strip">
              <p className="px-4 md:px-6 py-1.5 text-xs flex items-center gap-2">
                <span className="mono font-semibold text-warn whitespace-nowrap">{t("data.demo")}</span>
                <span className="text-muted truncate">{t("data.demoLong")}</span>
              </p>
            </div>
          ) : null}
          {showCachedBanner && bundleState.status === "ready" ? (
            <div className="border-t border-info/40" role="status">
              <p className="px-4 md:px-6 py-1.5 text-xs text-muted">
                <span className="mono font-semibold text-info me-2">{online ? t("offline.cached") : t("offline.title")}</span>
                {t("offline.body", { date: formatInstant(prefs.locale, bundleState.cachedAt, bundle?.university.settings.timezone ?? "UTC") })}
              </p>
            </div>
          ) : null}
        </header>

        {fullBleed ? (
          <main id="main" className="flex-1 min-h-0 relative pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        ) : (
          <main id="main" className="cn-sections flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 pb-28 md:pb-16">
            {children}
          </main>
        )}
      </div>

      <nav className="cn-tabbar2 md:hidden" aria-label="Primary">
        {TABS.map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined} className="cn-tab2">
            <IconBase d={n.icon} />
            <span>{t(n.key)}</span>
          </Link>
        ))}
        <button type="button" className="cn-tab2" onClick={() => setDrawer(true)} aria-expanded={drawer}>
          <IconBase d={I.menu} />
          <span>{t("nav.more")}</span>
        </button>
      </nav>

      {drawer ? (
        <>
          <div className="cn-overlay lg:hidden" onClick={() => setDrawer(false)} aria-hidden />
          <div className="cn-drawer lg:hidden" role="dialog" aria-modal="true" aria-label={t("shell.menu")}>
            <button type="button" className="absolute top-3 end-3 p-2 text-muted hover:text-fg z-10" onClick={() => setDrawer(false)} aria-label={t("common.close")}>
              <IconBase d={I.close} />
            </button>
            <SidebarContent bundle={bundle} onNavigate={() => setDrawer(false)} onOpenLocation={openLocation} />
          </div>
        </>
      ) : null}

      <CommandPalette open={palette} onClose={() => setPalette(false)} bundle={bundle} index={index} pages={ALL_PAGES} />
      {bundle ? <LocationDialog bundle={bundle} open={locOpen} onClose={() => setLocOpen(false)} /> : null}
    </div>
  );
}
