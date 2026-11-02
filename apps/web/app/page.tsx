"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { currentAndNext, lt } from "@campusnav/core";
import { formatCountdownText, formatDate } from "@campusnav/i18n";
import { Gate } from "@/components/Gate";
import { SearchBox } from "@/components/SearchBox";
import { LectureCard } from "@/components/LectureCard";
import { Icon } from "@/components/AppShell";
import { Badge, EmptyState, Row, Section } from "@/components/ui";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function HomePage() {
  const { t, prefs, saved, history, start } = useApp();
  const now = useNow();
  return (
    <Gate>
      {(bundle, index) => {
        const l = lookup(bundle);
        const loc = prefs.locale;
        const tz = bundle.university.settings.timezone;
        const cn = prefs.groupId ? currentAndNext(now, tz, bundle.timetable, bundle.scheduleChanges, { groupId: prefs.groupId }) : null;
        const announcements = bundle.announcements
          .filter((a) => !a.expiresAt || Date.parse(a.expiresAt) > now.getTime())
          .sort((a, b) => (a.priority === b.priority ? b.publishedAt.localeCompare(a.publishedAt) : a.priority === "important" ? -1 : 1));
        const startNode = start ? l.nodes.get(start.nodeId) : undefined;

        return (
          <div className="grid lg:grid-cols-[1fr_340px] gap-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{lt(bundle.university.name, loc)}</h1>
              <p className="text-muted mt-1 mb-5">{t("splash.tagline")}</p>
              <SearchBox bundle={bundle} index={index} />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                {[
                  { href: "/scan", label: t("nav.scan"), d: "M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4zM15 15h5v5h-5z" },
                  { href: "/map", label: t("map.campus"), d: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" },
                  { href: "/lecturers", label: t("nav.lecturers"), d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
                  { href: "/timetable", label: t("nav.timetable"), d: "M4 5h16v15H4zM4 9h16" },
                ].map((q) => (
                  <Link key={q.href} href={q.href} className="border border-line hover:border-accent bg-surface p-3 min-h-20 flex flex-col justify-between">
                    <Icon d={q.d} className="text-accent" />
                    <span className="text-sm font-medium">{q.label}</span>
                  </Link>
                ))}
              </div>

              {startNode ? (
                <p className="mt-4 text-sm text-muted">
                  <span className="label-caps me-2">{t("map.youAreHere")}</span>
                  {lt(startNode.label, loc) || lt(l.floors.get(startNode.floorId)?.name, loc)}
                </p>
              ) : null}

              <Section title={cn?.current ? t("home.currentLecture") : t("home.nextLecture")} className="mt-8">
                {!prefs.groupId ? (
                  <EmptyState title={t("home.pickGroup")} action={<Link className="text-accent underline" href="/timetable">{t("timetable.chooseGroup")}</Link>} />
                ) : cn?.current || cn?.next ? (
                  <div className="space-y-2">
                    {cn.current ? <LectureCard bundle={bundle} occ={cn.current} emphasis countdown={cn.secondsUntilCurrentEnds != null ? t("home.endsIn", { time: formatCountdownText(loc, cn.secondsUntilCurrentEnds) }) : undefined} /> : null}
                    {cn.next ? <LectureCard bundle={bundle} occ={cn.next} emphasis={!cn.current} showDate countdown={cn.secondsUntilNext != null ? t("home.startsIn", { time: formatCountdownText(loc, cn.secondsUntilNext) }) : undefined} /> : null}
                  </div>
                ) : (
                  <EmptyState title={t("home.noLectures")} />
                )}
              </Section>
            </div>

            <aside>
              <Section title={t("home.announcements")}>
                {announcements.length === 0 ? (
                  <p className="text-sm text-muted">{t("notifications.empty")}</p>
                ) : (
                  <ul className="space-y-3">
                    {announcements.slice(0, 4).map((a) => (
                      <li key={a.id} className={`border-s-2 ps-3 ${a.priority === "important" ? "border-warn" : "border-line-strong"}`}>
                        <p className="font-medium text-sm">{lt(a.title, loc)}</p>
                        <p className="text-sm text-muted mt-0.5">{lt(a.body, loc)}</p>
                        <p className="mono text-[11px] text-faint mt-1">{formatDate(loc, a.publishedAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              <Section title={t("home.savedPlaces")}>
                {saved.filter((id) => l.rooms.has(id)).length === 0 ? (
                  <p className="text-sm text-muted">{t("home.noSaved")}</p>
                ) : (
                  saved
                    .filter((id) => l.rooms.has(id))
                    .slice(0, 6)
                    .map((id) => {
                      const r = l.rooms.get(id)!;
                      return <Row key={id} href={`/rooms/${id}`} title={`${r.code} · ${lt(r.name, loc)}`} subtitle={lt(l.buildings.get(r.buildingId)?.name, loc)} />;
                    })
                )}
              </Section>
              {prefs.keepHistory && history.length ? (
                <Section title={t("home.recent")}>
                  {history.slice(0, 5).map((h) => {
                    const r = l.rooms.get(h.to);
                    return r ? <Row key={h.at} href={`/navigate?to=${r.id}`} title={`${r.code} · ${lt(r.name, loc)}`} meta={<Badge>{t("common.navigate")}</Badge>} /> : null;
                  })}
                </Section>
              ) : null}
            </aside>
          </div>
        );
      }}
    </Gate>
  );
}
