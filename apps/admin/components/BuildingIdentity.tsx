"use client";
import { useRef, useState } from "react";
import { BUILDING_COLORS, BUILDING_ICON_KEYS, BUILDING_ICONS, buildingIconPath } from "@campusnav/tokens";
import { contrastRatio, readableWithWhite, type Building, type OpeningHours } from "@campusnav/core";
import { errorMessage, getAdminSource, useAdmin } from "@/lib/admin";
import { Button, cx } from "./ui";
import { Icon } from "./Icon";

/** Building identity tile: logo, else icon on colour. Same look as the student app. */
export function BuildingMark({ b, size = 40 }: { b: Pick<Building, "icon" | "color" | "logoUrl">; size?: number }) {
  if (b.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={b.logoUrl} alt="" width={size} height={size} className="shrink-0 rounded-md object-contain bg-white border border-line p-0.5" style={{ width: size, height: size }} />;
  }
  return (
    <span className="shrink-0 grid place-items-center rounded-md text-white" style={{ width: size, height: size, background: b.color ?? "var(--cn-accent)" }} aria-hidden>
      <svg viewBox="0 0 24 24" style={{ width: size * 0.55, height: size * 0.55 }} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <path d={buildingIconPath(b.icon)} />
      </svg>
    </span>
  );
}

/**
 * Re-encode an uploaded image to a square PNG of at most 256 px: strips
 * metadata and anything that isn't pixels (SVG scripts, EXIF), and keeps
 * logos small for maps and offline bundles.
 */
async function toLogoPng(file: File): Promise<Blob> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("Use a PNG, JPEG or WebP image.");
  if (file.size > 8_000_000) throw new Error("That image is larger than 8 MB.");
  const bmp = await createImageBitmap(file);
  const side = 256;
  const scale = Math.min(side / bmp.width, side / bmp.height, 1);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  canvas.getContext("2d")!.drawImage(bmp, (side - w) / 2, (side - h) / 2, w, h);
  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not read that image."))), "image/png"));
}

