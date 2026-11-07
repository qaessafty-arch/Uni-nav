"use client";
import { useEffect, useMemo, useState } from "react";
import { lt, programYears, type Department, type LocalizedText } from "@campusnav/core";
import type { EnrollmentRow, GroupRepRow, RosterInput, RosterRow } from "@campusnav/data";
import type { StudentGroup } from "@campusnav/core";
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
  const { rows: groups } = useTable<StudentGroup>("student_groups");
  const [reps, setReps] = useState<GroupRepRow[] | null>(null);
  const [repGroup, setRepGroup] = useState("");
  const [repUser, setRepUser] = useState("");
  const [repError, setRepError] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[] | null>(null);
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  // One-student form
  const [oneEmail, setOneEmail] = useState("");
  const [oneDept, setOneDept] = useState("");
  const [oneYear, setOneYear] = useState("");
  const [oneNumber, setOneNumber] = useState("");
  const [oneError, setOneError] = useState<string | null>(null);

  useEffect(() => {
    if (!universityId) return;
    const src = getAdminSource();
    Promise.all([src.listEnrollments(universityId), src.listRoster(universityId), src.listReps(universityId)])
      .then(([e, r, rp]) => {
        setEnrollments(e);
        setRoster(r);
        setReps(rp);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [universityId, version]);

  const deptById = useMemo(() => new Map((depts ?? []).map((d) => [d.id, d])), [depts]);
  if (!role) return null;
  if (error) return <ErrorState title="Could not load students" body={error} />;
  if (!enrollments || !roster || !depts || !reps || !groups) return <Spinner label="Loading…" />;

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

  const addOne = async () => {
    setOneError(null);
    const email = oneEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setOneError("Enter a valid email address.");
    if (!oneDept) return setOneError("Choose the department.");
    if (!oneYear) return setOneError("Choose the year.");
    try {
      await getAdminSource().importRoster(universityId!, [{ email, departmentId: oneDept, year: Number(oneYear), studentNumber: oneNumber.trim() || null }]);
      toast(`${email} added`);
      setOneEmail("");
      setOneNumber("");
      bump();
    } catch (e) {
      setOneError(errorMessage(e));
    }
  };
  // Departments grouped by college for the dropdown
  const byCollege = new Map<string, Department[]>();
  for (const d of [...depts].sort((a, b) => lt(a.name as LocalizedText, "en").localeCompare(lt(b.name as LocalizedText, "en")))) {
    const c = d.college ? lt(d.college as LocalizedText, "en") : "Other";
    byCollege.set(c, [...(byCollege.get(c) ?? []), d]);
  }
  const oneYears = oneDept ? Array.from({ length: programYears(deptById.get(oneDept)) }, (_, i) => i + 1) : [];

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const repGroupObj = groupById.get(repGroup);
  // Only verified students of the class's major and year can represent it.
  const repCandidates = repGroupObj ? enrollments.filter((e) => e.status === "verified" && e.departmentId === repGroupObj.departmentId && e.year === repGroupObj.stage) : [];
  const appoint = async () => {
    setRepError(null);
    if (!repGroup || !repUser) return setRepError("Choose the class and the student.");
    try {
      await getAdminSource().appointRep(repGroup, repUser);
      toast("Class rep appointed");
      setRepUser("");
      bump();
    } catch (e) {
      setRepError(errorMessage(e));
    }
  };
  const removeRep = async (id: string) => {
    try {
      await getAdminSource().removeRep(id);
      toast("Class rep removed");
      bump();
    } catch (e) {
      toast(errorMessage(e));
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
        <form className="border border-line p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.4fr_0.6fr_0.8fr_auto] items-end" onSubmit={(e) => { e.preventDefault(); void addOne(); }} data-testid="add-student">
          <label className="text-sm">University email
            <input className={inputCls} type="email" dir="ltr" required value={oneEmail} onChange={(e) => setOneEmail(e.target.value)} placeholder="name@su.edu.krd" aria-label="Student email" />
          </label>
          <label className="text-sm">Department
            <select className={inputCls} value={oneDept} onChange={(e) => { setOneDept(e.target.value); setOneYear(""); }} aria-label="Department">
              <option value="">Choose…</option>
              {[...byCollege.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([college, list]) => (
                <optgroup key={college} label={college}>
                  {list.map((d) => <option key={d.id} value={d.id}>{lt(d.name as LocalizedText, "en")}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-sm">Year
            <select className={inputCls} value={oneYear} disabled={!oneDept} onChange={(e) => setOneYear(e.target.value)} aria-label="Year">
              <option value="">Choose…</option>
              {oneYears.map((y) => <option key={y} value={String(y)}>Year {y}</option>)}
            </select>
          </label>
          <label className="text-sm">Student no. <span className="text-muted">(optional)</span>
            <input className={inputCls} dir="ltr" maxLength={40} value={oneNumber} onChange={(e) => setOneNumber(e.target.value)} aria-label="Student number" />
          </label>
          <Button type="submit" variant="primary">Add student</Button>
          {oneError ? <p role="alert" className="text-danger text-sm sm:col-span-2 lg:col-span-5">{oneError}</p> : null}
        </form>
        <details className="mt-3 border border-line">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">Add many at once (paste a list from the registration office)</summary>
        <form className="p-4 pt-1 space-y-2" onSubmit={(e) => { e.preventDefault(); void importCsv(); }}>
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
        </details>
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

      <section aria-labelledby="reps">
        <h2 id="reps" className="label-caps mb-2">Class representatives ({reps.length})</h2>
        <p className="text-sm text-muted mb-2">
          A class rep is a verified student who can post announcements to their class and upload lecture materials for their class&apos;s courses
          (unless a course turns that off). They lose these rights automatically if their verification is revoked.
        </p>
        <form className="border border-line p-4 grid gap-3 sm:grid-cols-[1.2fr_1.4fr_auto] items-end" onSubmit={(e) => { e.preventDefault(); void appoint(); }} data-testid="appoint-rep">
          <label className="text-sm">Class
            <select className={inputCls} value={repGroup} onChange={(e) => { setRepGroup(e.target.value); setRepUser(""); }} aria-label="Class">
              <option value="">Choose…</option>
              {[...groups].sort((a, b) => a.code.localeCompare(b.code)).map((g) => <option key={g.id} value={g.id}>{g.code} — {lt(g.name as LocalizedText, "en")}</option>)}
            </select>
          </label>
          <label className="text-sm">Verified student
            <select className={inputCls} value={repUser} disabled={!repGroup} onChange={(e) => setRepUser(e.target.value)} aria-label="Student">
              <option value="">{repGroup && repCandidates.length === 0 ? "No verified students for this major and year yet" : "Choose…"}</option>
              {repCandidates.map((e) => <option key={e.userId} value={e.userId}>{e.email}</option>)}
            </select>
          </label>
          <Button type="submit" variant="primary">Appoint</Button>
          {repError ? <p role="alert" className="text-danger text-sm sm:col-span-3">{repError}</p> : null}
        </form>
        <ul className="border border-line divide-y divide-line mt-2" data-testid="rep-list">
          {reps.map((r) => (
            <li key={r.id} className="p-2.5 flex flex-wrap items-center gap-3 text-sm">
              <Badge tone="accent">{groupById.get(r.groupId)?.code ?? "?"}</Badge>
              <span className="mono" dir="ltr">{r.email ?? r.userId}</span>
              <Button className="ms-auto" onClick={() => void removeRep(r.id)} aria-label={`Remove rep ${r.email ?? ""}`}>Remove</Button>
            </li>
          ))}
          {reps.length === 0 ? <li className="p-3 text-sm text-muted">No class reps yet.</li> : null}
        </ul>
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
