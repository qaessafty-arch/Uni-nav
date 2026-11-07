"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { lt, normalizeSearch, openStatus, type CampusBundle, type RoomType } from "@campusnav/core";
import { Gate } from "@/components/Gate";
import { BuildingMark, OpenStatusLine } from "@/components/BuildingMark";
import { FACILITIES } from "@/components/Blocks";
import { Icon } from "@/components/Icon";
import { I } from "@/components/icons";
import { ButtonLink, EmptyState, PageTitle } from "@/components/ui";
import { useApp } from "@/lib/store";
import { floorsOf } from "@/lib/lookup";

function Directory({ bundle }: { bundle: CampusBundle }) {
  const { t, prefs } = useApp();
  const loc = prefs.locale;
  const tz = bundle.university.settings.timezone;
  const [q, setQ] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const now = useMemo(() => new Date(), []);
  const query = normalizeSearch(q);
  const list = bundle.buildings
    .filter((b) => !query || normalizeSearch(`${b.code} ${lt(b.name, "en")} ${lt(b.name, "ckb")} ${lt(b.name, "ar")}`).includes(query))
    .filter((b) => !openOnly || openStatus(b.hours, now, tz)?.open)
    .sort((a, z) => lt(a.name, loc).localeCompare(lt(z.name, loc)));
  return (
    <div>
      <p className="text-muted max-w-2xl -mt-2 mb-4">{t("buildings.subtitle")}</p>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <label className="cn-input flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
          <Icon d={I.search} className="size-4 text-muted" />
          <input className="bg-transparent outline-none flex-1 min-w-0" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.title")} aria-label={t("search.title")} />
        </label>
        <button type="button" className="cn-chip !min-h-10" aria-pressed={openOnly} onClick={() => setOpenOnly((v) => !v)}>
          <Icon name="clock" className="size-4" /> {t("buildings.openNow")}
        </button>
      </div>
      {list.length === 0 ? (
        <EmptyState title={t("buildings.none")} />
      ) : (
        <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="building-cards">
          {list.map((b) => {
            const floors = floorsOf(bundle, b.id);
            const rooms = bundle.rooms.filter((r) => r.buildingId === b.id);
            const types = new Set<RoomType>(rooms.map((r) => r.type));
            const inside = FACILITIES.filter((f) => types.has(f.type)).slice(0, 5);
            const entrance = bundle.navNodes.find((n) => n.kind === "building_entrance" && floors.some((f) => f.id === n.floorId));
            return (
              <li key={b.id} className="cn-card p-4 flex flex-col gap-3">
                <Link href={`/buildings/${b.id}`} className="flex items-start gap-3 group">
                  <BuildingMark building={b} size="lg" />
                  <span className="min-w-0">
                    <span className="block mono text-xs text-muted">{b.code}</span>
                    <span className="block font-semibold leading-snug group-hover:underline">{lt(b.name, loc)}</span>
                    <span className="block text-xs text-muted mt-0.5">
                      {floors.length === 1 ? t("explore.floorOne") : t("explore.floorsCount", { n: floors.length })} · {t("explore.roomsCount", { n: rooms.length })}
                    </span>
                  </span>
                </Link>
                <OpenStatusLine hours={b.hours} timeZone={tz} />
                {inside.length ? (
                  <div className="flex items-center gap-1.5 text-muted" aria-label={t("buildings.inside")}>
                    {inside.map((f) => (
                      <span key={f.type} className="size-8 grid place-items-center rounded-md bg-[var(--cn-surface-sunken)]" title={t(`roomType.${f.type}`)}>
                        <Icon d={f.icon} className="size-4" label={t(`roomType.${f.type}`)} />
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <ButtonLink href={`/?b=${b.id}`} className="!min-h-9 text-sm"><Icon d={I.map} className="size-4" /> {t("common.viewOnMap")}</ButtonLink>
                  {entrance ? (
                    <ButtonLink href={`/navigate?to=node:${entrance.id}`} variant="primary" className="!min-h-9 text-sm"><Icon d={I.route} className="size-4" /> {t("common.navigate")}</ButtonLink>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function BuildingsPage() {
  const { t } = useApp();
  return (
    <div>
      <PageTitle eyebrow={t("nav.buildings")}>{t("buildings.title")}</PageTitle>
      <Gate>{(bundle) => <Directory bundle={bundle} />}</Gate>
    </div>
  );
}
