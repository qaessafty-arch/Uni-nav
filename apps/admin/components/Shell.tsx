"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { visualStyleLabels, visualStyles, type VisualStyle } from "@campusnav/tokens";
import { lt, type Permission } from "@campusnav/core";
import { AdminProvider, adminMode, getAdminSource, useAdmin, useTable } from "@/lib/admin";
import { Badge, Button, Notice, Spinner, cx } from "./ui";
import { Logo } from "./Logo";

const IC = {
  dash: "M4 13h7V4H4zM13 20h7v-9h-7zM13 4v5h7V4zM4 20h7v-5H4z",
  uni: "M3 10 12 4l9 6M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18",
  campus: "M3 20h18M5 20V9l7-5 7 5v11",
  building: "M4 21V5l8-3 8 3v16M9 21v-5h6v5M8 8h2M14 8h2M8 12h2M14 12h2",
  map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
  layers: "M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5",
  pen: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  door: "M6 21V3h12v18M3 21h18M14 12v.5",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z",
  dept: "M12 3 3 8h18zM5 10v8M10 10v8M14 10v8M19 10v8M3 21h18",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  book: "M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6M20 4v14h-6",
  group: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 11a3 3 0 1 0 0-6M3 20a6 6 0 0 1 12 0M15 14a6 6 0 0 1 6 6",
  cal: "M4 5h16v15H4zM4 9h16M9 3v4M15 3v4",
  change: "M4 7h13l-3-3M20 17H7l3 3",
  megaphone: "M3 11v2l13 5V6zM16 9a3 3 0 0 1 0 6M7 14l1 5h3l-1-4",
  flag: "M5 21V4h11l-1.5 4L16 12H5",
  block: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8",
  users: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
  swap: "M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.5M3 12h.5M3 18h.5",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.3L17 5l-3-1-1 2h-2L10 4 7 5l.3 2L6 8.2 4 8 3 11l2 1-2 1 1 3 2-.2 1.3 1.3L7 19l3 1 1-2h2l1 2 3-1-.3-2 1.3-1.3 2 .3 1-3z",
  search: "M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM15 15l5 5",
  menu: "M4 6h16M4 12h16M4 18h16",
  plus: "M12 5v14M5 12h14",
} as const;

export function Ico({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-[18px] shrink-0", className)} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

type NavItem = { href: string; label: string; icon: string; perm?: Permission; count?: "reports" };
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: IC.dash },
      { href: "/reports", label: "Problem reports", icon: IC.flag, perm: "report.manage", count: "reports" },
      { href: "/closures", label: "Closures", icon: IC.block, perm: "map.edit" },
    ],
  },
  {
    group: "Campus & maps",
    items: [
      { href: "/university", label: "University", icon: IC.uni, perm: "university.update" },
      { href: "/campuses", label: "Campuses", icon: IC.campus, perm: "campus.manage" },
      { href: "/real-map", label: "Real map", icon: IC.map, perm: "building.manage" },
      { href: "/campus-map", label: "Campus picture", icon: IC.layers, perm: "building.manage" },
      { href: "/buildings", label: "Buildings", icon: IC.building, perm: "building.manage" },
      { href: "/floors", label: "Floors", icon: IC.layers, perm: "floor.manage" },
      { href: "/map-editor", label: "Map editor", icon: IC.pen, perm: "map.edit" },
      { href: "/rooms", label: "Rooms", icon: IC.door, perm: "room.manage" },
      { href: "/checkpoints", label: "QR checkpoints", icon: IC.qr, perm: "checkpoint.manage" },
      { href: "/verification", label: "Verification & publishing", icon: IC.shield, perm: "building.manage" },
    ],
  },
  {
    group: "Academic",
    items: [
      { href: "/departments", label: "Departments", icon: IC.dept, perm: "department.manage" },
      { href: "/lecturers", label: "Lecturers", icon: IC.person, perm: "lecturer.manage" },
      { href: "/courses", label: "Courses", icon: IC.book, perm: "course.manage" },
      { href: "/groups", label: "Student groups", icon: IC.group, perm: "group.manage" },
      { href: "/semesters", label: "Semesters", icon: IC.cal, perm: "timetable.manage" },
      { href: "/timetable", label: "Timetable", icon: IC.cal, perm: "timetable.department_manage" },
      { href: "/schedule-changes", label: "Schedule changes", icon: IC.change, perm: "timetable.department_manage" },
      { href: "/announcements", label: "Announcements", icon: IC.megaphone, perm: "announcement.manage" },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/users", label: "Users", icon: IC.users, perm: "member.invite" },
      { href: "/roles", label: "Roles & permissions", icon: IC.shield },
      { href: "/import-export", label: "Import / export", icon: IC.swap, perm: "data.export" },
      { href: "/audit", label: "Audit log", icon: IC.list, perm: "audit.read" },
      { href: "/settings", label: "Settings", icon: IC.gear, perm: "university.settings" },
    ],
  },
];

