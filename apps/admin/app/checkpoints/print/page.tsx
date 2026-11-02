"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import QRCode from "qrcode";
import { checkpointUrl, lt, type QrCheckpoint, type University } from "@campusnav/core";
import { STUDENT_APP_URL, useAdmin, useTable } from "@/lib/admin";
import { Button, Spinner } from "@/components/ui";

/** Printable A4 sheet of checkpoint signs. Only authorised admins can load tokens (RLS). */
function PrintInner() {
  const only = useSearchParams().get("id");
  const { can } = useAdmin();
  const { rows } = useTable<QrCheckpoint>("qr_checkpoints");
  const { rows: unis } = useTable<University>("universities");
  const [svgs, setSvgs] = useState<Record<string, string>>({});
  const list = (rows ?? []).filter((c) => c.status === "active" && (!only || c.id === only));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const cp of list) out[cp.id] = await QRCode.toString(checkpointUrl(STUDENT_APP_URL, cp.token), { type: "svg", errorCorrectionLevel: "M", margin: 1 });
      if (!cancelled) setSvgs(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, only]);

  if (!can("checkpoint.manage")) return <p>Permission denied.</p>;
  if (!rows) return <Spinner label="Loading…" />;
  const uni = unis?.[0];
  return (
    <div>
      <div className="no-print flex items-center gap-3 mb-6">
        <Button variant="primary" onClick={() => window.print()}>Print</Button>
        <span className="text-sm text-muted">{list.length} signs · links point to {STUDENT_APP_URL}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 print:gap-0">
        {list.map((cp) => (
          <div key={cp.id} className="border-2 border-fg print:border-black p-5 break-inside-avoid flex flex-col items-center text-center bg-white text-black">
            <div className="w-full flex justify-between text-[10px] font-mono tracking-widest">
              <span>CAMPUS NAV</span>
              <span>{uni?.branding.productName ?? uni?.shortName}</span>
            </div>
            <div className="w-48 h-48 my-3" dangerouslySetInnerHTML={{ __html: svgs[cp.id] ?? "" }} aria-label="QR code" />
            <div className="font-bold text-lg leading-tight">{lt(cp.label, "en")}</div>
            {cp.label.ckb ? <div dir="rtl" lang="ckb" className="text-base">{cp.label.ckb}</div> : null}
            {cp.label.ar ? <div dir="rtl" lang="ar" className="text-base">{cp.label.ar}</div> : null}
            <div className="mt-2 text-xs">Scan to see where you are · سکان بکە · امسح الرمز</div>
            <div className="mt-1 font-mono text-[11px] tracking-wider">{cp.token}</div>
            {uni?.dataStatus === "demo" ? <div className="mt-2 text-[10px] font-mono border border-black px-1">DEMO — NOT AN OFFICIAL SIGN</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense>
      <PrintInner />
    </Suspense>
  );
}
