"use client";
import { useEffect, useState } from "react";
import { universitySchema, type University, type Weekday, type Locale } from "@campusnav/core";
import { errorMessage, getAdminSource, useAdmin, useTable } from "@/lib/admin";
import { Field, LocalizedInput, inputCls } from "./Form";
import { Button, ErrorState, Notice, PageTitle, Section, Spinner } from "./ui";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ZONES = ["Asia/Baghdad", "Asia/Tehran", "Europe/Istanbul", "Asia/Riyadh", "Asia/Dubai", "Europe/London", "UTC"];

export function UniversityForm({ mode }: { mode: "profile" | "settings" }) {
  const { can, bump, toast } = useAdmin();
  const { rows, error } = useTable<University>("universities");
  const [u, setU] = useState<University | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (rows?.[0]) setU(structuredClone(rows[0]));
  }, [rows]);
  if (error) return <ErrorState title="Could not load" body={error} />;
  if (!u) return <Spinner label="Loading…" />;
  const editable = mode === "profile" ? can("university.update") : can("university.settings");
  const s = u.settings;
  const setS = (p: Partial<University["settings"]>) => setU({ ...u, settings: { ...s, ...p } });

  const save = async () => {
    const parsed = universitySchema.safeParse(u);
    if (!parsed.success) {
      setErr(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
      return;
    }
    try {
      await getAdminSource().upsert("universities", parsed.data as University);
      setErr(null);
      toast("Saved");
      bump();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="max-w-2xl">
      <PageTitle>{mode === "profile" ? "University" : "Settings"}</PageTitle>
      {!editable ? <div className="mb-4"><Notice tone="warn">Your role can view but not change these values.</Notice></div> : null}
      <fieldset disabled={!editable}>
        {mode === "profile" ? (
          <>
            <Field label="Name *" htmlFor="uname"><LocalizedInput id="uname" value={u.name} onChange={(name) => setU({ ...u, name })} /></Field>
            <Field label="Short name" htmlFor="short"><input id="short" className={inputCls} value={u.shortName} onChange={(e) => setU({ ...u, shortName: e.target.value })} /></Field>
            <Section title="Branding">
              <Field label="Product name shown to students (e.g. SUL NAV)" htmlFor="pname"><input id="pname" className={inputCls} value={u.branding.productName ?? ""} onChange={(e) => setU({ ...u, branding: { ...u.branding, productName: e.target.value || undefined } })} /></Field>
              <Field label="Primary colour" htmlFor="pcolor" hint="Used sparingly for accents in university-branded contexts."><input id="pcolor" type="color" className="h-10 w-20 bg-bg border border-line-strong" value={u.branding.primaryColor ?? "#2BFF88"} onChange={(e) => setU({ ...u, branding: { ...u.branding, primaryColor: e.target.value.toUpperCase() } })} /></Field>
              <Field label="Logo URL (official logo, with permission)" htmlFor="logo"><input id="logo" type="url" className={inputCls} value={u.branding.logoUrl ?? ""} onChange={(e) => setU({ ...u, branding: { ...u.branding, logoUrl: e.target.value || null } })} /></Field>
            </Section>
          </>
        ) : (
          <>
            <Section title="Publication">
              <label className="flex items-center gap-2 text-sm min-h-10"><input type="checkbox" className="size-5" checked={u.published} onChange={(e) => setU({ ...u, published: e.target.checked })} /> Published (visible to the public and visitors)</label>
              <Field label="Data status" htmlFor="ds" hint="Mark as verified only when the university has confirmed the data. Demo is for fictional data.">
                <select id="ds" className={inputCls} value={u.dataStatus} onChange={(e) => setU({ ...u, dataStatus: e.target.value as University["dataStatus"] })}>
                  <option value="unverified">Unverified</option><option value="verified">Verified</option><option value="demo">Demo (fictional)</option>
                </select>
              </Field>
            </Section>
            <Section title="Time & calendar">
              <Field label="Time zone" htmlFor="tz" hint="All timetable times are interpreted in this zone.">
                <select id="tz" className={inputCls} value={s.timezone} onChange={(e) => setS({ timezone: e.target.value })}>
                  {[...new Set([s.timezone, ...ZONES])].map((z) => <option key={z}>{z}</option>)}
                </select>
              </Field>
              <Field label="Weekend days">
                <div className="flex flex-wrap gap-3">
                  {DAYS.map((d, i) => (
                    <label key={d} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={s.weekendDays.includes(i as Weekday)} onChange={(e) => setS({ weekendDays: e.target.checked ? [...s.weekendDays, i as Weekday].sort() : s.weekendDays.filter((x) => x !== i) })} />{d}</label>
                  ))}
                </div>
              </Field>
              <Field label="Timetable visibility" htmlFor="tv">
                <select id="tv" className={inputCls} value={s.timetableVisibility} onChange={(e) => setS({ timetableVisibility: e.target.value as "public" | "members" })}>
                  <option value="members">Signed-in members only</option><option value="public">Public</option>
                </select>
              </Field>
            </Section>
            <Section title="Languages">
              <div className="flex gap-4">
                {(["en", "ckb", "ar"] as Locale[]).map((l) => (
                  <label key={l} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={s.enabledLocales.includes(l)} onChange={(e) => setS({ enabledLocales: e.target.checked ? [...s.enabledLocales, l] : s.enabledLocales.filter((x) => x !== l) })} />{l}</label>
                ))}
              </div>
              <Field label="Default language" htmlFor="dl">
                <select id="dl" className={inputCls} value={s.defaultLocale} onChange={(e) => setS({ defaultLocale: e.target.value as Locale })}>
                  <option value="en">English</option><option value="ckb">Kurdish Sorani</option><option value="ar">Arabic</option>
                </select>
              </Field>
            </Section>
            <Section title="Walking-time assumptions">
              <p className="text-xs text-muted mb-3">Used only to estimate walking time; the UI always labels times as estimates.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Walking speed (m/s)" htmlFor="ws"><input id="ws" type="number" step={0.05} className={inputCls} value={s.walkingSpeedMps} onChange={(e) => setS({ walkingSpeedMps: Number(e.target.value) })} /></Field>
                <Field label="Accessible speed (m/s)" htmlFor="aws"><input id="aws" type="number" step={0.05} className={inputCls} value={s.accessibleWalkingSpeedMps} onChange={(e) => setS({ accessibleWalkingSpeedMps: Number(e.target.value) })} /></Field>
                <Field label="Seconds per floor (stairs)" htmlFor="sps"><input id="sps" type="number" className={inputCls} value={s.stairsSecondsPerFloor} onChange={(e) => setS({ stairsSecondsPerFloor: Number(e.target.value) })} /></Field>
                <Field label="Seconds per floor (elevator)" htmlFor="spe"><input id="spe" type="number" className={inputCls} value={s.elevatorSecondsPerFloor} onChange={(e) => setS({ elevatorSecondsPerFloor: Number(e.target.value) })} /></Field>
              </div>
            </Section>
            <Section title="Prayer times & summer heat">
              <p className="text-xs text-muted mb-3">
                Prayer times are calculated on each phone from the campus location — no internet needed. Pick the convention your campus mosque follows; the app labels the times as calculated. Most Kurdish Muslims follow the Shafi&apos;i school (standard Asr).
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Show prayer times" htmlFor="pe">
                  <select id="pe" className={inputCls} value={s.prayer?.enabled === false ? "no" : "yes"} onChange={(e) => setS({ prayer: { ...s.prayer, enabled: e.target.value === "yes" } })}>
                    <option value="yes">Yes</option><option value="no">No</option>
                  </select>
                </Field>
                <Field label="Calculation method" htmlFor="pm">
                  <select id="pm" className={inputCls} value={s.prayer?.method ?? "mwl"} onChange={(e) => setS({ prayer: { ...s.prayer, method: e.target.value as "mwl" } })}>
                    <option value="mwl">Muslim World League (Fajr 18°, Isha 17°)</option>
                    <option value="egypt">Egyptian authority (19.5°, 17.5°)</option>
                    <option value="karachi">Karachi (18°, 18°)</option>
                    <option value="umm_al_qura">Umm al-Qura (18.5°, Isha +90 min)</option>
                    <option value="isna">ISNA (15°, 15°)</option>
                  </select>
                </Field>
                <Field label="Asr" htmlFor="pa">
                  <select id="pa" className={inputCls} value={s.prayer?.asr ?? "standard"} onChange={(e) => setS({ prayer: { ...s.prayer, asr: e.target.value as "standard" } })}>
                    <option value="standard">Standard — Shafi&apos;i, Maliki, Hanbali</option>
                    <option value="hanafi">Hanafi</option>
                  </select>
                </Field>
                <Field label="Maghrib after sunset (min)" htmlFor="pmo"><input id="pmo" type="number" min={0} max={15} className={inputCls} value={s.prayer?.maghribOffsetMin ?? 0} onChange={(e) => setS({ prayer: { ...s.prayer, maghribOffsetMin: Number(e.target.value) } })} /></Field>
                <Field label="Heat warning from (°C, feels-like)" htmlFor="hw"><input id="hw" type="number" min={25} max={60} className={inputCls} value={s.heatWarningC ?? 38} onChange={(e) => setS({ heatWarningC: Number(e.target.value) })} /></Field>
              </div>
            </Section>
          </>
        )}
      </fieldset>
      {err ? <p role="alert" className="text-danger text-sm whitespace-pre-line mb-3">{err}</p> : null}
      {editable ? <Button type="submit" variant="primary">Save</Button> : null}
    </form>
  );
}
