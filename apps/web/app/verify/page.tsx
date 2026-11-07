"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { lt, programYears, type CampusBundle } from "@campusnav/core";
import type { VerifyConfirm } from "@campusnav/data/types";
import { Gate } from "@/components/Gate";
import { Icon } from "@/components/Icon";
import { I } from "@/components/icons";
import { useStudentLabel } from "@/components/StudentGate";
import { Button, ButtonLink, Notice, PageTitle } from "@/components/ui";
import { getDataSource } from "@/lib/config";
import { useApp } from "@/lib/store";

const input = "cn-input w-full min-h-11";
const sel = "w-full min-h-11 bg-surface border border-line-strong px-3 rounded-[var(--cn-radius,6px)]";

/** Only same-site paths, so the link can't bounce people elsewhere. */
function safeThen(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/timetable";
}

function Verify({ bundle }: { bundle: CampusBundle }) {
  const { t, prefs, student, refreshStudent, signOutStudent, reload } = useApp();
  const router = useRouter();
  const then = safeThen(useSearchParams().get("then"));
  const uid = bundle.university.id;
  const domains = bundle.university.settings.studentEmailDomains ?? [];
  const label = useStudentLabel();

  const [step, setStep] = useState<"email" | "code" | "request" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dept, setDept] = useState("");
  const [year, setYear] = useState("");
  const [studentNo, setStudentNo] = useState("");

  const after = async (r: VerifyConfirm) => {
    if (r.status === "verified" || r.status === "pending") {
      await refreshStudent();
      reload(); // fetch the student's own view (classrooms, timetable)
      setStep("done");
      setMsg(null);
    } else if (r.status === "not_on_roster") {
      setStep("request");
      setMsg({ tone: "info", text: t("verify.notOnRoster") });
    } else if (r.status === "invalid_code") setMsg({ tone: "warn", text: t("verify.invalidCode") });
    else setMsg({ tone: "warn", text: t("verify.error", { message: r.message }) });
  };

  // Returning from the emailed link.
  useEffect(() => {
    (async () => {
      const src = await getDataSource();
      if (!src.student?.completeFromUrl) return;
      const r = await src.student.completeFromUrl(uid, window.location.href);
      if (r) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        await after(r);
      }
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const src = await getDataSource();
      const r = await src.student!.start(uid, email);
      if (r.status === "domain_not_allowed") setMsg({ tone: "warn", text: t("verify.domain", { domains: r.domains.map((d) => `@${d}`).join(", ") }) });
      else if (r.status === "error") setMsg({ tone: "warn", text: t("verify.error", { message: r.message }) });
      else {
        setDemoCode(r.status === "demo" ? r.code : null);
        setStep("code");
      }
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await after(await (await getDataSource()).student!.confirm(uid, email, code));
    } finally {
      setBusy(false);
    }
  };

  const request = async () => {
    if (!dept || !year) return;
    setBusy(true);
    try {
      await after(await (await getDataSource()).student!.request(uid, dept, Number(year), studentNo.trim() || null));
    } finally {
      setBusy(false);
    }
  };

  const loc = prefs.locale;
  const majors = [...bundle.departments].sort((a, b) => lt(a.name, loc).localeCompare(lt(b.name, loc)));
  const years = dept ? Array.from({ length: programYears(bundle.departments.find((d) => d.id === dept)) }, (_, i) => i + 1) : [];

  // Already verified (or staff): show who they are.
  if (student.access.kind !== "visitor" && step !== "done") {
    return (
      <div className="max-w-xl space-y-4" data-testid="verify-status">
        <Notice tone="accent"><span className="inline-flex items-center gap-2"><Icon d={I.checkCircle} className="size-4" /> {student.access.kind === "staff" ? t("access.staff") : label}</span></Notice>
        {student.email ? <p className="text-sm text-muted mono" dir="ltr">{student.email}</p> : null}
        <div className="flex flex-wrap gap-2">
          <ButtonLink variant="primary" href={then}>{t("verify.openTimetable")}</ButtonLink>
          <Button onClick={() => void signOutStudent()} data-testid="student-signout">{t("verify.signOut")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-muted">{t("verify.intro")}</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      {step === "email" ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <label className="block text-sm">
            <span className="label-caps block mb-1">{t("verify.email")}</span>
            <input className={input} type="email" inputMode="email" autoComplete="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={domains[0] ? `name@${domains[0]}` : "name@university.edu"} data-testid="verify-email" />
          </label>
          <Button variant="primary" type="submit" disabled={busy || !email.includes("@")}>{t("verify.send")}</Button>
        </form>
      ) : null}

      {step === "code" ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void confirm(); }}>
          {demoCode ? <Notice tone="warn">{t("verify.demoCode", { code: demoCode, examples: "cs1@…, ce3@…, phy4@…" })}</Notice> : null}
          <p className="text-sm text-muted mono" dir="ltr">{email}</p>
          <label className="block text-sm">
            <span className="label-caps block mb-1">{t("verify.code")}</span>
            <input className={`${input} mono tracking-[0.3em]`} inputMode="numeric" autoComplete="one-time-code" dir="ltr" required value={code} onChange={(e) => setCode(e.target.value)} data-testid="verify-code" />
          </label>
          <p className="text-xs text-faint">{t("verify.codeHelp")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" type="submit" disabled={busy || code.trim().length < 6}>{t("verify.confirm")}</Button>
            <Button type="button" onClick={() => { setStep("email"); setCode(""); setMsg(null); }}>{t("verify.changeEmail")}</Button>
          </div>
        </form>
      ) : null}

      {step === "request" ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void request(); }} data-testid="verify-request">
          <label className="block text-sm">
            <span className="label-caps block mb-1">{t("timetable.major")}</span>
            <select className={sel} value={dept} onChange={(e) => { setDept(e.target.value); setYear(""); }} aria-label={t("timetable.major")} required>
              <option value="">{t("timetable.chooseMajor")}</option>
              {majors.map((d) => <option key={d.id} value={d.id}>{lt(d.name, loc)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="label-caps block mb-1">{t("timetable.year")}</span>
            <select className={sel} value={year} disabled={!dept} onChange={(e) => setYear(e.target.value)} aria-label={t("timetable.year")} required>
              <option value="">{t("timetable.chooseYear")}</option>
              {years.map((y) => <option key={y} value={String(y)}>{t("timetable.yearN", { n: y })}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="label-caps block mb-1">{t("verify.studentNumber")}</span>
            <input className={input} dir="ltr" maxLength={40} value={studentNo} onChange={(e) => setStudentNo(e.target.value)} />
          </label>
          <Button variant="primary" type="submit" disabled={busy || !dept || !year}>{t("verify.request")}</Button>
        </form>
      ) : null}

      {step === "done" ? (
        <div className="space-y-3" data-testid="verify-done">
          {student.access.kind === "student" ? (
            <Notice tone="accent"><span className="inline-flex items-center gap-2"><Icon d={I.checkCircle} className="size-4" /> {label}</span></Notice>
          ) : student.pending ? (
            <Notice tone="info">{t("student.pending", { major: lt(bundle.departments.find((d) => d.id === student.pending!.departmentId)?.name, loc), year: student.pending.year })}</Notice>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {student.access.kind === "student" ? <Button variant="primary" onClick={() => router.push(then)}>{t("verify.openTimetable")}</Button> : null}
            <ButtonLink href="/">{t("nav.home")}</ButtonLink>
          </div>
        </div>
      ) : null}

      <p className="text-sm text-faint pt-2">{t("student.visitorNote")}</p>
    </div>
  );
}

export default function VerifyPage() {
  const { t } = useApp();
  return (
    <div>
      <PageTitle eyebrow={t("access.student")}>{t("verify.title")}</PageTitle>
      <Gate>
        {(bundle) => (
          <Suspense>
            <Verify bundle={bundle} />
          </Suspense>
        )}
      </Gate>
    </div>
  );
}
