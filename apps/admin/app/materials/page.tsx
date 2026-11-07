"use client";
import { useEffect, useMemo, useState } from "react";
import { lt, materialsBySection, type Course, type CourseMaterial, type LocalizedText, type StudentGroup, type TimetableEntry } from "@campusnav/core";
import { materialProblem, type MaterialInput } from "@campusnav/data";
import { errorMessage, getAdminSource, useAdmin, useTable } from "@/lib/admin";
import { inputCls } from "@/components/Form";
import { Badge, Button, ErrorState, Notice, PageTitle, Spinner } from "@/components/ui";

type LecturerRow = { id: string; userId?: string | null };

const PROBLEMS: Record<string, string> = {
  title: "Enter a title.",
  file_or_link: "Choose a file or enter a link.",
  file_type: "Only PDF, PPTX, DOCX, PNG or JPEG files.",
  file_size: "The file is larger than 20 MB.",
  link: "Enter a link starting with http:// or https://",
};

/**
 * Lecture materials per course. Staff with course.manage see every course;
 * lecturers linked to their login see the courses they teach. The database
 * enforces the same rule.
 */
export default function MaterialsPage() {
  const { universityId, version, bump, toast, can, session } = useAdmin();
  const { rows: courses } = useTable<Course>("courses");
  const { rows: groups } = useTable<StudentGroup>("student_groups");
  const { rows: timetable } = useTable<TimetableEntry>("timetable_entries");
  const { rows: lecturers } = useTable<LecturerRow>("lecturers");
  const [materials, setMaterials] = useState<CourseMaterial[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState("");
  // Upload form
  const [section, setSection] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [groupId, setGroupId] = useState("");
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!universityId) return;
    getAdminSource().listMaterials(universityId).then(setMaterials).catch((e) => setError(errorMessage(e)));
  }, [universityId, version]);

  const manager = can("course.manage");
  const myLecturerId = useMemo(() => lecturers?.find((l) => session?.userId && l.userId === session.userId)?.id ?? null, [lecturers, session]);
  const visibleCourses = useMemo(() => {
    if (!courses || !timetable) return [];
    const taught = new Set(timetable.filter((t) => myLecturerId && t.lecturerId === myLecturerId).map((t) => t.courseId));
    return courses.filter((c) => manager || taught.has(c.id)).sort((a, b) => a.code.localeCompare(b.code));
  }, [courses, timetable, manager, myLecturerId]);

  if (error) return <ErrorState title="Could not load materials" body={error} />;
  if (!materials || !courses || !groups || !timetable || !lecturers) return <Spinner label="Loading…" />;

  const course = courses.find((c) => c.id === courseId) ?? null;
  const courseGroups = course ? [...new Set(timetable.filter((t) => t.courseId === course.id && t.groupId).map((t) => t.groupId!))] : [];
  const groupCode = (id?: string | null) => (id ? groups.find((g) => g.id === id)?.code ?? "?" : "All classes");
  const items = course ? materials.filter((m) => m.courseId === course.id) : [];

  const upload = async () => {
    if (!course) return;
    const data: MaterialInput = { courseId: course.id, groupId: groupId || null, section, title, file, fileName: file?.name ?? null, url: file ? null : url };
    const p = materialProblem(data);
    if (p) return setFormMsg(PROBLEMS[p] ?? p);
    setBusy(true);
    setFormMsg(null);
    try {
      await getAdminSource().classes.addMaterial(universityId!, data);
      toast("Material added");
      setTitle("");
      setUrl("");
      setFile(null);
      bump();
    } catch (e) {
      setFormMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const open = async (m: CourseMaterial) => {
    try {
      window.open(await getAdminSource().classes.openMaterial(m), "_blank", "noopener");
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const remove = async (m: CourseMaterial) => {
    if (!window.confirm(`Remove “${m.title}” for everyone?`)) return;
    try {
      await getAdminSource().classes.removeMaterial(m);
      toast("Material removed");
      bump();
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const toggleReps = async () => {
    if (!course) return;
    try {
      await getAdminSource().upsert("courses", { ...course, repsCanUpload: course.repsCanUpload === false });
      toast(course.repsCanUpload === false ? "Class reps may upload again" : "Class reps can no longer upload to this course");
      bump();
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageTitle>Lecture materials</PageTitle>
      <Notice>
        Files and links on a course page. Only verified students of the course&apos;s classes (their major and year) can open them; files are private and
        open through links that expire after 5 minutes. Class reps can also upload for their own class unless you turn that off.
      </Notice>
      {visibleCourses.length === 0 ? (
        <p className="text-sm text-muted">
          {manager ? "No courses yet." : "No courses linked to you. Ask an administrator to link your lecturer profile to your login and add your classes to the timetable."}
        </p>
      ) : (
        <label className="text-sm block max-w-md">Course
          <select className={inputCls} value={courseId} onChange={(e) => { setCourseId(e.target.value); setGroupId(""); }} aria-label="Course">
            <option value="">Choose…</option>
            {visibleCourses.map((c) => <option key={c.id} value={c.id}>{c.code} — {lt(c.name as LocalizedText, "en")}</option>)}
          </select>
        </label>
      )}

      {course ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={course.repsCanUpload === false ? "warn" : "accent"}>{course.repsCanUpload === false ? "Reps cannot upload" : "Reps can upload"}</Badge>
            {manager ? <Button onClick={() => void toggleReps()}>{course.repsCanUpload === false ? "Allow class reps to upload" : "Stop class reps uploading"}</Button> : null}
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-muted">No materials for this course yet.</p>
          ) : (
            materialsBySection(items).map((s) => (
              <div key={s.section ?? "_"}>
                {s.section ? <h3 className="label-caps mb-2">{s.section}</h3> : null}
                <ul className="border border-line divide-y divide-line" data-testid="admin-materials">
                  {s.items.map((m) => (
                    <li key={m.id} className="p-2.5 flex flex-wrap items-center gap-3 text-sm">
                      <span className="mono text-xs uppercase w-12 text-muted">{m.kind === "link" ? "link" : (m.storagePath ?? "").split(".").pop()}</span>
                      <span className="font-medium">{m.title}</span>
                      <Badge>{groupCode(m.groupId)}</Badge>
                      <span className="mono text-xs text-muted">{m.createdAt.slice(0, 10)}</span>
                      <span className="ms-auto flex gap-2">
                        <Button onClick={() => void open(m)}>Open</Button>
                        <Button onClick={() => void remove(m)}>Remove</Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}

          <form className="border border-line p-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void upload(); }} data-testid="admin-material-form">
            <h2 className="label-caps sm:col-span-2">Add material</h2>
            <label className="text-sm">Section <span className="text-muted">(e.g. Week 3 – Circuits)</span>
              <input className={inputCls} value={section} maxLength={120} onChange={(e) => setSection(e.target.value)} />
            </label>
            <label className="text-sm">Title
              <input className={inputCls} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
            </label>
            <label className="text-sm">File <span className="text-muted">(PDF, PPTX, DOCX, PNG, JPEG · max 20 MB)</span>
              <input type="file" accept=".pdf,.pptx,.docx,.png,.jpg,.jpeg" className="block w-full text-sm mt-1" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <label className="text-sm">…or a link
              <input className={inputCls} type="url" dir="ltr" placeholder="https://" value={url} disabled={!!file} onChange={(e) => setUrl(e.target.value)} />
            </label>
            <label className="text-sm">For class
              <select className={inputCls} value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="For class">
                <option value="">All classes taking this course</option>
                {courseGroups.map((g) => <option key={g} value={g}>{groupCode(g)}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={busy}>{busy ? "Uploading…" : "Add material"}</Button>
            </div>
            {formMsg ? <p role="alert" className="text-danger text-sm sm:col-span-2">{formMsg}</p> : null}
          </form>
        </>
      ) : null}
    </div>
  );
}
