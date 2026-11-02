"use client";
import { useMemo, useState } from "react";
import {
  conflictsWith,
  detectConflicts,
  lt,
  parseCsv,
  previewTimetableImport,
  timetableEntrySchema,
  timetableTemplateCsv,
  toCsv,
  TIMETABLE_COLUMNS,
  type Conflict,
  type ImportPreview,
  type TimetableEntry,
  type Weekday,
} from "@campusnav/core";
import { errorMessage, getAdminSource, newId, useAdmin } from "@/lib/admin";
import { useAdminBundle } from "@/lib/bundle";
import { Field, inputCls } from "@/components/Form";
import { Badge, Button, EmptyState, ErrorState, Notice, PageTitle, Section, Spinner, cx } from "@/components/ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function download(name: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿" + content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export default function TimetableAdminPage() {
  const { universityId, can, bump, toast } = useAdmin();
  const { data, error } = useAdminBundle();
  const [filter, setFilter] = useState<{ group: string; room: string; lecturer: string }>({ group: "", room: "", lecturer: "" });
  const [editing, setEditing] = useState<TimetableEntry | null>(null);
  const [ack, setAck] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importAck, setImportAck] = useState(false);
  const [busy, setBusy] = useState(false);

  const b = data?.bundle;
  const maps = useMemo(() => {
    if (!b) return null;
    return {
      courses: new Map(b.courses.map((x) => [x.id, x])),
      rooms: new Map(b.rooms.map((x) => [x.id, x])),
      lecturers: new Map(b.lecturers.map((x) => [x.id, x])),
      groups: new Map(b.groups.map((x) => [x.id, x])),
      buildings: new Map(b.buildings.map((x) => [x.id, x])),
    };
  }, [b]);

  if (error) return <ErrorState title="Could not load" body={error} />;
  if (!b || !maps || !universityId) return <Spinner label="Loading…" />;
  const fullAccess = can("timetable.manage");
  const allConflicts = detectConflicts(b.timetable);
  const conflictIds = new Set(allConflicts.flatMap((c) => [c.a, c.b]));
  const entries = b.timetable
    .filter((e) => (!filter.group || e.groupId === filter.group) && (!filter.room || e.roomId === filter.room) && (!filter.lecturer || e.lecturerId === filter.lecturer))
    .sort((x, y) => x.day - y.day || x.startTime.localeCompare(y.startTime));

  const describe = (c: Conflict) => {
    const other = c.a === editing?.id ? c.b : c.a;
    const o = b.timetable.find((e) => e.id === other);
    const course = o ? maps.courses.get(o.courseId) : undefined;
    const resource = c.kind === "room" ? maps.rooms.get(c.resourceId)?.code : c.kind === "lecturer" ? lt(maps.lecturers.get(c.resourceId)?.fullName, "en") : maps.groups.get(c.resourceId)?.code;
    return `${c.kind} ${resource ?? ""} already booked: ${course?.code ?? "?"} ${o?.startTime}–${o?.endTime} (from ${c.firstDate})`;
  };

  const editConflicts = editing ? conflictsWith(editing, b.timetable) : [];

  const save = async () => {
    if (!editing) return;
    const parsed = timetableEntrySchema.safeParse(editing);
    if (!parsed.success) return setFormErr(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message.replace(/_/g, " ")}`).join("\n"));
    if (editConflicts.length && !ack) return setFormErr("This entry conflicts with existing bookings. Review them and confirm to save anyway.");
    setBusy(true);
    try {
      await getAdminSource().upsert("timetable_entries", parsed.data as TimetableEntry);
      toast("Timetable entry saved");
      setEditing(null);
      bump();
    } catch (e) {
      setFormErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast("File too large (max 5 MB)", "error");
    if (!/\.(csv|txt)$/i.test(file.name)) return toast("Upload a .csv file. In Excel use File → Save As → CSV UTF-8.", "error");
    const rows = parseCsv(await file.text());
    setImportAck(false);
    setPreview(previewTimetableImport(rows, { universityId, courses: b.courses, groups: b.groups, lecturers: b.lecturers, buildings: b.buildings, rooms: b.rooms, existing: b.timetable, newId }));
  };

  const commitImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const n = await getAdminSource().upsertMany("timetable_entries", preview.entries.map(({ sourceRow: _s, ...e }) => e));
      toast(`Imported ${n} timetable entries`);
      setPreview(null);
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const rows = [TIMETABLE_COLUMNS as unknown as string[]];
    for (const e of b.timetable) {
      const room = e.roomId ? maps.rooms.get(e.roomId) : undefined;
      rows.push([
        maps.courses.get(e.courseId)?.code ?? "",
        e.groupId ? maps.groups.get(e.groupId)?.code ?? "" : "",
        e.lecturerId ? lt(maps.lecturers.get(e.lecturerId)?.fullName, "en") : "",
        room ? maps.buildings.get(room.buildingId)?.code ?? "" : "",
        room?.code ?? "",
        DAYS[e.day]!,
        e.startTime,
        e.endTime,
        e.validFrom,
        e.validTo,
        e.kind ?? "lecture",
        e.recurrence,
      ]);
    }
    download(`timetable-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  return (
    <div>
      <PageTitle
        eyebrow={`${b.timetable.length} entries · times in ${b.university.settings.timezone}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportCsv}>Export CSV</Button>
            <Button
              variant="primary"
              onClick={() => {
                setAck(false);
                setFormErr(null);
                setEditing({ id: newId(), universityId, courseId: "", recurrence: "weekly", day: 0, startTime: "08:30", endTime: "10:00", validFrom: b.semesters[0]?.startDate ?? new Date().toISOString().slice(0, 10), validTo: b.semesters[0]?.endDate ?? new Date().toISOString().slice(0, 10), status: "scheduled", kind: "lecture", semesterId: b.semesters[0]?.id ?? null, groupId: null, roomId: null, lecturerId: null });
              }}
            >
              + New entry
            </Button>
          </div>
        }
      >
        Timetable
      </PageTitle>
      {!fullAccess ? <div className="mb-4"><Notice>You can edit entries for courses in your department only.</Notice></div> : null}
      {allConflicts.length ? <div className="mb-4"><Notice tone="warn">{allConflicts.length} existing conflict(s). Conflicting rows are marked below.</Notice></div> : null}

      <div className="grid sm:grid-cols-3 gap-2 mb-4">
        <select aria-label="Filter by group" className={inputCls} value={filter.group} onChange={(e) => setFilter({ ...filter, group: e.target.value })}>
          <option value="">All groups</option>
          {b.groups.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}
        </select>
        <select aria-label="Filter by room" className={inputCls} value={filter.room} onChange={(e) => setFilter({ ...filter, room: e.target.value })}>
          <option value="">All rooms</option>
          {b.rooms.map((r) => <option key={r.id} value={r.id}>{maps.buildings.get(r.buildingId)?.code} {r.code}</option>)}
        </select>
        <select aria-label="Filter by lecturer" className={inputCls} value={filter.lecturer} onChange={(e) => setFilter({ ...filter, lecturer: e.target.value })}>
          <option value="">All lecturers</option>
          {b.lecturers.map((l) => <option key={l.id} value={l.id}>{lt(l.fullName, "en")}</option>)}
        </select>
      </div>

      {entries.length === 0 ? <EmptyState title="No timetable entries." /> : (
        <div className="cn-tablewrap">
          <table className="cn-table">
            <thead><tr>{["Day", "Time", "Course", "Group", "Room", "Lecturer", "Range", ""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className={cx("border-t border-line", conflictIds.has(e.id) && "bg-[color-mix(in_srgb,var(--cn-danger)_10%,transparent)]")}>
                  <td className="px-3 py-2">{e.recurrence === "once" ? <span className="mono text-xs">{e.validFrom}</span> : DAYS[e.day]}</td>
                  <td className="px-3 py-2 mono">{e.startTime}–{e.endTime}</td>
                  <td className="px-3 py-2"><span className="mono me-1">{maps.courses.get(e.courseId)?.code}</span>{e.kind ? <Badge>{e.kind}</Badge> : null} {e.status === "cancelled" ? <Badge tone="danger">cancelled</Badge> : null} {conflictIds.has(e.id) ? <Badge tone="danger">conflict</Badge> : null}</td>
                  <td className="px-3 py-2 mono text-xs">{e.groupId ? maps.groups.get(e.groupId)?.code : "—"}</td>
                  <td className="px-3 py-2 mono text-xs">{e.roomId ? `${maps.buildings.get(maps.rooms.get(e.roomId)?.buildingId ?? "")?.code ?? ""} ${maps.rooms.get(e.roomId)?.code ?? "?"}` : "—"}</td>
                  <td className="px-3 py-2">{e.lecturerId ? lt(maps.lecturers.get(e.lecturerId)?.fullName, "en") : "—"}</td>
                  <td className="px-3 py-2 mono text-xs whitespace-nowrap">{e.validFrom} → {e.validTo}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-end">
                    <button className="underline me-3" onClick={() => { setAck(false); setFormErr(null); setEditing(structuredClone(e)); }}>Edit</button>
                    <button className="underline text-danger" onClick={async () => { if (!window.confirm("Delete this entry?")) return; try { await getAdminSource().remove("timetable_entries", e.id); bump(); } catch (err) { toast(errorMessage(err), "error"); } }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {can("data.import") ? (
        <Section title="Import from CSV" className="mt-10">
          <p className="text-sm text-muted mb-3 max-w-3xl">
            Columns: <span className="mono text-xs">{TIMETABLE_COLUMNS.join(", ")}</span>. Days may be English, Sorani or Arabic names or 0–6 (Sunday = 0). Dates as YYYY-MM-DD or DD/MM/YYYY. Excel users: File → Save As → CSV UTF-8. Nothing is written until you confirm the preview.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} className="text-sm" />
            <Button onClick={() => download("timetable-template.csv", timetableTemplateCsv())}>Download template</Button>
          </div>
          {preview ? (
            <div className="mt-4 border border-line p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>{preview.totalRows} rows</Badge>
                <Badge tone="accent">{preview.entries.length} valid</Badge>
                <Badge tone={preview.errors.length ? "danger" : "neutral"}>{preview.errors.length} errors</Badge>
                <Badge tone={preview.conflicts.length ? "warn" : "neutral"}>{preview.conflicts.length} conflicts</Badge>
              </div>
              {preview.errors.length ? (
                <div>
                  <p className="font-medium text-danger text-sm">Fix these rows and upload again (nothing has been imported):</p>
                  <ul className="text-xs mono max-h-48 overflow-auto mt-1">
                    {preview.errors.slice(0, 200).map((e, i) => <li key={i}>row {e.row} · {e.column}: {e.code.replace(/_/g, " ")}{e.value ? ` (“${e.value}”)` : ""}</li>)}
                  </ul>
                </div>
              ) : null}
              {preview.conflicts.length ? (
                <div>
                  <p className="font-medium text-warn text-sm">Conflicts detected:</p>
                  <ul className="text-xs mono max-h-40 overflow-auto mt-1">
                    {preview.conflicts.map((c, i) => <li key={i}>{c.kind} clash on {c.firstDate} ({DAYS[c.day]})</li>)}
                  </ul>
                  <label className="flex items-center gap-2 text-sm mt-2"><input type="checkbox" checked={importAck} onChange={(e) => setImportAck(e.target.checked)} /> I have reviewed these conflicts and want to import anyway</label>
                </div>
              ) : null}
              <div className="flex gap-2">
                <Button variant="primary" disabled={busy || preview.errors.length > 0 || preview.entries.length === 0 || (preview.conflicts.length > 0 && !importAck)} onClick={() => void commitImport()}>
                  Import {preview.entries.length} entries
                </Button>
                <Button onClick={() => setPreview(null)}>Discard</Button>
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px] flex justify-end" role="dialog" aria-modal="true" aria-label="Edit timetable entry">
          <form className="cn-drawer w-full max-w-lg h-full overflow-y-auto p-6 md:p-8" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <h2 className="cn-display cn-display-md mb-6">Timetable entry</h2>
            <Field label="Course *" htmlFor="tc">
              <select id="tc" className={inputCls} value={editing.courseId} onChange={(e) => setEditing({ ...editing, courseId: e.target.value })}>
                <option value="">Select…</option>
                {b.courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {lt(c.name, "en")}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kind" htmlFor="tk">
                <select id="tk" className={inputCls} value={editing.kind ?? "lecture"} onChange={(e) => setEditing({ ...editing, kind: e.target.value as TimetableEntry["kind"] })}>
                  {["lecture", "lab", "tutorial", "exam"].map((k) => <option key={k}>{k}</option>)}
                </select>
              </Field>
              <Field label="Recurrence" htmlFor="tr">
                <select id="tr" className={inputCls} value={editing.recurrence} onChange={(e) => setEditing({ ...editing, recurrence: e.target.value as "weekly" | "once" })}>
                  <option value="weekly">Weekly</option><option value="once">One-off</option>
                </select>
              </Field>
            </div>
            <Field label="Student group" htmlFor="tg">
              <select id="tg" className={inputCls} value={editing.groupId ?? ""} onChange={(e) => setEditing({ ...editing, groupId: e.target.value || null })}>
                <option value="">—</option>
                {b.groups.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}
              </select>
            </Field>
            <Field label="Room" htmlFor="trm">
              <select id="trm" className={inputCls} value={editing.roomId ?? ""} onChange={(e) => setEditing({ ...editing, roomId: e.target.value || null })}>
                <option value="">—</option>
                {b.rooms.map((r) => <option key={r.id} value={r.id}>{maps.buildings.get(r.buildingId)?.code} {r.code} — {lt(r.name, "en")}</option>)}
              </select>
            </Field>
            <Field label="Lecturer" htmlFor="tl">
              <select id="tl" className={inputCls} value={editing.lecturerId ?? ""} onChange={(e) => setEditing({ ...editing, lecturerId: e.target.value || null })}>
                <option value="">—</option>
                {b.lecturers.map((l) => <option key={l.id} value={l.id}>{lt(l.fullName, "en")}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Day" htmlFor="td">
                <select id="td" className={inputCls} value={editing.day} onChange={(e) => setEditing({ ...editing, day: Number(e.target.value) as Weekday })} disabled={editing.recurrence === "once"}>
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}{b.university.settings.weekendDays.includes(i as Weekday) ? " (weekend)" : ""}</option>)}
                </select>
              </Field>
              <Field label="Start" htmlFor="ts"><input id="ts" type="time" className={inputCls} value={editing.startTime} onChange={(e) => setEditing({ ...editing, startTime: e.target.value })} /></Field>
              <Field label="End" htmlFor="te"><input id="te" type="time" className={inputCls} value={editing.endTime} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={editing.recurrence === "once" ? "Date" : "Valid from"} htmlFor="tf">
                <input id="tf" type="date" className={inputCls} value={editing.validFrom} onChange={(e) => {
                  const v = e.target.value;
                  setEditing(editing.recurrence === "once" ? { ...editing, validFrom: v, validTo: v, day: new Date(`${v}T12:00:00Z`).getUTCDay() as Weekday } : { ...editing, validFrom: v });
                }} />
              </Field>
              <Field label="Valid to" htmlFor="tt"><input id="tt" type="date" className={inputCls} value={editing.validTo} disabled={editing.recurrence === "once"} onChange={(e) => setEditing({ ...editing, validTo: e.target.value })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm mb-4"><input type="checkbox" checked={editing.status === "cancelled"} onChange={(e) => setEditing({ ...editing, status: e.target.checked ? "cancelled" : "scheduled" })} /> Cancelled for the whole period</label>
            {editConflicts.length ? (
              <div className="border border-warn p-3 mb-4 text-sm" role="alert">
                <p className="font-medium text-warn">Conflicts</p>
                <ul className="list-disc ps-5 mt-1 text-xs">{editConflicts.map((c, i) => <li key={i}>{describe(c)}</li>)}</ul>
                <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Save anyway — I have reviewed these conflicts</label>
              </div>
            ) : null}
            {formErr ? <p role="alert" className="text-danger text-sm whitespace-pre-line mb-4">{formErr}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={busy}>Save</Button>
              <Button onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
