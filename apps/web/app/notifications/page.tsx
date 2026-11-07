"use client";
import { useEffect, useState } from "react";
import { addDays, lt, postableGroups, zonedNow, type CampusBundle } from "@campusnav/core";
import { formatDate } from "@campusnav/i18n";
import { Gate } from "@/components/Gate";
import { Badge, Button, EmptyState, Notice, PageTitle, Section } from "@/components/ui";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";
import { getDataSource } from "@/lib/config";

/**
 * Notifications: announcements plus schedule changes affecting the user's group
 * in the next 14 days, and the lecture-reminder opt-in.
 */
export default function NotificationsPage() {
  const { t, prefs, setPrefs, reload } = useApp();
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
            <ClassPostForm bundle={bundle} />
            <Section title={t("home.announcements")}>
              {anns.length === 0 ? (
                <EmptyState title={t("notifications.empty")} />
              ) : (
                <ul className="space-y-4">
                  {anns.map((a) => (
                    <li key={a.id}>
                      <div className="flex items-center gap-2">
                        {a.priority === "important" ? <Badge tone="warn">!</Badge> : null}
                        {a.groupId ? <Badge tone="accent">{t("class.badge", { group: l.groups.get(a.groupId)?.code ?? "" })}</Badge> : null}
                        <p className="font-medium">{lt(a.title, loc)}</p>
                      </div>
                      <p className="text-sm text-muted mt-1">{lt(a.body, loc)}</p>
                      <p className="mono text-xs text-faint mt-1">
                        {formatDate(loc, a.publishedAt)}
                        {a.groupId && a.authorId && a.authorId === bundle.classRoles?.userId ? (
                          <button type="button" className="ms-3 underline text-muted" onClick={async () => { await (await getDataSource()).classes?.removeAnnouncement(a.id); reload(); }}>
                            {t("class.delete")}
                          </button>
                        ) : null}
                      </p>
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

/** Class reps and lecturers post a short notice to a class they represent or teach. */
function ClassPostForm({ bundle }: { bundle: CampusBundle }) {
  const { t, student, reload } = useApp();
  const groups = student.access.kind === "visitor" ? [] : postableGroups(bundle);
  const [group, setGroup] = useState(groups[0] ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "warn" | "accent"; text: string } | null>(null);
  if (!groups.length) return null;
  const code = (id: string) => bundle.groups.find((g) => g.id === id)?.code ?? id;
  const submit = async () => {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await (await getDataSource()).classes!.postToClass(bundle.university.id, group || groups[0]!, title, body);
      setTitle("");
      setBody("");
      setMsg({ tone: "accent", text: t("class.posted", { group: code(group || groups[0]!) }) });
      reload();
    } catch (e) {
      setMsg({ tone: "warn", text: t("material.err.failed", { message: e instanceof Error ? e.message : String(e) }) });
    } finally {
      setBusy(false);
    }
  };
  const input = "cn-input w-full min-h-11";
  return (
    <Section title={t("class.post")} className="mt-6">
      <form className="border border-line p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }} data-testid="class-post">
        {groups.length > 1 ? (
          <select className="w-full min-h-11 bg-surface border border-line-strong px-3" value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t("material.forClass")}>
            {groups.map((g) => <option key={g} value={g}>{code(g)}</option>)}
          </select>
        ) : (
          <p className="text-sm text-muted">{t("class.rep", { group: code(groups[0]!) })}</p>
        )}
        <input className={input} placeholder={t("class.postTitle")} aria-label={t("class.postTitle")} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={`${input} min-h-24`} placeholder={t("class.postBody")} aria-label={t("class.postBody")} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <Button variant="primary" type="submit" disabled={busy || !title.trim() || !body.trim()}>{t("class.postSend")}</Button>
      </form>
    </Section>
  );
}
