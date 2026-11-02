"use client";
import { useMemo, useState } from "react";
import { closureSchema, isClosureActive, lt, type Building, type Closure, type Floor, type LocalizedText, type NavEdge, type NavNode, type Room } from "@campusnav/core";
import { errorMessage, getAdminSource, newId, useAdmin, useTable } from "@/lib/admin";
import { Field, LocalizedInput } from "@/components/Form";
import { Badge, Button, EmptyState, PageTitle, Spinner } from "@/components/ui";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function ClosuresPage() {
  const { universityId, can, bump, toast } = useAdmin();
  const { rows } = useTable<Closure>("closures");
  const { rows: rooms } = useTable<Room>("rooms");
  const { rows: nodes } = useTable<NavNode>("navigation_nodes");
  const { rows: edges } = useTable<NavEdge>("navigation_edges");
  const { rows: floors } = useTable<Floor>("floors");
  const { rows: buildings } = useTable<Building>("buildings");
  const [type, setType] = useState<Closure["targetType"]>("node");
  const [floorId, setFloorId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState<LocalizedText>({ en: "" });
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date().toISOString()));
  const [endsAt, setEndsAt] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const nodeById = useMemo(() => new Map((nodes ?? []).map((n) => [n.id, n])), [nodes]);
  const floorById = useMemo(() => new Map((floors ?? []).map((f) => [f.id, f])), [floors]);
  const buildingById = useMemo(() => new Map((buildings ?? []).map((b) => [b.id, b])), [buildings]);
  if (!universityId) return null;
  if (!can("map.edit")) return <EmptyState title="Your role cannot manage closures." />;
  if (!rows || !nodes || !edges || !floors || !rooms || !buildings) return <Spinner label="Loading…" />;

  const floorName = (fid: string) => {
    const f = floorById.get(fid);
    return f ? `${buildingById.get(f.buildingId)?.code ?? ""} · ${lt(f.name, "en")}` : "?";
  };
  const nodeName = (n: NavNode) => lt(n.label, "en") || `${n.kind.replace("_", " ")} (${Math.round(n.x)}, ${Math.round(n.y)})`;
  const targetOptions: { value: string; label: string }[] =
    type === "room"
      ? rooms.filter((r) => r.floorId === floorId).map((r) => ({ value: r.id, label: `${r.code} · ${lt(r.name, "en")}` }))
      : type === "node"
        ? nodes.filter((n) => n.floorId === floorId && n.kind !== "corridor").map((n) => ({ value: n.id, label: nodeName(n) }))
        : edges
            .filter((e) => nodeById.get(e.fromNodeId)?.floorId === floorId || nodeById.get(e.toNodeId)?.floorId === floorId)
            .filter((e) => e.kind !== "corridor" || nodeById.get(e.fromNodeId)?.kind !== "corridor" || nodeById.get(e.toNodeId)?.kind !== "corridor")
            .map((e) => ({ value: e.id, label: `${e.kind}: ${nodeName(nodeById.get(e.fromNodeId)!)} → ${nodeName(nodeById.get(e.toNodeId)!)}` }));

  const describe = (c: Closure) => {
    if (c.targetType === "room") {
      const r = rooms.find((x) => x.id === c.targetId);
      return r ? `Room ${r.code} · ${floorName(r.floorId)}` : "Unknown room";
    }
    if (c.targetType === "node") {
      const n = nodeById.get(c.targetId);
      return n ? `${nodeName(n)} · ${floorName(n.floorId)}` : "Unknown point";
    }
    const e = edges.find((x) => x.id === c.targetId);
    const a = e ? nodeById.get(e.fromNodeId) : undefined;
    const b = e ? nodeById.get(e.toNodeId) : undefined;
    return e && a && b ? `${e.kind}: ${nodeName(a)} → ${nodeName(b)} · ${floorName(a.floorId)}` : "Unknown path";
  };

  const save = async () => {
    const c: Closure = { id: newId(), universityId, targetType: type, targetId, reason, startsAt: new Date(startsAt).toISOString(), endsAt: endsAt ? new Date(endsAt).toISOString() : null };
    const parsed = closureSchema.safeParse(c);
    if (!parsed.success) return setErr(parsed.error.issues.map((i) => `${i.path.join(".") || "closure"}: ${i.message}`).join("; "));
    try {
      await getAdminSource().upsert("closures", parsed.data as Closure);
      setErr(null);
      setTargetId("");
      setReason({ en: "" });
      setEndsAt("");
      toast("Closure saved — routes avoid it while it is active");
      bump();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  const now = new Date();
  const sorted = [...rows].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const state = (c: Closure) => (isClosureActive(c, now) ? "active" : Date.parse(c.startsAt) > now.getTime() ? "planned" : "ended");

  return (
    <div>
      <PageTitle eyebrow="Overview">Closures</PageTitle>
      <p className="text-muted max-w-2xl -mt-4 mb-6">
        Temporarily close a path, a point (for example an elevator that is out of service) or a room. Student routes avoid active path and point closures automatically, and users see the reason. Closures with an end time reopen by themselves.
      </p>
      <div className="grid xl:grid-cols-[420px_1fr] gap-6 items-start">
        <section className="cn-panel p-5 space-y-4" aria-labelledby="new-closure">
          <h2 id="new-closure" className="font-semibold">New closure</h2>
          <Field label="What is closed?">
            <div className="cn-segment" role="radiogroup" aria-label="What is closed?">
              {(
                [
                  ["node", "Point (stairs, elevator, door)"],
                  ["edge", "Path segment"],
                  ["room", "Room"],
                ] as const
              ).map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={type === v} onClick={() => { setType(v); setTargetId(""); }}>
                  {l.split(" (")[0]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Floor" htmlFor="cl-floor">
            <select id="cl-floor" className="cn-input w-full" value={floorId} onChange={(e) => { setFloorId(e.target.value); setTargetId(""); }}>
              <option value="">Choose a floor…</option>
              {[...floors].sort((a, b) => floorName(a.id).localeCompare(floorName(b.id))).map((f) => (
                <option key={f.id} value={f.id}>{floorName(f.id)}</option>
              ))}
            </select>
          </Field>
          <Field label={type === "room" ? "Room" : type === "node" ? "Point" : "Path segment"} htmlFor="cl-target">
            <select id="cl-target" className="cn-input w-full" value={targetId} onChange={(e) => setTargetId(e.target.value)} disabled={!floorId}>
              <option value="">Choose…</option>
              {targetOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Reason shown to users" htmlFor="cl-reason">
            <LocalizedInput id="cl-reason" value={reason} onChange={setReason} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts" htmlFor="cl-start">
              <input id="cl-start" type="datetime-local" className="cn-input w-full" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </Field>
            <Field label="Ends (optional)" htmlFor="cl-end">
              <input id="cl-end" type="datetime-local" className="cn-input w-full" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </Field>
          </div>
          {err ? <p role="alert" className="text-danger text-sm">{err}</p> : null}
          <Button variant="primary" className="w-full" disabled={!targetId} onClick={() => void save()}>
            Save closure
          </Button>
        </section>

        <section aria-label="Closures">
          {sorted.length === 0 ? (
            <EmptyState title="No closures." body="Everything on campus is open as far as the app knows." />
          ) : (
            <ul className="space-y-3">
              {sorted.map((c) => {
                const s = state(c);
                return (
                  <li key={c.id} className="cn-panel p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={s === "active" ? "danger" : s === "planned" ? "warn" : "neutral"}>{s === "active" ? "Closed now" : s === "planned" ? "Planned" : "Ended"}</Badge>
                      <Badge>{c.targetType === "edge" ? "path" : c.targetType === "node" ? "point" : "room"}</Badge>
                      <span className="mono text-xs text-muted">
                        {toLocalInput(c.startsAt).replace("T", " ")} → {c.endsAt ? toLocalInput(c.endsAt).replace("T", " ") : "until reopened"}
                      </span>
                    </div>
                    <p className="font-medium mt-2">{lt(c.reason, "en")}</p>
                    <p className="text-sm text-muted">{describe(c)}</p>
                    <div className="mt-3 flex gap-2">
                      {s !== "ended" ? (
                        <Button
                          className="!min-h-9 text-sm"
                          onClick={async () => {
                            try {
                              const end = new Date(Math.max(Date.now(), Date.parse(c.startsAt) + 60_000)).toISOString();
                              await getAdminSource().upsert("closures", { ...c, endsAt: end });
                              toast("Reopened");
                              bump();
                            } catch (e) {
                              toast(errorMessage(e), "error");
                            }
                          }}
                        >
                          Reopen now
                        </Button>
                      ) : null}
                      <Button
                        variant="danger"
                        className="!min-h-9 text-sm"
                        onClick={async () => {
                          if (!window.confirm("Delete this closure?")) return;
                          try {
                            await getAdminSource().remove("closures", c.id);
                            toast("Closure deleted");
                            bump();
                          } catch (e) {
                            toast(errorMessage(e), "error");
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
