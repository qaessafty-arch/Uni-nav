"use client";
import { useEffect, useState } from "react";
import { addDays, lt, zonedNow } from "@campusnav/core";
import { formatDate } from "@campusnav/i18n";
import { Gate } from "@/components/Gate";
import { Badge, Button, EmptyState, Notice, PageTitle, Section } from "@/components/ui";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";

/**
 * Notifications: announcements plus schedule changes affecting the user's group
 * in the next 14 days, and the lecture-reminder opt-in.
 */
export default function NotificationsPage() {
  const { t, prefs, setPrefs } = useApp();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const enable = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    setPrefs({ reminders: p === "granted" });
  };

  return (
    <Gate>
      {(bundle) => {
        const loc = prefs.locale;
        const l = lookup(bundle);
        const today = zonedNow(new Date(), bundle.university.settings.timezone).date;
        const horizon = addDays(today, 14);
        const groupEntryIds = new Set(bundle.timetable.filter((e) => e.groupId && e.groupId === prefs.groupId).map((e) => e.id));
        const changes = bundle.scheduleChanges.filter((c) => c.date >= today && c.date <= horizon && (!prefs.groupId || groupEntryIds.has(c.entryId))).sort((a, b) => a.date.localeCompare(b.date));
        const anns = bundle.announcements.filter((a) => !a.expiresAt || Date.parse(a.expiresAt) > Date.now()).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
        return (
          <div className="max-w-2xl">
            <PageTitle>{t("notifications.title")}</PageTitle>
            <div className="border border-line p-4 flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium">{t("notifications.enable")}</span>
              {perm === "granted" ? (
                <Button onClick={() => setPrefs({ reminders: !prefs.reminders })} aria-pressed={prefs.reminders}>
                  {prefs.reminders ? t("common.yes") : t("common.no")}
                </Button>
              ) : perm === "denied" ? (
                <Notice tone="warn">{t("notifications.denied")}</Notice>
              ) : perm === "unsupported" ? (
                <Badge>{t("common.notAvailable")}</Badge>
              ) : (
                <Button variant="primary" onClick={enable}>
                  {t("common.confirm")}
                </Button>
              )}
            </div>
            <Section title={t("timetable.title")} className="mt-6">
              {changes.length === 0 ? (
                <EmptyState title={t("notifications.empty")} />
              ) : (
                <ul className="space-y-2">
                  {changes.map((c) => {
                    const entry = bundle.timetable.find((e) => e.id === c.entryId);
                    const course = entry ? l.courses.get(entry.courseId) : undefined;
                    return (
                      <li key={c.id} className="border-s-2 border-warn ps-3 py-1">
                        <p className="font-medium text-sm">{t("notifications.change", { course: lt(course?.name, loc) })}</p>
                        <p className="text-sm text-muted">
                          {formatDate(loc, c.date)} · {c.type === "cancelled" ? t("timetable.cancelled") : c.type === "room_change" ? `${t("common.room")} ${l.rooms.get(c.newRoomId ?? "")?.code ?? ""}` : c.type === "lecturer_change" ? t("timetable.lecturerChanged") : `${c.newStartTime}–${c.newEndTime}`}
                        </p>
                        {c.note ? <p className="text-xs text-muted mt-1">{lt(c.note, loc)}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
            <Section title={t("home.announcements")}>
              {anns.length === 0 ? (
                <EmptyState title={t("notifications.empty")} />
              ) : (
                <ul className="space-y-4">
                  {anns.map((a) => (
                    <li key={a.id}>
                      <div className="flex items-center gap-2">
                        {a.priority === "important" ? <Badge tone="warn">!</Badge> : null}
                        <p className="font-medium">{lt(a.title, loc)}</p>
                      </div>
                      <p className="text-sm text-muted mt-1">{lt(a.body, loc)}</p>
                      <p className="mono text-xs text-faint mt-1">{formatDate(loc, a.publishedAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        );
      }}
    </Gate>
  );
}