export function IdentityInput({ form, set }: { form: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const { universityId, toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const icon = (form.icon as string | null) ?? "building";
  const color = (form.color as string | null) ?? "#1D4ED8";
  const logoUrl = (form.logoUrl as string | null) ?? null;
  const ratio = /^#[0-9a-fA-F]{6}$/.test(color) ? contrastRatio(color, "#FFFFFF") : 0;

  const upload = async (f: File) => {
    if (!universityId) return;
    setBusy(true);
    try {
      const png = await toLogoPng(f);
      const url = await getAdminSource().uploadBrandImage(universityId, `building-${String(form.code ?? "logo").toLowerCase()}`, png, "image/png");
      set("logoUrl", url);
      toast("Logo added — save the building to keep it");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  };

  return (
    <div className="space-y-4 mb-5" data-testid="identity-input">
      <div className="flex items-center gap-3 cn-panel p-3" aria-label="Preview">
        <BuildingMark b={{ icon, color, logoUrl }} size={48} />
        <span className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface ps-1 pe-2 py-0.5 text-xs font-semibold shadow-sm">
          <BuildingMark b={{ icon, color, logoUrl }} size={20} />
          {String(form.code || "CODE")}
        </span>
        <span className="text-xs text-muted">How students see it on the map and in lists.</span>
      </div>

      <fieldset>
        <legend className="text-sm font-medium mb-2">Logo <span className="text-muted font-normal">(optional — replaces the icon)</span></legend>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="logo-file" aria-label="Building logo" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          <Button className="!min-h-9 text-sm" onClick={() => file.current?.click()} disabled={busy}>
            <Icon name="upload" className="size-4" /> {busy ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
          </Button>
          {logoUrl ? (
            <Button className="!min-h-9 text-sm" onClick={() => set("logoUrl", null)}>
              <Icon name="close" className="size-4" /> Remove logo
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted mt-1">PNG, JPEG or WebP. Resized to 256 px in your browser before upload. Use only logos the university may publish.</p>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium mb-2">Icon</legend>
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5" role="radiogroup" aria-label="Building icon">
          {BUILDING_ICON_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={icon === k}
              aria-label={BUILDING_ICONS[k].label}
              title={BUILDING_ICONS[k].label}
              onClick={() => set("icon", k)}
              className={cx("aspect-square grid place-items-center rounded-md border", icon === k ? "border-accent bg-accent-soft text-accent" : "border-line hover:border-line-strong")}
            >
              <Icon d={BUILDING_ICONS[k].path} className="size-5" />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium mb-2">Colour</legend>
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Building colour">
          {BUILDING_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color.toUpperCase() === c} aria-label={c} title={c} onClick={() => set("color", c)} className={cx("size-8 rounded-md border-2", color.toUpperCase() === c ? "border-fg" : "border-transparent")} style={{ background: c }} />
          ))}
          <label className="flex items-center gap-2 text-sm ms-2">
            Custom
            <input type="color" value={color} onChange={(e) => set("color", e.target.value.toUpperCase())} className="h-8 w-12 bg-bg border border-line-strong" aria-label="Custom colour" />
          </label>
        </div>
        {ratio && !readableWithWhite(color) ? (
          <p className="text-xs text-warn mt-1" role="status">White icons on this colour are hard to read (contrast {ratio.toFixed(1)}:1, needs 4.5:1). Pick a darker colour.</p>
        ) : null}
      </fieldset>
    </div>
  );
}

const DAYS: { d: keyof OpeningHours; label: string }[] = [
  { d: "6", label: "Saturday" },
  { d: "0", label: "Sunday" },
  { d: "1", label: "Monday" },
  { d: "2", label: "Tuesday" },
  { d: "3", label: "Wednesday" },
  { d: "4", label: "Thursday" },
  { d: "5", label: "Friday" },
];

/** Weekly opening hours: one or two intervals per day; empty = closed. */
export function HoursInput({ value, onChange }: { value: OpeningHours | null; onChange: (v: OpeningHours | null) => void }) {
  const h: OpeningHours = value ?? {};
  const setDay = (d: keyof OpeningHours, iv: [string, string][] | undefined) => {
    const next = { ...h };
    if (iv && iv.length) next[d] = iv;
    else delete next[d];
    onChange(Object.keys(next).length ? next : null);
  };
  const copySunday = () => {
    const sun = h["0"];
    if (!sun) return;
    onChange({ ...h, "1": sun, "2": sun, "3": sun, "4": sun });
  };
  return (
    <div className="space-y-1.5 mb-5" data-testid="hours-input">
      {DAYS.map(({ d, label }) => {
        const iv = h[d] ?? [];
        return (
          <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2 w-32">
              <input type="checkbox" className="size-4 accent-[var(--cn-accent)]" checked={iv.length > 0} onChange={(e) => setDay(d, e.target.checked ? [["08:00", "16:00"]] : undefined)} aria-label={`Open on ${label}`} />
              {label}
            </label>
            {iv.length ? (
              iv.map(([a, b], i) => (
                <span key={i} className="flex items-center gap-1">
                  <input type="time" className="cn-input !min-h-8 !py-0" value={a} aria-label={`${label} opens`} onChange={(e) => setDay(d, iv.map((x, j) => (j === i ? [e.target.value, x[1]] : x)) as [string, string][])} />
                  <span aria-hidden>–</span>
                  <input type="time" className="cn-input !min-h-8 !py-0" value={b} aria-label={`${label} closes`} onChange={(e) => setDay(d, iv.map((x, j) => (j === i ? [x[0], e.target.value] : x)) as [string, string][])} />
                  {iv.length > 1 ? (
                    <button type="button" className="text-muted hover:text-fg" aria-label="Remove interval" onClick={() => setDay(d, iv.filter((_, j) => j !== i))}>
                      <Icon name="close" className="size-4" />
                    </button>
                  ) : null}
                </span>
              ))
            ) : (
              <span className="text-muted">Closed</span>
            )}
            {iv.length === 1 ? (
              <button type="button" className="text-xs underline text-muted" onClick={() => setDay(d, [...iv, ["17:00", "20:00"]])}>+ break</button>
            ) : null}
          </div>
        );
      })}
      <div className="flex gap-2 pt-1">
        <Button className="!min-h-8 text-xs" onClick={copySunday} disabled={!h["0"]}>Copy Sunday to Mon–Thu</Button>
        <Button className="!min-h-8 text-xs" onClick={() => onChange(null)} disabled={!value}>Don’t publish hours</Button>
      </div>
      <p className="text-xs text-muted">Students see “Open · closes 16:00” or “Closed · opens Sun 08:00”. With no hours published they see nothing — never a guess.</p>
    </div>
  );
}
