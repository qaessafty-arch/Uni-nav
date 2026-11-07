"use client";
import { useEffect, useRef, useState } from "react";
import { materialsBySection, uploadTargets, type CampusBundle, type Course, type CourseMaterial } from "@campusnav/core";
import { formatDate } from "@campusnav/i18n";
import { materialProblem, type MaterialInput } from "@campusnav/data/types";
import type { MessageKey } from "@campusnav/i18n";
import { Badge, Button, ButtonLink, EmptyState, Notice, Section } from "@/components/ui";
import { getDataSource } from "@/lib/config";
import { kv, useApp } from "@/lib/store";

const input = "cn-input w-full min-h-11";
const sel = "w-full min-h-11 bg-surface border border-line-strong px-3 rounded-[var(--cn-radius,6px)]";
const seenKey = (courseId: string) => `campusnav.materials.seen.${courseId}`;

function sizeLabel(n?: number | null): string {
  if (!n) return "";
  return n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;
}

function dataUrlToBlob(u: string): Blob {
  const [head, b64 = ""] = u.split(",");
  const mime = /data:([^;]+)/.exec(head ?? "")?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Lecture materials for one course: list for verified students, upload form for reps and lecturers. */
export function CourseMaterials({ bundle, course }: { bundle: CampusBundle; course: Course }) {
  const { t, prefs, student, reload } = useApp();
  const loc = prefs.locale;
  const items = (bundle.materials ?? []).filter((m) => m.courseId === course.id);
  const groups = new Map(bundle.groups.map((g) => [g.id, g]));
  const targets = student.access.kind === "visitor" ? null : uploadTargets(bundle, course.id);
  const uid = bundle.classRoles?.userId ?? null;

  // "New" = added since this person last opened the course page.
  const [seenAt] = useState<string>(() => kv.getJSON<string>(seenKey(course.id), ""));
  useEffect(() => {
    kv.setJSON(seenKey(course.id), new Date().toISOString());
  }, [course.id]);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (student.access.kind === "visitor") {
    return (
      <Section title={t("material.title")} className="mt-6">
        <Notice>{t("material.visitor")}</Notice>
        <div className="mt-3">
          <ButtonLink href={`/verify?then=/courses/${course.id}`}>{t("student.verifyCta")}</ButtonLink>
        </div>
      </Section>
    );
  }

  const open = async (m: CourseMaterial) => {
    setError(null);
    // Open the tab first (synchronously) so pop-up blockers allow it, then point it at the signed URL.
    const w = window.open("", "_blank");
    if (w) w.opener = null;
    try {
      let url = await (await getDataSource()).classes!.openMaterial(m);
      // Browsers refuse to open data: URLs in a tab (demo files); hand them over as a blob.
      if (url.startsWith("data:")) url = URL.createObjectURL(dataUrlToBlob(url));
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (e) {
      w?.close();
      setError(t("material.err.failed", { message: e instanceof Error ? e.message : String(e) }));
    }
  };

  const remove = async (m: CourseMaterial) => {
    if (!window.confirm(t("material.removeConfirm"))) return;
    setBusy(m.id);
    try {
      await (await getDataSource()).classes!.removeMaterial(m);
      reload();
    } catch (e) {
      setError(t("material.err.failed", { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  };

  const sections = materialsBySection(items);
  return (
    <Section title={t("material.title")} className="mt-6">
      {error ? <div className="mb-3"><Notice tone="warn">{error}</Notice></div> : null}
      {sections.length === 0 ? (
        <EmptyState title={t("material.empty")} />
      ) : (
        <div className="space-y-5" data-testid="materials">
          {sections.map((s) => (
            <div key={s.section ?? "_"}>
              {s.section ? <h3 className="label-caps mb-2">{s.section}</h3> : null}
              <ul className="border border-line divide-y divide-line">
                {s.items.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid="material">
                    <span className="mono text-xs text-muted w-12 uppercase">{m.kind === "link" ? t("material.link") : (m.storagePath ?? "").split(".").pop()}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{m.title}</span>
                      <span className="block text-xs text-muted">
                        {formatDate(loc, m.createdAt)}
                        {m.sizeBytes ? ` · ${sizeLabel(m.sizeBytes)}` : ""}
                        {` · ${m.groupId ? groups.get(m.groupId)?.code ?? "" : t("material.allClasses")}`}
                      </span>
                    </span>
                    {seenAt && m.createdAt > seenAt ? <Badge tone="accent">{t("material.new")}</Badge> : null}
                    <Button onClick={() => void open(m)} className="!min-h-9">{t("material.open")}</Button>
                    {targets && uid && m.uploadedBy === uid ? (
                      <Button onClick={() => void remove(m)} disabled={busy === m.id} className="!min-h-9">{t("material.remove")}</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {targets ? <UploadForm bundle={bundle} course={course} targets={targets} onDone={reload} /> : null}
    </Section>
  );
}

function UploadForm({ bundle, course, targets, onDone }: { bundle: CampusBundle; course: Course; targets: { allClasses: boolean; groupIds: string[] }; onDone: () => void }) {
  const { t } = useApp();
  const [section, setSection] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [group, setGroup] = useState<string>(targets.allClasses ? "" : targets.groupIds[0] ?? "");
  const [msg, setMsg] = useState<{ tone: "warn" | "accent"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const groups = new Map(bundle.groups.map((g) => [g.id, g]));

  const submit = async () => {
    const data: MaterialInput = { courseId: course.id, groupId: group || null, section, title, file, fileName: file?.name ?? null, url: file ? null : url };
    const p = materialProblem(data);
    if (p) return setMsg({ tone: "warn", text: t(`material.err.${p}` as MessageKey) });
    setBusy(true);
    setMsg(null);
    try {
      await (await getDataSource()).classes!.addMaterial(bundle.university.id, data);
      setTitle("");
      setUrl("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMsg({ tone: "accent", text: t("material.added") });
      onDone();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg({ tone: "warn", text: m === "material_demo_size" ? t("material.err.demo_size") : t("material.err.failed", { message: m }) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="mt-4 border border-line" open={false} data-testid="material-upload">
      <summary className="cursor-pointer px-4 py-2.5 font-medium">{t("material.add")}</summary>
      <form className="p-4 pt-1 space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {bundle.source === "demo" ? <Notice>{t("material.demoNote")}</Notice> : null}
        <label className="block text-sm">
          <span className="label-caps block mb-1">{t("material.section")}</span>
          <input className={input} value={section} maxLength={120} onChange={(e) => setSection(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="label-caps block mb-1">{t("material.name")}</span>
          <input className={input} value={title} maxLength={200} required onChange={(e) => setTitle(e.target.value)} data-testid="material-title" />
        </label>
        <label className="block text-sm">
          <span className="label-caps block mb-1">{t("material.file")}</span>
          <input ref={fileRef} type="file" accept=".pdf,.pptx,.docx,.png,.jpg,.jpeg" className="block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="material-file" />
        </label>
        {!file ? (
          <label className="block text-sm">
            <span className="label-caps block mb-1">{t("material.orLink")}</span>
            <input className={input} type="url" dir="ltr" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} data-testid="material-url" />
          </label>
        ) : null}
        <label className="block text-sm">
          <span className="label-caps block mb-1">{t("material.forClass")}</span>
          <select className={sel} value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t("material.forClass")}>
            {targets.allClasses ? <option value="">{t("material.allClasses")}</option> : null}
            {targets.groupIds.map((g) => <option key={g} value={g}>{groups.get(g)?.code ?? g}</option>)}
          </select>
        </label>
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <Button variant="primary" type="submit" disabled={busy}>{busy ? t("material.uploading") : t("material.upload")}</Button>
      </form>
    </details>
  );
}
