"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lt } from "@campusnav/core";
import { Gate } from "@/components/Gate";
import { Badge, EmptyState, Notice, PageTitle, Row, Section } from "@/components/ui";
import { useApp } from "@/lib/store";
import { floorsOf } from "@/lib/lookup";

/** Campus overview: building footprints (clickable) + building directory. */
export default function CampusMapPage() {
  const { t, prefs } = useApp();
  const router = useRouter();
  return (
    <Gate>
      {(bundle) => {
        const loc = prefs.locale;
        return (
          <div>
            <PageTitle eyebrow={lt(bundle.university.name, loc)}>{t("map.campus")}</PageTitle>
            {bundle.university.dataStatus === "demo" ? (
              <div className="mb-4">
                <Notice tone="warn">{t("map.planDemo")}</Notice>
              </div>
            ) : null}
            {bundle.campuses.map((campus) => {
              const buildings = bundle.buildings.filter((b) => b.campusId === campus.id);
              const w = campus.overviewWidth ?? 1000;
              const h = campus.overviewHeight ?? 700;
              const drawable = buildings.filter((b) => b.overview);
              return (
                <Section key={campus.id} title={lt(campus.name, loc)}>
                  {drawable.length ? (
                    <div className="border border-line bg-[var(--cn-map-bg)] grid-bg">
                      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto max-h-[60vh]" role="img" aria-label={lt(campus.name, loc)} direction="ltr">
                        {drawable.map((b) => (
                          <g
                            key={b.id}
                            role="link"
                            tabIndex={0}
                            aria-label={lt(b.name, loc)}
                            className="cursor-pointer group"
                            onClick={() => router.push(`/buildings/${b.id}`)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") router.push(`/buildings/${b.id}`);
                            }}
                          >
                            <rect x={b.overview!.x} y={b.overview!.y} width={b.overview!.w} height={b.overview!.h} fill="var(--cn-map-room)" stroke="var(--cn-border-strong)" strokeWidth={2} className="group-hover:stroke-[var(--cn-accent)] group-focus:stroke-[var(--cn-accent)]" />
                            <text x={b.overview!.x + 14} y={b.overview!.y + 30} fill="var(--cn-text)" fontSize={22} fontFamily="IBM Plex Mono, monospace">
                              {b.code}
                            </text>
                            <text x={b.overview!.x + 14} y={b.overview!.y + 56} fill="var(--cn-text-muted)" fontSize={16}>
                              {lt(b.name, loc)}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  ) : null}
                  <div className="mt-4">
                    {buildings.length === 0 ? (
                      <EmptyState title={t("map.noFloors")} />
                    ) : (
                      buildings.map((b) => (
                        <Row
                          key={b.id}
                          href={`/buildings/${b.id}`}
                          title={lt(b.name, loc)}
                          subtitle={<span className="mono">{b.code}</span>}
                          meta={
                            <span className="flex items-center gap-2">
                              {t("building.floors", { n: floorsOf(bundle, b.id).length })}
                              {b.dataStatus === "demo" ? <Badge tone="warn">{t("data.demo")}</Badge> : null}
                            </span>
                          }
                        />
                      ))
                    )}
                  </div>
                </Section>
              );
            })}
            <p className="text-sm text-muted mt-6">
              <Link className="underline" href="/search">
                {t("common.search")}
              </Link>
            </p>
          </div>
        );
      }}
    </Gate>
  );
}
