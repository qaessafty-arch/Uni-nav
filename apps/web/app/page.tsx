"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { currentAndNext, lt, relevantClosures, zonedNow } from "@campusnav/core";
import { formatCountdownText, formatDate } from "@campusnav/i18n";
import { ClosureList, FACILITIES, Panel } from "@/components/Blocks";
import { Gate } from "@/components/Gate";
import { SearchBox } from "@/components/SearchBox";
import { LectureCard } from "@/components/LectureCard";
import { Icon } from "@/components/Icon";
import { I } from "@/components/icons";
import { nodeName } from "@/components/LocationPicker";
import { Badge, ButtonLink, EmptyState, Row } from "@/components/ui";
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
        const hour = Math.floor(zonedNow(now, tz).minutes / 60);
        const greeting = hour < 12 ? t("home.greetingMorning") : hour < 18 ? t("home.greetingAfternoon") : t("home.greetingEvening");
        const available = new Set(bundle.rooms.map((r) => r.type));
        const savedRooms = saved.filter((id) => l.rooms.has(id));
        const closures = relevantClosures(bundle, now);

        return (
          <div className="space-y-6">
            {/* Hero: greeting, university, search */}
            <section className="cn-panel p-5 md:p-8 relative overflow-hidden">
              <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" aria-hidden />
              <div className="relative">
                <p className="text-sm text-muted">{greeting}</p>
                <h1 className="cn-display cn-display-lg mt-1">{lt(bundle.university.name, loc)}</h1>
                <p className="text-muted mt-2 mb-5">{t("home.whereTo")}</p>
                <div className="max-w-2xl">
                  <SearchBox bundle={bundle} index={index} />
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
                  {startNode ? (
                    <span className="inline-flex items-center gap-2 text-muted">
                      <span className="cn-dot bg-accent cn-pulse" aria-hidden />
                      {t("home.startingFrom", { place: nodeName(startNode, l, loc) })}
                    </span>
                  ) : (
                    <>
                      <span className="text-muted">{t("home.locationEmpty")}</span>
                      <ButtonLink href="/scan" variant="primary" className="!min-h-9">
                        <Icon d={I.scan} /> {t("nav.scan")}
                      </ButtonLink>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* Nearest facilities */}
            <section aria-labelledby="nearest-h">
              <h2 id="nearest-h" className="label-caps mb-3">
                {t("home.findNearest")}
              </h2>
              <div className="cn-scroll-x">
                {FACILITIES.filter((f) => available.has(f.type)).map((f) => (
                  <Link key={f.type} href={`/nearby?type=${f.type}`} className="cn-chip">
                    <Icon d={f.icon} className="size-4 text-accent" />
                    {t(`roomType.${f.type}`)}
                  </Link>
                ))}
              </div>
            </section>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Panel title={cn?.current ? t("home.currentLecture") : t("home.nextLecture")} action={<Link className="text-sm text-accent" href="/timetable">{t("nav.timetable")} <span className="inline-block rtl:rotate-180">→</span></Link>}>
                  {!prefs.groupId ? (
                    <EmptyState title={t("home.pickGroup")} action={<ButtonLink href="/timetable">{t("timetable.chooseGroup")}</ButtonLink>} />
                  ) : cn?.current || cn?.next ? (
                    <div className="space-y-2">
                      {cn.current ? <LectureCard bundle={bundle} occ={cn.current} emphasis countdown={cn.secondsUntilCurrentEnds != null ? t("home.endsIn", { time: formatCountdownText(loc, cn.secondsUntilCurrentEnds) }) : undefined} /> : null}
                      {cn.next ? <LectureCard bundle={bundle} occ={cn.next} emphasis={!cn.current} showDate countdown={cn.secondsUntilNext != null ? t("home.startsIn", { time: formatCountdownText(loc, cn.secondsUntilNext) }) : undefined} /> : null}
                    </div>
                  ) : (
                    <EmptyState title={t("home.noLectures")} />
                  )}
                </Panel>

                <Panel title={t("home.savedPlaces")} action={<Link className="text-sm text-accent" href="/saved">{t("nav.saved")} <span className="inline-block rtl:rotate-180">→</span></Link>}>
                  {savedRooms.length === 0 ? (
                    <p className="text-sm text-muted">{t("home.noSaved")}</p>
                  ) : (
                    savedRooms.slice(0, 5).map((id) => {
                      const r = l.rooms.get(id)!;
                      return <Row key={id} href={`/rooms/${id}`} title={`${r.code} · ${lt(r.name, loc)}`} subtitle={lt(l.buildings.get(r.buildingId)?.name, loc)} />;
                    })
                  )}
                  {prefs.keepHistory && history.length ? (
                    <div className="mt-4">
                      <div className="label-caps mb-1">{t("home.recent")}</div>
                      {history.slice(0, 3).map((h) => {
                        const r = l.rooms.get(h.to);
                        return r ? <Row key={h.at} href={`/navigate?to=${r.id}`} title={`${r.code} · ${lt(r.name, loc)}`} meta={<Badge>{t("common.navigate")}</Badge>} /> : null;
                      })}
                    </div>
                  ) : null}
                </Panel>
              </div>

              <div className="space-y-6">
                {closures.active.length || closures.upcoming.length ? (
                  <Panel title={t("home.closures")}>
                    <ClosureList bundle={bundle} now={now} />
                  </Panel>
                ) : null}
                <Panel title={t("home.announcements")}>
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
                </Panel>
                <Link href="/report" className="cn-panel flex items-center gap-3 p-4 hover:border-[var(--cn-accent)]">
                  <Icon d={I.flag} className="text-warn" />
                  <span className="text-sm font-medium flex-1">{t("report.link")}</span>
                  <span aria-hidden className="text-faint rtl:rotate-180">→</span>
                </Link>
              </div>
            </div>
          </div>
        );
      }}
    </Gate>
  );
}
