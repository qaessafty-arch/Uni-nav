"use client";
import { useMemo, useState, type ReactNode } from "react";
import type { ZodType } from "zod";
import { lt, normalizeSearch, type Building, type Campus, type EntityTable, type LocalizedText, type OpeningHours, type Permission } from "@campusnav/core";
import { errorMessage, getAdminSource, newId, useAdmin, useTable } from "@/lib/admin";
import { Badge, Button, EmptyState, ErrorState, PageTitle, Spinner } from "./ui";
import { Field, LocalizedInput, OfficeHoursInput, inputCls } from "./Form";
import { CampusCanvas, type Rect } from "./CampusCanvas";
import { HoursInput, IdentityInput } from "./BuildingIdentity";

export type FieldDef =
  | { key: string; label: string; type: "text" | "email" | "url"; required?: boolean; hint?: string }
  | { key: string; label: string; type: "localized"; required?: boolean; multiline?: boolean }
  | { key: string; label: string; type: "number"; step?: number; hint?: string }
  | { key: string; label: string; type: "boolean" }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; nullable?: boolean }
  | { key: string; label: string; type: "relation"; table: EntityTable; display: (row: Record<string, unknown>) => string; nullable?: boolean; filter?: (row: Record<string, unknown>, form: Record<string, unknown>) => boolean }
  | { key: string; label: string; type: "date" | "time" | "datetime" }
  | { key: string; label: string; type: "officeHours" }
  | { key: string; label: string; type: "rect" }
  | { key: string; label: string; type: "identity" }
  | { key: string; label: string; type: "hours" };

export interface EntityConfig<T extends { id: string }> {
  table: EntityTable;
  title: string;
  singular: string;
  permission: Permission;
  schema: ZodType;
  fields: FieldDef[];
  columns: { label: string; render: (row: T, rel: RelLookup) => ReactNode }[];
  searchText: (row: T) => string;
  defaults: (universityId: string) => Partial<T>;
  sort?: (a: T, b: T) => number;
  intro?: ReactNode;
  /** Extra validation (e.g. conflicts); return error message to block save. */
  beforeSave?: (row: T, all: T[]) => string | null;
}

export type RelLookup = (table: EntityTable, id: string | null | undefined) => Record<string, unknown> | undefined;

function RelationOptions({ field, form }: { field: Extract<FieldDef, { type: "relation" }>; form: Record<string, unknown> }) {
  const { rows } = useTable<Record<string, unknown>>(field.table);
  return (
    <>
      {(rows ?? [])
        .filter((r) => !field.filter || field.filter(r, form))
        .map((r) => (
          <option key={r.id as string} value={r.id as string}>
            {field.display(r)}
          </option>
        ))}
    </>
  );
}

function useRelations(tables: EntityTable[]): RelLookup {
  // Load each related table once for list rendering.
  const a = useTable<Record<string, unknown>>(tables[0] ?? "buildings");
  const b = useTable<Record<string, unknown>>(tables[1] ?? "buildings");
  const c = useTable<Record<string, unknown>>(tables[2] ?? "buildings");
  const d = useTable<Record<string, unknown>>(tables[3] ?? "buildings");
  return useMemo(() => {
    const maps = new Map<EntityTable, Map<string, Record<string, unknown>>>();
    [a, b, c, d].forEach((res, i) => {
      const t = tables[i];
      if (t && res.rows) maps.set(t, new Map(res.rows.map((r) => [r.id as string, r])));
    });
    return (table, id) => (id ? maps.get(table)?.get(id) : undefined);
  }, [a, b, c, d, tables]);
}

