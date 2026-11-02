"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { visualStyleLabels, visualStyles, type VisualStyle } from "@campusnav/tokens";
import { lt, type Permission } from "@campusnav/core";
import { AdminProvider, adminMode, getAdminSource, useAdmin } from "@/lib/admin";
import { Badge, Button, Notice, Spinner, cx } from "./ui";
import { Logo } from "./Logo";

const NAV: { group: string; items: { href: string; label: string; perm?: Permission }[] }[] = [
  { group: "Overview", items: [{ href: "/", label: "Dashboard" }] },
  {
    group: "Campus",
    items: [
      { href: "/university", label: "University", perm: "university.update" },
      { href: "/campuses", label: "Campuses", perm: "campus.manage" },
      { href: "/buildings", label: "Buildings", perm: "building.manage" },
      { href: "/floors", label: "Floors", perm: "floor.manage" },
      { href: "/map-editor", label: "Map editor", perm: "map.edit" },
      { href: "/rooms", label: "Rooms", perm: "room.manage" },
      { href: "/checkpoints", label: "QR checkpoints", perm: "checkpoint.manage" },
    ],
  },
  {
    group: "Academic",
    items: [
      { href: "/departments", label: "Departments", perm: "department.manage" },
      { href: "/lecturers", label: "Lecturers", perm: "lecturer.manage" },
      { href: "/courses", label: "Courses", perm: "course.manage" },
      { href: "/groups", label: "Student groups", perm: "group.manage" },
      { href: "/semesters", label: "Semesters", perm: "timetable.manage" },
      { href: "/timetable", label: "Timetable", perm: "timetable.department_manage" },
      { href: "/schedule-changes", label: "Schedule changes", perm: "timetable.department_manage" },
      { href: "/announcements", label: "Announcements", perm: "announcement.manage" },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/users", label: "Users", perm: "member.invite" },
      { href: "/roles", label: "Roles & permissions" },
      { href: "/import-export", label: "Import / export", perm: "data.export" },
      { href: "/audit", label: "Audit log", perm: "audit.read" },
      { href: "/settings", label: "Settings", perm: "university.settings" },
    ],
  },
];

const STYLE_KEY = "campusnav.admin.style";

/** UI-only visual style preference for the admin dashboard (browser-local). */
function useVisualStyle(): [VisualStyle, (s: VisualStyle) => void] {
  const [style, setStyle] = useState<VisualStyle>("editorial");
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
  const [open, setOpen] = useState(false);
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
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <aside className={cx("cn-sidebar no-print md:block md:sticky md:top-0 md:h-dvh overflow-y-auto", open ? "block" : "hidden")}>
        <div className="flex items-center gap-2 px-4 h-16 border-b border-line">
          <Logo />
          <span className="mono font-semibold tracking-wider text-sm">CAMPUS NAV</span>
          <Badge className="ms-auto">ADMIN</Badge>
        </div>
        <div className="p-4 border-b border-line">
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
        <nav className="p-2" aria-label="Admin">
          {NAV.map((g) => {
            const items = g.items.filter((i) => !i.perm || can(i.perm));
            if (!items.length) return null;
            return (
              <div key={g.group} className="mb-3">
                <div className="label-caps px-2 py-1">{g.group}</div>
                {items.map((i) => {
                  const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
                  return (
                    <Link key={i.href} href={i.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className="cn-sidelink block px-3 py-2 text-sm">
                      {i.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="p-4 border-t border-line">
          <StylePicker />
        </div>
        <div className="p-4 border-t border-line text-xs text-muted">
          <div className="truncate mono">{session.email}</div>
          <button className="underline mt-2" onClick={() => void signOut()}>Sign out</button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="cn-header no-print md:hidden flex items-center h-14 px-4">
          <button className="min-h-11 px-2 border border-line-strong" onClick={() => setOpen(!open)} aria-expanded={open}>Menu</button>
          <span className="ms-3 mono text-sm">{uni ? lt(uni.name, "en") : ""}</span>
        </header>
        {adminMode === "sandbox" ? (
          <div className="cn-strip no-print px-6 md:px-10 py-1.5 text-xs text-warn mono">LOCAL SANDBOX — browser-only demo data, no authentication, nothing leaves this device.</div>
        ) : null}
        <main className="cn-sections p-4 md:p-10 max-w-7xl">{children}</main>
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
