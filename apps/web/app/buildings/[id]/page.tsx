"use client";
import { useParams } from "next/navigation";
import { lt } from "@campusnav/core";
import { Gate } from "@/components/Gate";
import { BuildingMark, HoursTable, OpenStatusLine } from "@/components/BuildingMark";
import { Badge, ButtonLink, EmptyState, ErrorState, PageTitle, Row, Section } from "@/components/ui";
import { useApp } from "@/lib/store";
import { floorsOf } from "@/lib/lookup";

export default function BuildingPage() {
  const { id } = useParams<{ id: string }>();
  const { t, prefs } = useApp();
  return (
    <Gate>
      {(bundle) => {
        const loc = prefs.locale;
        const b = bundle.buildings.find((x) => x.id === id);
        if (!b) return <ErrorState title={t("error.notFound")} />;
        const floors = floorsOf(bundle, b.id);
        return (
          <div>
            <div className="flex items-start gap-4 mb-6">
              <BuildingMark building={b} size="lg" />
              <div className="min-w-0 flex-1">
                <PageTitle eyebrow={<span className="mono">{b.code}</span>} actions={b.dataStatus === "demo" ? <Badge tone="warn">{t("data.demo")}</Badge> : null}>
                  {lt(b.name, loc)}
                </PageTitle>
                <div className="-mt-6"><OpenStatusLine hours={b.hours} timeZone={bundle.university.settings.timezone} /></div>
              </div>
            </div>
            {b.description ? <p className="text-muted -mt-2 mb-4">{lt(b.description, loc)}</p> : null}
            {b.hours && Object.keys(b.hours).length ? (
              <Section title={t("hours.title")}>
                <div className="max-w-sm"><HoursTable hours={b.hours} /></div>
              </Section>
            ) : null}
            <Section title={t("map.floors")}>
              {floors.length === 0 ? (
                <EmptyState title={t("map.noFloors")} />
              ) : (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {floors
                    .slice()
                    .reverse()
                    .map((f) => {
                      const count = bundle.rooms.filter((r) => r.floorId === f.id).length;
                      return (
                        <ButtonLink key={f.id} href={`/floors/${f.id}`} className="justify-between !min-h-16">
                          <span>{lt(f.name, loc)}</span>
                          <span className="mono text-muted text-xs">{count}</span>
                        </ButtonLink>
                      );
                    })}
                </div>
              )}
            </Section>
            {floors.map((f) => {
              const rooms = bundle.rooms.filter((r) => r.floorId === f.id).sort((a, z) => a.code.localeCompare(z.code, undefined, { numeric: true }));
              if (!rooms.length) return null;
              return (
                <Section key={f.id} title={`${t("building.rooms")} · ${lt(f.name, loc)}`}>
                  <div className="grid md:grid-cols-2 gap-x-8">
                    {rooms.map((r) => (
                      <Row key={r.id} href={`/rooms/${r.id}`} title={<span><span className="mono me-2">{r.code}</span>{lt(r.name, loc)}</span>} meta={t(`roomType.${r.type}`)} />
                    ))}
                  </div>
                </Section>
              );
            })}
          </div>
        );
      }}
    </Gate>
  );
}
