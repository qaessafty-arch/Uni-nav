"use client";
import { useEffect } from "react";
import { currentAndNext, lt } from "@campusnav/core";
import { formatClock } from "@campusnav/i18n";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";

const LEAD_MINUTES = 10;

/**
 * Browser lecture reminders. Without a push server these fire only while the
 * app is open (tab or installed PWA). The native app schedules OS-level local
 * notifications instead. Uses the Notification API only after explicit opt-in.
 */
export function ReminderScheduler() {
  const { prefs, bundleState, t } = useApp();
  useEffect(() => {
    if (!prefs.reminders || !prefs.groupId || bundleState.status !== "ready") return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const b = bundleState.bundle;
    const { next, secondsUntilNext } = currentAndNext(new Date(), b.university.settings.timezone, b.timetable, b.scheduleChanges, { groupId: prefs.groupId });
    if (!next || secondsUntilNext == null) return;
    const delayMs = (secondsUntilNext - LEAD_MINUTES * 60) * 1000;
    if (delayMs < 0 || delayMs > 24 * 3600 * 1000) return;
    const l = lookup(b);
    const timer = window.setTimeout(() => {
      const course = lt(l.courses.get(next.courseId)?.name, prefs.locale);
      const room = next.roomId ? l.rooms.get(next.roomId)?.code ?? "" : "";
      try {
        new Notification(t("home.nextLecture"), { body: t("notifications.reminder", { course, time: formatClock(prefs.locale, next.startTime), room }), tag: `lecture-${next.entryId}-${next.date}` });
      } catch {
        /* some browsers require a service worker for notifications */
      }
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [prefs.reminders, prefs.groupId, prefs.locale, bundleState, t]);
  return null;
}