export function EntityPage<T extends { id: string; universityId: string }>({ config, relations = [] }: { config: EntityConfig<T>; relations?: EntityTable[] }) {
  const { universityId, can, bump, toast } = useAdmin();
  const { rows, error } = useTable<T>(config.table);
  const rel = useRelations(relations);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const allowed = can(config.permission);

  const list = useMemo(() => {
    let r = rows ?? [];
    if (q.trim()) {
      const nq = normalizeSearch(q);
      r = r.filter((x) => normalizeSearch(config.searchText(x)).includes(nq));
    }
    return config.sort ? [...r].sort(config.sort) : r;
  }, [rows, q, config]);

  if (!universityId) return null;

  const save = async () => {
    if (!editing) return;
    const parsed = config.schema.safeParse(editing);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0] ?? "_")] = i.message === "required" || /received undefined|received null/.test(i.message) ? "Required" : i.message.replace(/_/g, " ");
      setErrors(errs);
      return;
    }
    const extra = config.beforeSave?.(parsed.data as T, rows ?? []);
    if (extra) {
      setErrors({ _: extra });
      return;
    }
    setBusy(true);
    try {
      await getAdminSource().upsert(config.table, parsed.data as T);
      toast(`${config.singular} saved`);
      setEditing(null);
      bump();
    } catch (e) {
      setErrors({ _: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: T) => {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}? It will be hidden from students.`)) return;
    try {
      await getAdminSource().remove(config.table, row.id);
      toast(`${config.singular} deleted`);
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const set = (k: string, v: unknown) => setEditing((f) => ({ ...f!, [k]: v }));

  return (
    <div>
      <PageTitle
        eyebrow={`${rows?.length ?? "…"} records`}
        actions={
          allowed ? (
            <Button
              variant="primary"
              onClick={() => {
                setErrors({});
                setEditing({ id: newId(), universityId, ...config.defaults(universityId) });
              }}
            >
              + New {config.singular.toLowerCase()}
            </Button>
          ) : null
        }
      >
        {config.title}
      </PageTitle>
      {config.intro ? <div className="mb-4 text-sm text-muted">{config.intro}</div> : null}
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${config.title.toLowerCase()}`} aria-label={`Search ${config.title}`} className={`${inputCls} mb-4 max-w-md`} />
      {error ? (
        <ErrorState title="Could not load records" body={errorMessage(error)} />
      ) : rows === null ? (
        <Spinner label="Loading…" />
      ) : list.length === 0 ? (
        <EmptyState title={q ? "No matches." : `No ${config.title.toLowerCase()} yet.`} />
      ) : (
        <div className="cn-tablewrap">
          <table className="cn-table">
            <thead>
              <tr>
                {config.columns.map((c) => (
                  <th key={c.label}>{c.label}</th>
                ))}
                <th className="border-b border-line w-1" />
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id}>
                  {config.columns.map((c) => (
                    <td key={c.label} className="px-3 py-2 align-top">{c.render(row, rel)}</td>
                  ))}
                  <td className="px-3 py-2 whitespace-nowrap text-end">
                    {allowed ? (
                      <>
                        <button className="underline me-3" onClick={() => { setErrors({}); setEditing(structuredClone(row) as unknown as Record<string, unknown>); }}>Edit</button>
                        <button className="underline text-danger" onClick={() => void remove(row)}>Delete</button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px] flex justify-end" role="dialog" aria-modal="true" aria-label={`Edit ${config.singular}`} onKeyDown={(e) => e.key === "Escape" && setEditing(null)}>
          <form
            className="cn-drawer w-full max-w-xl h-full overflow-y-auto p-6 md:p-8 !pb-0"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="cn-display cn-display-md">{(rows ?? []).some((r) => r.id === editing.id) ? "Edit" : "New"} {config.singular.toLowerCase()}</h2>
              <button type="button" className="min-h-11 px-3" onClick={() => setEditing(null)} aria-label="Close">×</button>
            </div>
            {config.fields.map((f) => (
              <FieldInput key={f.key} f={f} form={editing} set={set} error={errors[f.key]} />
            ))}
            {errors._ ? <p role="alert" className="text-danger text-sm mb-4 whitespace-pre-line">{errors._}</p> : null}
            <div className="flex gap-2 sticky bottom-0 bg-bg pt-4 pb-6 md:pb-8 border-t border-line">
              <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
              <Button onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function FieldInput({ f, form, set, error }: { f: FieldDef; form: Record<string, unknown>; set: (k: string, v: unknown) => void; error?: string }) {
  const id = `f-${f.key}`;
  const v = form[f.key];
  switch (f.type) {
    case "localized":
      return (
        <Field label={`${f.label}${f.required ? " *" : ""}`} error={error} htmlFor={id} hint="English is required; Sorani and Arabic are shown to users of those languages.">
          <LocalizedInput id={id} value={v as LocalizedText} onChange={(x) => set(f.key, x)} invalid={!!error} multiline={f.multiline} />
        </Field>
      );
    case "text":
    case "email":
    case "url":
      return (
        <Field label={`${f.label}${f.required ? " *" : ""}`} error={error} htmlFor={id} hint={f.hint}>
          <input id={id} type={f.type} value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value || (f.required ? "" : null))} aria-invalid={!!error} className={inputCls} />
        </Field>
      );
    case "number":
      return (
        <Field label={f.label} error={error} htmlFor={id} hint={f.hint}>
          <input id={id} type="number" step={f.step ?? 1} value={v == null ? "" : String(v)} onChange={(e) => set(f.key, e.target.value === "" ? null : Number(e.target.value))} aria-invalid={!!error} className={inputCls} />
        </Field>
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 mb-4 text-sm min-h-10">
          <input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} className="size-5 accent-[var(--cn-accent)]" />
          {f.label}
        </label>
      );
    case "select":
      return (
        <Field label={f.label} error={error} htmlFor={id}>
          <select id={id} value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value === "" ? null : isNaN(Number(e.target.value)) || f.options.every((o) => isNaN(Number(o.value))) ? e.target.value : Number(e.target.value))} className={inputCls}>
            {f.nullable ? <option value="">—</option> : null}
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      );
    case "relation":
      return (
        <Field label={f.label} error={error} htmlFor={id}>
          <select id={id} value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value || null)} aria-invalid={!!error} className={inputCls}>
            <option value="">{f.nullable ? "—" : "Select…"}</option>
            <RelationOptions field={f} form={form} />
          </select>
        </Field>
      );
    case "date":
    case "time":
      return (
        <Field label={f.label} error={error} htmlFor={id}>
          <input id={id} type={f.type} value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value || null)} aria-invalid={!!error} className={inputCls} />
        </Field>
      );
    case "datetime":
      return (
        <Field label={f.label} error={error} htmlFor={id} hint="Leave empty for no expiry.">
          <input id={id} type="datetime-local" value={v ? new Date(v as string).toISOString().slice(0, 16) : ""} onChange={(e) => set(f.key, e.target.value ? new Date(e.target.value).toISOString() : null)} className={inputCls} />
        </Field>
      );
    case "officeHours":
      return (
        <Field label={f.label} error={error}>
          <OfficeHoursInput value={(v as never) ?? []} onChange={(x) => set(f.key, x)} />
        </Field>
      );
    case "identity":
      return (
        <Field label={f.label} error={error}>
          <IdentityInput form={form} set={set} />
        </Field>
      );
    case "hours":
      return (
        <Field label={f.label} error={error}>
          <HoursInput value={(v as OpeningHours | null) ?? null} onChange={(x) => set(f.key, x)} />
        </Field>
      );
    case "rect":
      return (
        <Field label={f.label} error={error} hint="Draw where this building is on the campus map. You can also place all buildings at once on the Campus map page.">
          <FootprintPicker form={form} value={(v as Rect | null) ?? null} onChange={(r) => set(f.key, r)} />
        </Field>
      );
  }
}

