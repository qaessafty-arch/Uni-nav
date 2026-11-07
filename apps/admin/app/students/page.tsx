"use client";
import { useEffect, useMemo, useState } from "react";
import { lt, programYears, type Department, type LocalizedText } from "@campusnav/core";
import type { EnrollmentRow, RosterInput, RosterRow } from "@campusnav/data";
import { errorMessage, getAdminSource, useAdmin, useTable } from "@/lib/admin";
import { inputCls } from "@/components/Form";
import { Badge, Button, ErrorState, Notice, PageTitle, Spinner } from "@/components/ui";

const name = (d: Department | undefined) => (d ? `${d.code} — ${lt(d.name as LocalizedText, "en")}` : "—");

/**
 * Parse "email, department code, year[, student number]" lines. Header lines
 * and blank lines are skipped. Returns rows plus readable per-line errors.
 */
function parseRoster(text: string, depts: Department[]): { rows: RosterInput[]; errors: string[] } {
  const byCode = new Map(depts.map((d) => [d.code.trim().toLowerCase(), d]));
  const rows: RosterInput[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const cells = line.split(/[,;\t]/).map((c) => c.trim());
    if (!cells[0] || /^e-?mail$/i.test(cells[0])) return;
    const [email, code, yearS, studentNumber] = cells;
    const dept = byCode.get((code ?? "").toLowerCase());
    const year = Number(yearS);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email!)) return errors.push(`Line ${i + 1}: "${email}" is not an email.`);
    if (!dept) return errors.push(`Line ${i + 1}: unknown department code "${code ?? ""}".`);
    if (!Number.isInteger(year) || year < 1 || year > programYears(dept)) return errors.push(`Line ${i + 1}: year must be 1–${programYears(dept)} for ${dept.code}.`);
    rows.push({ email: email!.toLowerCase(), departmentId: dept.id, year, studentNumber: studentNumber || null });
  });
  return { rows, errors };
}

