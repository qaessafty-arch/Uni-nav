"use client";
import { useEffect, useRef, useState } from "react";
import { BUILDING_COLORS, ICONS } from "@campusnav/tokens";
import { contrastRatio, HOME_FEATURES, readableWithWhite, ROOM_TYPES, universitySchema, type Building, type HomeFeature, type RoomType, type University } from "@campusnav/core";
import { errorMessage, getAdminSource, useAdmin, useTable } from "@/lib/admin";
import { BuildingMark } from "@/components/BuildingIdentity";
import { Icon } from "@/components/Icon";
import { Button, ErrorState, Notice, PageTitle, Section, Spinner, cx } from "@/components/ui";

const FEATURE_TEXT: Record<HomeFeature, { title: string; body: string }> = {
  prayer: { title: "Prayer times", body: "Next prayer for the campus, nearest prayer room, Ramadan iftar countdown." },
  leaveBy: { title: "“Leave by” coach", body: "When to set off for the next class, from the student's location." },
  freeRooms: { title: "Free rooms", body: "Empty lecture rooms now, from the timetable." },
  shareLocation: { title: "Send my location", body: "Students share a directions link to where they are (no GPS)." },
  closures: { title: "Closures banner", body: "Active and upcoming closures on the home screen." },
  heatWarning: { title: "Heat warning", body: "Warn about outdoor walking on hot days (live temperature)." },
  buildingDirectory: { title: "Building directory", body: "A page listing every building with hours and facilities." },
};

const DEFAULT_FACILITIES: RoomType[] = ["toilet", "prayer_room", "cafeteria", "library", "laboratory", "lecture_hall", "office"];
const ROOM_LABEL: Record<RoomType, string> = {
  lecture_hall: "Lecture halls", classroom: "Classrooms", laboratory: "Labs", office: "Offices", library: "Library", cafeteria: "Cafeteria",
  toilet: "Toilets", prayer_room: "Prayer rooms", service: "Student services", storage: "Storage", other: "Other",
};
const ROOM_ICON: Partial<Record<RoomType, string>> = {
  toilet: ICONS.toilet, prayer_room: ICONS.prayer, cafeteria: ICONS.cafe, library: ICONS.library, laboratory: ICONS.lab, lecture_hall: ICONS.hall, office: ICONS.office, classroom: ICONS.hall, service: ICONS.ask,
};

async function toPng(file: File, side: number): Promise<Blob> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("Use a PNG, JPEG or WebP image.");
  const bmp = await createImageBitmap(file);
  const scale = Math.min(side / bmp.width, side / bmp.height, 1);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not read that image."))), "image/png"));
}