const QUICK: { href: string; label: string; perm: Permission }[] = [
  { href: "/rooms", label: "Add a room", perm: "room.manage" },
  { href: "/closures", label: "Close a path or room", perm: "map.edit" },
  { href: "/map-editor", label: "Edit a floor map", perm: "map.edit" },
  { href: "/campus-map", label: "Place buildings on the campus map", perm: "building.manage" },
  { href: "/checkpoints", label: "Create a QR checkpoint", perm: "checkpoint.manage" },
  { href: "/announcements", label: "Post an announcement", perm: "announcement.manage" },
];

const STYLE_KEY = "campusnav.admin.style";

/** UI-only visual style preference for the admin dashboard (browser-local). */
function useVisualStyle(): [VisualStyle, (s: VisualStyle) => void] {
  const [style, setStyle] = useState<VisualStyle>("minimal");
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STYLE_KEY) as VisualStyle | null;
      if (v && visualStyles.includes(v)) setStyle(v);
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.style = style;
  }, [style]);
  return [
    style,
    (s) => {
      setStyle(s);
      try {
        window.localStorage.setItem(STYLE_KEY, s);
      } catch {
        /* ignore */
      }
    },
  ];
}

function StylePicker() {
  const [style, setStyle] = useVisualStyle();
  return (
    <div>
      <div className="label-caps mb-1.5">Visual style</div>
      <div className="cn-seg w-full" role="radiogroup" aria-label="Visual style">
        {visualStyles.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={style === k} title={visualStyleLabels[k]} onClick={() => setStyle(k)} className="flex-1 !px-1 !min-h-9 text-[11px] mono uppercase">
            {k === "minimal" ? "Min" : k === "editorial" ? "Edit" : "Brut"}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-faint mt-1 mono">{visualStyleLabels[style]}</div>
    </div>
  );
}

function Login() {
  const { refreshSession } = useAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-dvh grid place-items-center px-4 grid-bg">
      <div className="cn-card w-full max-w-sm !bg-bg p-7">
        <div className="flex items-center gap-2 mb-6">
          <Logo />
          <span className="mono font-semibold tracking-wider">CAMPUS NAV</span>
          <Badge className="ms-auto">ADMIN</Badge>
        </div>
        {adminMode === "sandbox" ? (
          <>
            <h1 className="cn-display cn-display-md">Local sandbox</h1>
            <div className="mt-3">
              <Notice tone="warn">
                No Supabase project is configured. The sandbox runs entirely in this browser on fictional demo data, with no real authentication. Nothing is sent to any server.
              </Notice>
            </div>
            <Button
              variant="primary"
              className="w-full mt-5"
              onClick={async () => {
                await getAdminSource().signIn("", "");
                await refreshSession();
              }}
            >
              Open local sandbox
            </Button>
            <p className="text-xs text-muted mt-4">To use real data, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see docs/DEPLOYMENT.md).</p>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              const res = await getAdminSource().signIn(email.trim(), password);
              setBusy(false);
              if (!res.ok) setError("Sign-in failed. Check your email and password.");
              else await refreshSession();
            }}
          >
            <h1 className="cn-display cn-display-md">Staff sign-in</h1>
            <label className="block mt-5 text-sm" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="cn-input w-full mt-1" />
            <label className="block mt-4 text-sm" htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="cn-input w-full mt-1" />
            {error ? <p role="alert" className="text-danger text-sm mt-3">{error}</p> : null}
            <Button type="submit" variant="primary" className="w-full mt-5" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-xs text-muted mt-4">Accounts are created by a university owner or the platform owner. There is no public sign-up for staff.</p>
          </form>
        )}
      </div>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { ready, session, universities, universityId, setUniversityId, role, can, signOut } = useAdmin();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quick, setQuick] = useState(false);
  const [jump, setJump] = useState("");
  const jumpRef = useRef<HTMLInputElement>(null);
  const reports = useTable<{ status: string }>("problem_reports");
  const openReports = can("report.manage") ? (reports.rows ?? []).filter((r) => r.status === "open").length : 0;
  useEffect(() => {
    setOpen(false);
    setQuick(false);
  }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        jumpRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!ready) return <Spinner label="Loading…" />;
  if (adminMode === "misconfigured")
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <div className="max-w-md">
          <h1 className="text-xl font-bold">Admin backend not configured</h1>
          <p className="text-muted text-sm mt-2">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY and rebuild. The local sandbox is disabled in production builds unless NEXT_PUBLIC_ALLOW_SANDBOX=true.</p>
        </div>
      </div>
    );
  if (!session) return <Login />;
  if (!universityId) {
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <div className="max-w-md text-center">
          <p className="font-semibold">Your account has no university membership yet.</p>
          <p className="text-muted text-sm mt-2">Ask a university owner to add you, then sign in again.</p>
          <Button className="mt-4" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </div>
    );
  }
  const uni = universities.find((u) => u.id === universityId);
  const visible = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(i.perm)) })).filter((g) => g.items.length);
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  const current = visible.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group }))).filter((i) => isActive(i.href)).sort((x, y) => y.href.length - x.href.length)[0];
  const sidebar = (
    <>
      <div className="flex items-center gap-2 px-4 h-16 border-b border-line shrink-0">
        <Logo />
        <span className="mono font-semibold tracking-wider text-sm">CAMPUS NAV</span>
        <Badge className="ms-auto">ADMIN</Badge>
      </div>
      <div className="p-3 border-b border-line">
        <label className="label-caps" htmlFor="uni">University</label>
        <select id="uni" value={universityId} onChange={(e) => setUniversityId(e.target.value)} className="cn-input w-full mt-1 !min-h-10 text-sm">
          {universities.map((u) => (
            <option key={u.id} value={u.id}>{lt(u.name, "en")}</option>
          ))}
        </select>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Badge tone="info">{role?.replace("_", " ")}</Badge>
          {uni?.dataStatus === "demo" ? <Badge tone="warn">DEMO DATA</Badge> : null}
        </div>
      </div>
      <nav className="flex-1" aria-label="Admin">
        {visible.map((g) => (
          <div key={g.group} className="cn-side-group">
            <div className="cn-side-label">{g.group}</div>
            <ul className="space-y-0.5">
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} onClick={() => setOpen(false)} aria-current={isActive(i.href) ? "page" : undefined} className="cn-navitem !min-h-9">
                    <Ico d={i.icon} />
                    <span className="truncate">{i.label}</span>
                    {i.count === "reports" && openReports ? <span className="cn-count" aria-label={`${openReports} open`}>{openReports}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-line">
        <StylePicker />
      </div>
      <div className="p-4 border-t border-line text-xs text-muted">
        <div className="truncate mono">{session.email}</div>
        <button className="underline mt-2" onClick={() => void signOut()}>Sign out</button>
      </div>
    </>
  );
  const jumpHits = jump.trim() ? visible.flatMap((g) => g.items).filter((i) => i.label.toLowerCase().includes(jump.trim().toLowerCase())).slice(0, 8) : [];
  return (
    <div className="cn-app">
      <aside className="cn-rail no-print hidden lg:flex">{sidebar}</aside>
      {open ? (
        <>
          <div className="cn-overlay lg:hidden" onClick={() => setOpen(false)} aria-hidden />
          <aside className="cn-drawer lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">{sidebar}</aside>
        </>
      ) : null}
      <div className="min-w-0 flex flex-col">
        <header className="cn-topbar no-print">
          <div className="flex items-center gap-3 px-4 md:px-8 h-16">
            <button className="lg:hidden p-2 -ms-2 text-muted hover:text-fg" onClick={() => setOpen(true)} aria-label="Menu" aria-expanded={open}>
              <Ico d={IC.menu} className="size-5" />
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0 hidden sm:block">
              <ol className="flex items-center gap-2 text-sm">
                <li className="text-muted truncate">{uni ? lt(uni.name, "en") : ""}</li>
                {current ? (
                  <>
                    <li aria-hidden className="text-faint">/</li>
                    <li className="text-muted hidden md:block">{current.group}</li>
                    <li aria-hidden className="text-faint hidden md:block">/</li>
                    <li className="font-semibold truncate" aria-current="page">{current.label}</li>
                  </>
                ) : null}
              </ol>
            </nav>
            <div className="relative ms-auto w-full max-w-xs">
              <label htmlFor="jump" className="sr-only">Jump to page</label>
              <div className="cn-searchtrigger !min-h-10">
                <Ico d={IC.search} />
                <input
                  id="jump"
                  ref={jumpRef}
                  value={jump}
                  onChange={(e) => setJump(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && jumpHits[0]) {
                      router.push(jumpHits[0].href);
                      setJump("");
                    } else if (e.key === "Escape") setJump("");
                  }}
                  placeholder="Jump to…"
                  className="bg-transparent outline-none flex-1 min-w-0 text-sm"
                  autoComplete="off"
                />
                <span className="cn-kbd hidden md:inline">Ctrl K</span>
              </div>
              {jumpHits.length ? (
                <ul className="absolute z-40 mt-1 w-full cn-panel overflow-hidden py-1" role="listbox" aria-label="Pages">
                  {jumpHits.map((h) => (
                    <li key={h.href} role="option" aria-selected={false}>
                      <Link href={h.href} onClick={() => setJump("")} className="cn-option !min-h-10 text-sm hover:bg-[var(--cn-surface-raised)]">
                        <Ico d={h.icon} className="text-muted" /> {h.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="relative">
              <Button variant="primary" className="!min-h-10" onClick={() => setQuick(!quick)} aria-expanded={quick} aria-haspopup="menu">
                <Ico d={IC.plus} /> <span className="hidden sm:inline">Quick action</span>
              </Button>
              {quick ? (
                <ul role="menu" className="absolute end-0 z-40 mt-1 w-72 cn-panel overflow-hidden py-1">
                  {QUICK.filter((q) => can(q.perm)).map((q) => (
                    <li key={q.href + q.label} role="none">
                      <Link role="menuitem" href={q.href} onClick={() => setQuick(false)} className="cn-option !min-h-10 text-sm hover:bg-[var(--cn-surface-raised)]">
                        {q.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          {adminMode === "sandbox" ? (
            <div className="cn-strip px-4 md:px-8 py-1.5 text-xs text-warn mono">LOCAL SANDBOX — browser-only demo data, no authentication, nothing leaves this device.</div>
          ) : null}
        </header>
        <main className="cn-sections p-4 md:p-8 lg:p-10 w-full max-w-7xl">{children}</main>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <Frame>{children}</Frame>
    </AdminProvider>
  );
}
