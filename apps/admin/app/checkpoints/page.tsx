"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { checkpointUrl, generateCheckpointToken, lt, qrCheckpointSchema, type Floor, type LocalizedText, type NavNode, type QrCheckpoint } from "@campusnav/core";
import { errorMessage, getAdminSource, newId, STUDENT_APP_URL, useAdmin, useTable } from "@/lib/admin";
import { Field, LocalizedInput, inputCls } from "@/components/Form";
import { Badge, Button, ButtonLink, EmptyState, PageTitle, Spinner } from "@/components/ui";

export default function CheckpointsPage() {
  const { universityId, bump, toast, can } = useAdmin();
  const { rows } = useTable<QrCheckpoint>("qr_checkpoints");
  const { rows: nodes } = useTable<NavNode>("navigation_nodes");
  const { rows: floors } = useTable<Floor>("floors");
  const [floorId, setFloorId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [label, setLabel] = useState<LocalizedText>({ en: "" });
  const [expiresAt, setExpiresAt] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const nodeById = useMemo(() => new Map((nodes ?? []).map((n) => [n.id, n])), [nodes]);
  const floorById = useMemo(() => new Map((floors ?? []).map((f) => [f.id, f])), [floors]);
  if (!universityId) return null;

  const create = async () => {
    const cp: QrCheckpoint = { id: newId(), universityId, token: generateCheckpointToken(), nodeId, label, status: "active", expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null };
    const parsed = qrCheckpointSchema.safeParse(cp);
    if (!parsed.success) return setErr(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    try {
      await getAdminSource().upsert("qr_checkpoints", parsed.data as QrCheckpoint);
      setErr(null);
      setLabel({ en: "" });
      toast("Checkpoint created");
      bump();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  const update = async (cp: QrCheckpoint, patch: Partial<QrCheckpoint>, msg: string) => {
    try {
      await getAdminSource().upsert("qr_checkpoints", { ...cp, ...patch });
      toast(msg);
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const now = Date.now();
  return (
    <div>
      <PageTitle actions={<ButtonLink href="/checkpoints/print" variant="primary">Print QR sheet</ButtonLink>}>QR checkpoints</PageTitle>
      <p className="text-sm text-muted mb-6 max-w-3xl">
        Each checkpoint QR encodes only an opaque random token in a link to the student app ({STUDENT_APP_URL}/q/…). The token contains no location or private data and is validated against the database on every scan. Disable or rotate a token if a sign is removed or copied.
      </p>
      {can("checkpoint.manage") ? (
        <form className="border border-line p-4 mb-8 grid lg:grid-cols-2 gap-x-6" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <div>
            <Field label="Floor" htmlFor="cpf">
              <select id="cpf" className={inputCls} value={floorId} onChange={(e) => { setFloorId(e.target.value); setNodeId(""); }}>
                <option value="">Select…</option>
                {(floors ?? []).map((f) => <option key={f.id} value={f.id}>L{f.level} — {lt(f.name, "en")}</option>)}
              </select>
            </Field>
            <Field label="Location (navigation node)" htmlFor="cpn" hint="Place checkpoints at entrances, stairs, elevators and corridor junctions. Create nodes in the Map editor.">
              <select id="cpn" className={inputCls} value={nodeId} onChange={(e) => setNodeId(e.target.value)} disabled={!floorId}>
                <option value="">Select…</option>
                {(nodes ?? []).filter((n) => n.floorId === floorId).map((n) => <option key={n.id} value={n.id}>{n.kind.replace("_", " ")} @ {Math.round(n.x)},{Math.round(n.y)} {lt(n.label, "en")}</option>)}
              </select>
            </Field>
            <Field label="Expires (optional)" htmlFor="cpx"><input id="cpx" type="datetime-local" className={inputCls} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></Field>
          </div>
          <div>
            <Field label="Label shown after scanning *" htmlFor="cpl"><LocalizedInput id="cpl" value={label} onChange={setLabel} /></Field>
            {err ? <p role="alert" className="text-danger text-sm mb-3">{err}</p> : null}
            <Button type="submit" variant="primary" disabled={!nodeId || !label.en.trim()}>Create checkpoint</Button>
          </div>
        </form>
      ) : null}
      {!rows ? <Spinner label="Loading…" /> : rows.length === 0 ? <EmptyState title="No checkpoints yet." /> : (
        <div className="border border-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface"><tr>{["Label", "Location", "Status", "Link", ""].map((h) => <th key={h} className="text-start px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((cp) => {
                const n = nodeById.get(cp.nodeId);
                const f = n ? floorById.get(n.floorId) : undefined;
                const expired = cp.expiresAt && Date.parse(cp.expiresAt) <= now;
                return (
                  <tr key={cp.id} className="border-t border-line">
                    <td className="px-3 py-2">{lt(cp.label, "en")}</td>
                    <td className="px-3 py-2 text-xs">{f ? `L${f.level} · ${lt(f.name, "en")}` : <Badge tone="danger">missing node</Badge>} {n ? <span className="text-muted">· {n.kind}</span> : null}</td>
                    <td className="px-3 py-2">{cp.status === "disabled" ? <Badge tone="danger">disabled</Badge> : expired ? <Badge tone="warn">expired</Badge> : <Badge tone="accent">active</Badge>}</td>
                    <td className="px-3 py-2 mono text-xs break-all">{checkpointUrl(STUDENT_APP_URL, cp.token)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-end space-x-3">
                      <Link className="underline" href={`/checkpoints/print?id=${cp.id}`}>Print</Link>
                      <button className="underline" onClick={() => void update(cp, { status: cp.status === "active" ? "disabled" : "active" }, cp.status === "active" ? "Disabled" : "Enabled")}>{cp.status === "active" ? "Disable" : "Enable"}</button>
                      <button className="underline" onClick={() => window.confirm("Rotate token? Printed codes for this checkpoint will stop working.") && void update(cp, { token: generateCheckpointToken() }, "Token rotated — reprint this sign")}>Rotate</button>
                      <button className="underline text-danger" onClick={async () => { if (!window.confirm("Delete checkpoint?")) return; try { await getAdminSource().remove("qr_checkpoints", cp.id); bump(); } catch (e) { toast(errorMessage(e), "error"); } }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