export default function StudentsPage() {
  const { universityId, version, bump, toast, role } = useAdmin();
  const { rows: depts } = useTable<Department>("departments");
  const [enrollments, setEnrollments] = useState<EnrollmentRow[] | null>(null);
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!universityId) return;
    const src = getAdminSource();
    Promise.all([src.listEnrollments(universityId), src.listRoster(universityId)])
      .then(([e, r]) => {
        setEnrollments(e);
        setRoster(r);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [universityId, version]);

  const deptById = useMemo(() => new Map((depts ?? []).map((d) => [d.id, d])), [depts]);
  if (!role) return null;
  if (error) return <ErrorState title="Could not load students" body={error} />;
  if (!enrollments || !roster || !depts) return <Spinner label="Loading…" />;

  const review = async (id: string, status: "verified" | "rejected" | "revoked") => {
    try {
      await getAdminSource().reviewEnrollment(id, status);
      toast(status === "verified" ? "Student verified" : status === "rejected" ? "Request rejected" : "Access revoked");
      bump();
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const importCsv = async () => {
    const { rows, errors } = parseRoster(csv, depts);
    setParseErrors(errors);
    if (!rows.length) return;
    try {
      const n = await getAdminSource().importRoster(universityId!, rows);
      toast(`${n} student${n === 1 ? "" : "s"} added or updated`);
      if (!errors.length) setCsv("");
      bump();
    } catch (e) {
      setParseErrors([errorMessage(e)]);
    }
  };

  const pending = enrollments.filter((e) => e.status === "pending");
  const decided = enrollments.filter((e) => e.status !== "pending");
  const f = filter.trim().toLowerCase();
  const shownRoster = roster.filter((r) => !f || r.email.includes(f) || name(deptById.get(r.departmentId)).toLowerCase().includes(f));

  return (
    <div className="max-w-5xl space-y-8">
      <PageTitle>Students</PageTitle>
      <Notice>
        Visitors see buildings and public places only. Classrooms, timetables and free rooms are for verified students, and each student sees only the timetable of
        their own major and year. Students verify with their university email (set the allowed domains in Settings); a roster match verifies them at once,
        otherwise their request waits here.
      </Notice>

      <section aria-labelledby="req">
        <h2 id="req" className="label-caps mb-2">Waiting for approval ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">No requests right now.</p>
        ) : (
          <ul className="border border-line divide-y divide-line" data-testid="pending-list">
            {pending.map((e) => (
              <li key={e.id} className="p-3 flex flex-wrap items-center gap-3">
                <span className="mono text-sm" dir="ltr">{e.email}</span>
                <span className="text-sm">{name(deptById.get(e.departmentId))} · Year {e.year}</span>
                {e.studentNumber ? <Badge>#{e.studentNumber}</Badge> : null}
                <span className="ms-auto flex gap-2">
                  <Button variant="primary" onClick={() => void review(e.id, "verified")}>Approve</Button>
                  <Button onClick={() => void review(e.id, "rejected")}>Reject</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="roster">
        <h2 id="roster" className="label-caps mb-2">Roster from the registration office ({roster.length})</h2>
        <form className="border border-line p-4 space-y-2" onSubmit={(e) => { e.preventDefault(); void importCsv(); }}>
          <label className="text-sm block">
            Paste one student per line: <span className="mono">email, department code, year, student number (optional)</span>
            <textarea className={`${inputCls} mono min-h-32`} dir="ltr" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={`name@university.edu, ${depts[0]?.code ?? "CS"}, 1, 2026001`} aria-label="Roster lines" />
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" disabled={!csv.trim()}>Add / update students</Button>
            <span className="text-xs text-muted">Years are limited to each department's programme length (default 4).</span>
          </div>
          {parseErrors.length ? (
            <ul role="alert" className="text-danger text-sm list-disc ps-5">{parseErrors.slice(0, 20).map((m) => <li key={m}>{m}</li>)}</ul>
          ) : null}
        </form>
        <input className={`${inputCls} mt-3 max-w-sm`} placeholder="Filter by email or department" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter roster" />
        <ul className="border border-line divide-y divide-line mt-2" data-testid="roster-list">
          {shownRoster.slice(0, 300).map((r) => (
            <li key={r.id} className="p-2.5 flex flex-wrap items-center gap-3 text-sm">
              <span className="mono" dir="ltr">{r.email}</span>
              <span>{name(deptById.get(r.departmentId))} · Year {r.year}</span>
              {r.studentNumber ? <span className="text-muted">#{r.studentNumber}</span> : null}
              <Button className="ms-auto" onClick={async () => { await getAdminSource().removeRoster(r.id); bump(); }} aria-label={`Remove ${r.email}`}>Remove</Button>
            </li>
          ))}
          {shownRoster.length === 0 ? <li className="p-3 text-sm text-muted">No students on the roster yet.</li> : null}
        </ul>
        {shownRoster.length > 300 ? <p className="text-xs text-muted mt-1">Showing the first 300 — use the filter.</p> : null}
      </section>

      <section aria-labelledby="decided">
        <h2 id="decided" className="label-caps mb-2">Verified and decided ({decided.length})</h2>
        <ul className="border border-line divide-y divide-line">
          {decided.slice(0, 300).map((e) => (
            <li key={e.id} className="p-2.5 flex flex-wrap items-center gap-3 text-sm">
              <span className="mono" dir="ltr">{e.email}</span>
              <span>{name(deptById.get(e.departmentId))} · Year {e.year}</span>
              <Badge tone={e.status === "verified" ? "accent" : "warn"}>{e.status}{e.method === "roster" ? " · roster" : ""}</Badge>
              {e.status === "verified" ? <Button className="ms-auto" onClick={() => void review(e.id, "revoked")}>Revoke</Button> : null}
            </li>
          ))}
          {decided.length === 0 ? <li className="p-3 text-sm text-muted">No verified students yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