export function L({ v }: { v: unknown }) {
  return <>{lt(v as LocalizedText, "en")}</>;
}

export function StatusBadge({ status }: { status: string }) {
  return status === "demo" ? <Badge tone="warn">demo</Badge> : status === "verified" ? <Badge tone="accent">verified</Badge> : <Badge>unverified</Badge>;
}

/** Building footprint picker: the campus picture with other buildings, draw/move/resize this one. */
function FootprintPicker({ form, value, onChange }: { form: Record<string, unknown>; value: Rect | null; onChange: (r: Rect | null) => void }) {
  const { rows: campuses } = useTable<Campus>("campuses");
  const { rows: buildings } = useTable<Building>("buildings");
  const [draw, setDraw] = useState(!value);
  const campus = campuses?.find((c) => c.id === form.campusId);
  if (!form.campusId) return <p className="text-sm text-muted">Choose the campus first.</p>;
  if (!campus) return <Spinner label="Loading map…" />;
  const id = String(form.id);
  const others = (buildings ?? []).filter((b) => b.campusId === campus.id && b.id !== id);
  return (
    <div className="space-y-2">
      <CampusCanvas
        width={campus.overviewWidth ?? 1000}
        height={campus.overviewHeight ?? 700}
        imageUrl={campus.overviewImageUrl}
        buildings={[...others.map((b) => ({ id: b.id, code: b.code, name: lt(b.name, "en"), overview: b.overview ?? null })), { id, code: String(form.code || "NEW"), name: "", overview: value }]}
        selectedId={id}
        onSelect={() => {}}
        onChange={(_, r) => onChange(r)}
        drawMode={draw}
        onDrawDone={() => setDraw(false)}
        height_="320px"
      />
      <div className="flex flex-wrap gap-2 items-center text-xs">
        <Button className="!min-h-9" variant={draw ? "primary" : "secondary"} aria-pressed={draw} onClick={() => setDraw(!draw)}>
          {value ? "Redraw" : "Draw footprint"}
        </Button>
        {value ? <Button className="!min-h-9" variant="danger" onClick={() => onChange(null)}>Remove from map</Button> : null}
        <span className="text-muted">{draw ? "Drag on the map to outline the building." : value ? "Drag to move · handles to resize" : "Not on the campus map"}</span>
      </div>
    </div>
  );
}
