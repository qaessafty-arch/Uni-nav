import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { lt, programYears, type CampusBundle } from "@campusnav/core";
import type { VerifyConfirm } from "@campusnav/data";
import { Gate } from "@/Gate";
import { dataSource, useApp } from "@/store";
import { Btn, Input, Label, Notice, Screen, T, c, useText } from "@/ui";

function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={onPress} style={{ borderWidth: 1, borderColor: on ? c.accent : c.borderStrong, backgroundColor: on ? c.accentSoft : "transparent", borderRadius: 8, paddingHorizontal: 12, minHeight: 40, justifyContent: "center" }}>
      <T size="sm" style={{ color: on ? c.accent : c.text }}>{label}</T>
    </Pressable>
  );
}

function Verify({ bundle }: { bundle: CampusBundle }) {
  const { t, prefs, student, refreshStudent, signOutStudent, reload } = useApp();
  const tx = useText();
  const uid = bundle.university.id;
  const domains = bundle.university.settings.studentEmailDomains ?? [];
  const [step, setStep] = useState<"email" | "code" | "request" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dept, setDept] = useState("");
  const [year, setYear] = useState(0);
  const loc = prefs.locale;

  const after = async (r: VerifyConfirm) => {
    if (r.status === "verified" || r.status === "pending") {
      await refreshStudent();
      reload();
      setStep("done");
      setMsg(null);
    } else if (r.status === "not_on_roster") {
      setStep("request");
      setMsg({ tone: "info", text: t("verify.notOnRoster") });
    } else if (r.status === "invalid_code") setMsg({ tone: "warn", text: t("verify.invalidCode") });
    else setMsg({ tone: "warn", text: t("verify.error", { message: r.message }) });
  };
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };
  const auth = dataSource().student!;

  if (student.access.kind !== "visitor" && step !== "done") {
    const d = student.access.kind === "student" ? bundle.departments.find((x) => x.id === (student.access as { departmentId: string }).departmentId) : null;
    return (
      <Screen>
        <View style={{ gap: 12 }}>
          <Notice>{student.access.kind === "staff" ? t("access.staff") : t("access.studentOf", { major: d ? lt(d.name, loc) : "—", year: (student.access as { year: number }).year })}</Notice>
          {student.email ? <T muted mono size="sm">{student.email}</T> : null}
          <Btn variant="primary" title={t("verify.openTimetable")} href="/timetable" />
          <Btn title={t("verify.signOut")} onPress={() => void signOutStudent()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 12 }}>
        <T muted>{t("verify.intro")}</T>
        {msg ? <Notice tone={msg.tone === "warn" ? "warn" : "info"}>{msg.text}</Notice> : null}
        {step === "email" ? (
          <>
            <Label>{t("verify.email")}</Label>
            <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder={domains[0] ? `name@${domains[0]}` : "name@university.edu"} />
            <Btn variant="primary" title={t("verify.send")} disabled={busy || !email.includes("@")} onPress={() => void run(async () => {
              const r = await auth.start(uid, email);
              if (r.status === "domain_not_allowed") setMsg({ tone: "warn", text: t("verify.domain", { domains: r.domains.map((d) => `@${d}`).join(", ") }) });
              else if (r.status === "error") setMsg({ tone: "warn", text: t("verify.error", { message: r.message }) });
              else {
                setDemoCode(r.status === "demo" ? r.code : null);
                setStep("code");
                setMsg(null);
              }
            })} />
          </>
        ) : null}
        {step === "code" ? (
          <>
            {demoCode ? <Notice tone="warn">{t("verify.demoCode", { code: demoCode, examples: "cs1@…, ce3@…, phy4@…" })}</Notice> : null}
            <T muted mono size="sm">{email}</T>
            <Label>{t("verify.code")}</Label>
            <Input value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" />
            <Btn variant="primary" title={t("verify.confirm")} disabled={busy || code.trim().length < 6} onPress={() => void run(async () => after(await auth.confirm(uid, email, code)))} />
            <Btn title={t("verify.changeEmail")} onPress={() => { setStep("email"); setCode(""); setMsg(null); }} />
          </>
        ) : null}
        {step === "request" ? (
          <>
            <Label>{t("timetable.major")}</Label>
            <View style={{ flexDirection: tx.row, flexWrap: "wrap", gap: 6 }} accessibilityRole="radiogroup">
              {bundle.departments.map((d) => <Choice key={d.id} label={lt(d.name, loc)} on={dept === d.id} onPress={() => { setDept(d.id); setYear(0); }} />)}
            </View>
            {dept ? (
              <>
                <Label>{t("timetable.year")}</Label>
                <View style={{ flexDirection: tx.row, flexWrap: "wrap", gap: 6 }} accessibilityRole="radiogroup">
                  {Array.from({ length: programYears(bundle.departments.find((d) => d.id === dept)) }, (_, i) => i + 1).map((y) => <Choice key={y} label={t("timetable.yearN", { n: y })} on={year === y} onPress={() => setYear(y)} />)}
                </View>
              </>
            ) : null}
            <Btn variant="primary" title={t("verify.request")} disabled={busy || !dept || !year} onPress={() => void run(async () => after(await auth.request(uid, dept, year)))} />
          </>
        ) : null}
        {step === "done" ? (
          <>
            {student.pending ? <Notice>{t("student.pending", { major: lt(bundle.departments.find((d) => d.id === student.pending!.departmentId)?.name, loc), year: student.pending.year })}</Notice> : null}
            {student.access.kind === "student" ? <Btn variant="primary" title={t("verify.openTimetable")} onPress={() => router.replace("/timetable")} /> : null}
            <Btn title={t("nav.home")} onPress={() => router.replace("/")} />
          </>
        ) : null}
        <T muted size="sm">{t("student.visitorNote")}</T>
      </View>
    </Screen>
  );
}

export default function VerifyScreen() {
  return <Gate>{(b) => <Verify bundle={b} />}</Gate>;
}