/** Phone-sized preview of the student home screen with the current choices. */
function Preview({ u, buildings }: { u: University; buildings: Building[] }) {
  const accent = u.branding.primaryColor && readableWithWhite(u.branding.primaryColor) ? u.branding.primaryColor : "#1D4ED8";
  const f = (k: HomeFeature) => u.settings.features?.[k] !== false;
  const chips = u.settings.homeFacilities?.length ? u.settings.homeFacilities : DEFAULT_FACILITIES.slice(0, 4);
  return (
    <div className="mx-auto w-[300px] rounded-[28px] border-[6px] border-[#1F2937] bg-[#F6F7F9] text-[#111827] overflow-hidden shadow-xl" aria-label="Student app preview" data-testid="appearance-preview">
      <div className="flex items-center gap-2 px-3 h-12 bg-white border-b border-[#E5E7EB]">
        {u.branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.branding.logoUrl} alt="" className="size-7 object-contain" />
        ) : (
          <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden><rect x="1" y="1" width="22" height="22" fill="none" stroke="#111827" strokeWidth="2" /><path d="M6 18 L6 10 L14 10 L14 6" fill="none" stroke={accent} strokeWidth="2.5" /><rect x="15.5" y="15.5" width="3" height="3" fill={accent} /></svg>
        )}
        <span className="font-mono font-semibold tracking-[0.1em] text-[12px]">{u.branding.productName || u.shortName}</span>
      </div>
      <div className="p-3 space-y-2.5 text-[12px]">
        <div className="rounded-lg bg-white border border-[#E5E7EB] px-3 py-2 text-[#6B7280]">Room, lecturer, building…</div>
        <div className="flex gap-1.5 overflow-hidden">
          {chips.slice(0, 4).map((c) => (
            <span key={c} className="flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-2 py-1 whitespace-nowrap">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={ROOM_ICON[c] ?? ICONS.building} /></svg>
              {ROOM_LABEL[c]}
            </span>
          ))}
        </div>
        {f("prayer") ? (
          <div className="rounded-lg bg-white border border-[#E5E7EB] p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-[#6B7280]">Prayer times</div>
            <div className="font-semibold">Asr in 1h 12m</div>
          </div>
        ) : null}
        {f("leaveBy") ? (
          <div className="rounded-lg bg-white border border-[#E5E7EB] border-s-4 p-2.5 flex items-center justify-between" style={{ borderInlineStartColor: accent }}>
            <span className="font-semibold" style={{ color: accent }}>Leave in 9m</span>
            <span className="rounded-md px-2 py-1 text-white" style={{ background: accent }}>Navigate</span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-1.5">
          {f("freeRooms") ? <span className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-center">Find an empty room</span> : null}
          {f("shareLocation") ? <span className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-center">Send my location</span> : null}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#6B7280] mb-1">Buildings</div>
          {buildings.slice(0, 4).map((b) => (
            <div key={b.id} className="flex items-center gap-2 py-1">
              <BuildingMark b={b} size={24} />
              <span className="truncate">{b.name.en}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AppearancePage() {
  const { can, bump, toast, universityId } = useAdmin();
  const { rows, error } = useTable<University>("universities");
  const buildings = useTable<Building>("buildings").rows ?? [];
  const [u, setU] = useState<University | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (rows?.[0]) setU(structuredClone(rows[0]));
  }, [rows]);
  if (error) return <ErrorState title="Could not load" body={error} />;
  if (!u) return <Spinner label="Loading…" />;
  const editable = can("university.settings") && can("university.update");
  const s = u.settings;
  const setS = (p: Partial<University["settings"]>) => setU({ ...u, settings: { ...s, ...p } });
  const setB = (p: Partial<University["branding"]>) => setU({ ...u, branding: { ...u.branding, ...p } });
  const color = u.branding.primaryColor ?? "#1D4ED8";
  const ratio = /^#[0-9a-fA-F]{6}$/.test(color) ? contrastRatio(color, "#FFFFFF") : 0;
  const facilities = s.homeFacilities?.length ? s.homeFacilities : DEFAULT_FACILITIES;

  const uploadLogo = async (f: File) => {
    if (!universityId) return;
    setBusy(true);
    try {
      const url = await getAdminSource().uploadBrandImage(universityId, "university-logo", await toPng(f, 256), "image/png");
      setB({ logoUrl: url });
      toast("Logo added — save to publish it");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  };
  const moveFacility = (t: RoomType, dir: -1 | 1) => {
    const list = [...facilities];
    const i = list.indexOf(t);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    setS({ homeFacilities: list });
  };
  const toggleFacility = (t: RoomType, on: boolean) => setS({ homeFacilities: on ? [...facilities, t].slice(0, 8) : facilities.filter((x) => x !== t) });

  const save = async () => {
    const parsed = universitySchema.safeParse(u);
    if (!parsed.success) return toast(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "error");
    try {
      await getAdminSource().upsert("universities", parsed.data as University);
      toast("Appearance saved — students see it on their next refresh");
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <div>
      <PageTitle eyebrow="Customize" actions={editable ? <Button variant="primary" onClick={() => void save()}>Save appearance</Button> : null}>
        Appearance & home screen
      </PageTitle>
      <p className="text-muted max-w-3xl -mt-4 mb-6">Make the student app look like your university and choose what students see first. The preview updates as you change things.</p>
      {!editable ? <div className="mb-4 max-w-3xl"><Notice tone="warn">You can view these settings but not change them.</Notice></div> : null}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <fieldset disabled={!editable} className="space-y-6 min-w-0">
          <Section title="Brand">
            <div className="grid md:grid-cols-2 gap-5">
              <label className="block text-sm">
                App name shown to students
                <input className="cn-input w-full mt-1" value={u.branding.productName ?? ""} maxLength={40} onChange={(e) => setB({ productName: e.target.value || undefined })} placeholder="e.g. SUL NAV" aria-label="App name" />
              </label>
              <div className="text-sm">
                University logo
                <div className="flex items-center gap-2 mt-1">
                  {u.branding.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.branding.logoUrl} alt="" className="size-10 object-contain rounded-md border border-line bg-white" />
                  ) : (
                    <span className="size-10 grid place-items-center rounded-md border border-dashed border-line-strong text-muted"><Icon name="image" /></span>
                  )}
                  <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="University logo" onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])} />
                  <Button className="!min-h-9 text-sm" onClick={() => file.current?.click()} disabled={busy}><Icon name="upload" className="size-4" /> {busy ? "Uploading…" : u.branding.logoUrl ? "Replace" : "Upload"}</Button>
                  {u.branding.logoUrl ? <Button className="!min-h-9 text-sm" onClick={() => setB({ logoUrl: null })}>Remove</Button> : null}
                </div>
                <p className="text-xs text-muted mt-1">Only the official logo, with permission. Resized to 256 px.</p>
              </div>
            </div>
            <div className="mt-5">
              <div className="text-sm mb-2">Brand colour <span className="text-muted">(buttons, route line, selection)</span></div>
              <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Brand colour">
                {BUILDING_COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={color.toUpperCase() === c} aria-label={c} title={c} onClick={() => setB({ primaryColor: c })} className={cx("size-8 rounded-md border-2", color.toUpperCase() === c ? "border-fg" : "border-transparent")} style={{ background: c }} />
                ))}
                <label className="flex items-center gap-2 text-sm ms-2">
                  Custom
                  <input type="color" value={color} onChange={(e) => setB({ primaryColor: e.target.value.toUpperCase() })} className="h-8 w-12 bg-bg border border-line-strong" aria-label="Custom brand colour" />
                </label>
              </div>
              <p className={cx("text-xs mt-1", ratio && !readableWithWhite(color) ? "text-warn" : "text-muted")} role="status" data-testid="contrast">
                {ratio && !readableWithWhite(color)
                  ? `Contrast with white text is ${ratio.toFixed(1)}:1 — below 4.5:1, so students keep the default blue until you pick a darker colour.`
                  : `Contrast with white text: ${ratio.toFixed(1)}:1 (meets WCAG AA). Dark mode uses a lighter tint automatically.`}
              </p>
            </div>
          </Section>

          <Section title="Home screen features">
            <ul className="grid md:grid-cols-2 gap-2" data-testid="feature-toggles">
              {HOME_FEATURES.map((k) => {
                const on = s.features?.[k] !== false;
                return (
                  <li key={k}>
                    <label className={cx("flex items-start gap-3 cn-panel p-3 cursor-pointer", on && "border-accent")}>
                      <input type="checkbox" className="size-5 mt-0.5 accent-[var(--cn-accent)]" checked={on} onChange={(e) => setS({ features: { ...(s.features ?? {}), [k]: e.target.checked } })} aria-label={FEATURE_TEXT[k].title} />
                      <span>
                        <span className="block font-medium text-sm">{FEATURE_TEXT[k].title}</span>
                        <span className="block text-xs text-muted">{FEATURE_TEXT[k].body}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="Facility shortcuts">
            <p className="text-xs text-muted mb-2">The quick buttons on the home screen (e.g. Toilets, Prayer room). Up to 8, in this order. Shortcuts only appear when such rooms exist.</p>
            <ul className="cn-panel divide-y divide-[var(--cn-border)]" data-testid="facility-list">
              {[...facilities, ...ROOM_TYPES.filter((r) => !facilities.includes(r))].map((t) => {
                const on = facilities.includes(t);
                return (
                  <li key={t} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--cn-accent)]" checked={on} onChange={(e) => toggleFacility(t, e.target.checked)} aria-label={ROOM_LABEL[t]} />
                    <Icon d={ROOM_ICON[t] ?? ICONS.building} className={cx("size-4", on ? "text-accent" : "text-muted")} />
                    <span className={cx("flex-1", !on && "text-muted")}>{ROOM_LABEL[t]}</span>
                    {on ? (
                      <span className="flex gap-1">
                        <Button className="!min-h-7 !px-2" aria-label={`Move ${ROOM_LABEL[t]} up`} onClick={() => moveFacility(t, -1)}><Icon d="M12 19V5M6 11l6-6 6 6" className="size-4" /></Button>
                        <Button className="!min-h-7 !px-2" aria-label={`Move ${ROOM_LABEL[t]} down`} onClick={() => moveFacility(t, 1)}><Icon d="M12 5v14M6 13l6 6 6-6" className="size-4" /></Button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="Map">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="First map view">
              {([[null, "Automatic"], ["map", "Real map"], ["3d", "3D"], ["2d", "Plan"]] as const).map(([v, label]) => (
                <button key={label} type="button" role="radio" aria-checked={(s.defaultView ?? null) === v} onClick={() => setS({ defaultView: v })} className={cx("cn-chip !min-h-9", (s.defaultView ?? null) === v && "!border-accent !text-accent")}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-2">Automatic: real map when the campus is placed, otherwise 3D on computers and the plan on phones. Devices without 3D support always get the plan.</p>
          </Section>
        </fieldset>
        <aside className="xl:sticky xl:top-20">
          <Preview u={u} buildings={buildings} />
        </aside>
      </div>
    </div>
  );
}
