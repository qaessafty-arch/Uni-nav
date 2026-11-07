"use client";
import { useApp } from "@/lib/store";
import { NullTechMark } from "./NullTechMark";

/** Studio credit shown at the foot of every page. */
export function PoweredBy({ className = "" }: { className?: string }) {
  const { t } = useApp();
  return (
    <p className={`flex items-center justify-center gap-2 text-[11px] text-faint ${className}`} data-testid="powered-by">
      <span>{t("brand.poweredBy")}</span>
      <span className="inline-flex items-center gap-1.5 mono font-semibold tracking-[0.2em] text-muted" dir="ltr">
        <NullTechMark size={16} /> {t("brand.studio")}
      </span>
    </p>
  );
}

/** Faint corner mark on maps. Never intercepts taps; sits clear of the map attribution. */
export function MapWatermark() {
  const { t } = useApp();
  return (
    <span aria-hidden className="pointer-events-none select-none absolute left-2 bottom-2 z-[5] inline-flex items-center gap-1.5 mono text-[10px] font-semibold tracking-[0.25em] text-fg/40" dir="ltr" data-testid="map-watermark">
      <span className="opacity-70 inline-flex"><NullTechMark size={14} /></span> {t("brand.studio")}
    </span>
  );
}
