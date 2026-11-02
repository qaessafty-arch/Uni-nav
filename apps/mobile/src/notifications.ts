import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { addDays, lt, occurrencesOn, zonedNow, zonedToInstant, type CampusBundle, type Locale } from "@campusnav/core";
import { formatClock, translate } from "@campusnav/i18n";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Ask for notification permission only after the user opts in. */
export async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

const LEAD_MIN = 10;
const HORIZON_DAYS = 7;

/**
 * Schedule OS-level local reminders for the next 7 days of the user's group
 * timetable (works offline, no push server). Re-run whenever the bundle,
 * group or language changes; previous reminders are replaced.
 */
export async function scheduleLectureReminders(bundle: CampusBundle, groupId: string, locale: Locale): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("lectures", { name: translate(locale, "notifications.title"), importance: Notifications.AndroidImportance.DEFAULT });
  }
  const tz = bundle.university.settings.timezone;
  const today = zonedNow(new Date(), tz).date;
  const now = Date.now();
  let count = 0;
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const date = addDays(today, i);
    for (const o of occurrencesOn(date, bundle.timetable, bundle.scheduleChanges, { groupId })) {
      if (o.cancelled) continue;
      const at = zonedToInstant(date, o.startTime, tz).getTime() - LEAD_MIN * 60_000;
      if (at <= now) continue;
      const course = lt(bundle.courses.find((x) => x.id === o.courseId)?.name, locale);
      const room = bundle.rooms.find((r) => r.id === o.roomId)?.code ?? "";
      await Notifications.scheduleNotificationAsync({
        content: { title: translate(locale, "home.nextLecture"), body: translate(locale, "notifications.reminder", { course, time: formatClock(locale, o.startTime), room }), data: { url: o.roomId ? `/navigate?to=${o.roomId}` : "/" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: "lectures" },
      });
      count++;
    }
  }
  return count;
}

/**
 * Remote push token for schedule-change pushes. Requires an EAS project id
 * (EAS_PROJECT_ID) and a server-side sender (see docs/MOBILE.md). Returns null
 * when not configured — the app then relies on local reminders only.
 */
export async function getPushToken(): Promise<string | null> {
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return null;
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}
