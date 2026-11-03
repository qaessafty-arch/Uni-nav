"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isClosureActive, lt, occurrencesOn, zonedNow } from "@campusnav/core";
import { FloorMap } from "@campusnav/map-web";
import { Gate } from "@/components/Gate";
import { LectureCard } from "@/components/LectureCard";
import { mapLabels } from "@/components/MapLabels";
import { Badge, Button, ButtonLink, ErrorState, Notice, Section } from "@/components/ui";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const { t, prefs, saved, toggleSaved } = useApp();
  return (
    <Gate>
      {(bundle) => {
        const loc = prefs.locale;
        const l = lookup(bundle);
        const room = l.rooms.get(id);
        if (!room) return <ErrorState title={t("error.notFound")} />;
        const building = l.buildings.get(room.buildingId);
        const floor = l.floors.get(room.floorId);
        const dept = room.departmentId ? l.departments.get(room.departmentId) : undefined;
        const today = zonedNow(new Date(), bundle.university.settings.timezone).date;
        const lectures = occurrencesOn(today, bundle.timetable, bundle.scheduleChanges, { roomId: room.id });
        const officeOf = bundle.lecturers.filter((x) => x.officeRoomId === room.id);
        const isSaved = saved.includes(room.id);
        const closedNow = (bundle.closures ?? []).find((c) => c.targetType === "room" && c.targetId === room.id && isClosureActive(c, new Date()));
        return (
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 items-start">
            <div>
              <div className="label-caps">
                <Link href={`/buildings/${building?.id}`} className="hover:text-fg">
                  {building?.code}
                </Link>{" "}
                ·{" "}
                <Link href={`/floors/${floor?.id}?room=${room.id}`} className="hover:text-fg">
                  {lt(floor?.name, loc)}
                </Link>
              </div>
              <h1 className="cn-figure text-4xl md:text-5xl mt-2">{room.code}</h1>
              {closedNow ? (
                <div className="mt-3">
                  <Notice tone="warn">{t("room.closedNow", { reason: lt(closedNow.reason, loc) })}</Notice>
                </div>
              ) : null}
              <p className="text-xl mt-3">{lt(room.name, loc)}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge>{t(`roomType.${room.type}`)}</Badge>
                {room.dataStatus === "demo" ? <Badge tone="warn">{t("data.demo")}</Badge> : room.dataStatus === "verified" ? <Badge tone="accent">{t("data.verified")}</Badge> : <Badge>{t("data.unverified")}</Badge>}
                {room.accessible ? <Badge tone="info">{t("room.accessible")}</Badge> : null}
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-y-3 text-sm border-t border-line pt-4">
                <dt className="text-muted">{t("common.building")}</dt>
                <dd>{lt(building?.name, loc)}</dd>
                <dt className="text-muted">{t("common.floor")}</dt>
                <dd>{lt(floor?.name, loc)}</dd>
                {dept ? (
                  <>
                    <dt className="text-muted">{t("common.department")}</dt>
                    <dd>{lt(dept.name, loc)}</dd>
                  </>
                ) : null}
                <dt className="text-muted">{t("room.type")}</dt>
                <dd>
                  {t(`roomType.${room.type}`)}
                  {room.capacity ? <span className="text-muted"> · {t("common.capacity", { n: room.capacity })}</span> : null}
                </dd>
              </dl>

              <div className="flex flex-wrap gap-2 mt-6">
                {room.entranceNodeId ? (
                  <ButtonLink href={`/navigate?to=${room.id}`} variant="primary" className="flex-1 sm:flex-none">
                    {t("common.navigate")}
                  </ButtonLink>
                ) : null}
                <ButtonLink href={`/floors/${room.floorId}?room=${room.id}`}>{t("common.viewOnMap")}</ButtonLink>
                <Button onClick={() => toggleSaved(room.id)} aria-pressed={isSaved}>
                  {isSaved ? `★ ${t("common.saved_location")}` : `☆ ${t("common.save_location")}`}
                </Button>
              </div>
              <p className="mt-3 text-sm">
                <Link className="text-muted underline" href={`/report?room=${room.id}`}>
                  {t("report.link")}
                </Link>
              </p>
              {!room.entranceNodeId ? (
                <div className="mt-4">
                  <Notice tone="warn">{t("room.noEntrance")}</Notice>
                </div>
              ) : null}

              {officeOf.length ? (
                <Section title={t("lecturer.office")} className="mt-8">
                  {officeOf.map((x) => (
                    <Link key={x.id} href={`/lecturers/${x.id}`} className="block py-2 hover:underline">
                      {lt(x.fullName, loc)}
                    </Link>
                  ))}
                </Section>
              ) : null}

              <Section title={t("room.lecturesToday")} className="mt-8">
                {lectures.length ? <div className="space-y-2">{lectures.map((o) => <LectureCard key={o.entryId} bundle={bundle} occ={o} />)}</div> : <p className="text-sm text-muted">{t("timetable.noClasses")}</p>}
              </Section>
            </div>
            {floor ? (
              <FloorMap
                floor={floor}
                elements={bundle.mapElements.filter((e) => e.floorId === floor.id)}
                rooms={bundle.rooms.filter((r) => r.floorId === floor.id)}
                locale={loc}
                labels={mapLabels(t)}
                selectedRoomId={room.id}
                destinationNode={room.entranceNodeId ? l.nodes.get(room.entranceNodeId) ?? null : null}
                height="min(60vh, 520px)"
              />
            ) : null}
          </div>
        );
      }}
    </Gate>
  );
}
