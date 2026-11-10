"use client";
/**
 * Map-first home: the campus fills the screen; search, details and actions
 * live in a side panel (desktop) or bottom sheet (phone). 3D is for spatial
 * understanding (Explore); turn-by-turn guidance stays on /navigate.
 *
 * State lives in the URL (?b=building&f=floor&r=room&in=1&v=2d) so the back
 * button, sharing and reloads behave.
 */
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildingHeightM, featureOn, roomTonesAt, todaySummary, isClosureActive, lt, nearestNode, relevantClosures, type Building, type CampusBundle, type Floor, type SearchIndex, type SearchResult } from "@campusnav/core";
import { FloorMap } from "@campusnav/map-web";
import { useApp } from "@/lib/store";
import { lookup, floorsOf } from "@/lib/lookup";
import { webglAvailable } from "@/lib/three/support";
import type { PickData } from "@/lib/three/viewer";
import { MapSearch } from "./MapSearch";
import { CampusMap2D } from "./CampusMap2D";
import { mapLabels } from "./MapLabels";
import { FACILITIES } from "./Blocks";
import { LectureCard } from "./LectureCard";
import { TodayCard } from "./TodayCard";
import { PrayerCard } from "./PrayerCard";
import { SafeBoundary } from "./SafeBoundary";
import { BuildingMark, HoursTable, OpenStatusLine } from "./BuildingMark";
import { ShareButton } from "./ShareButton";
import { nodeName } from "./LocationPicker";
import { Icon } from "./Icon";
import { I } from "./icons";
import { Badge, ButtonLink, Button, Spinner, cx } from "./ui";
import type { Scene3DSpec } from "./three/Scene3D";
import { MapWatermark } from "./PoweredBy";

const RealMap = dynamic(() => import("./map/RealMap"), { ssr: false, loading: () => <div className="absolute inset-0 grid place-items-center"><Spinner label="Map" /></div> });
const Scene3D = dynamic(() => import("./three/Scene3D"), { ssr: false, loading: () => <div className="absolute inset-0 grid place-items-center"><Spinner label="3D" /></div> });

type View = "map" | "3d" | "2d";

/** Building heights for the 3D real map, cached per bundle so the map isn't redrawn every render. */
const heightCache = new WeakMap<CampusBundle, Record<string, number>>();
function heightsFor(bundle: CampusBundle): Record<string, number> {
  let h = heightCache.get(bundle);
  if (!h) {
    h = Object.fromEntries(bundle.buildings.map((b) => [b.id, buildingHeightM(b.geo, bundle.floors.filter((f) => f.buildingId === b.id).map((f) => f.level))]));
    heightCache.set(bundle, h);
  }
  return h;
}

function floorShort(f: Floor): string {
  return f.level === 0 ? "G" : f.level < 0 ? `B${-f.level}` : String(f.level);
}

function useExplorerState() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const get = (k: string) => {
    const v = params.get(k);
    return v && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null;
  };
  // Default view: 3D on larger screens; 2D on phones or with Data Saver (3D downloads ~150 KB gzipped more). Users can switch.
  const [defaultView, setDefaultView] = useState<View>("2d");
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setDefaultView(window.matchMedia("(min-width: 768px)").matches && !saveData ? "3d" : "2d");
  }, []);
  const v = params.get("v");
  const state = { b: get("b"), f: get("f"), r: get("r"), inside: params.get("in") === "1", view: (v === "2d" || v === "3d" || v === "map" ? v : null) as View | null, defaultView };
  const set = useCallback(
    (patch: Partial<{ b: string | null; f: string | null; r: string | null; inside: boolean; view: View }>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        const key = k === "inside" ? "in" : k === "view" ? "v" : k;
        const val = k === "inside" ? (v ? "1" : null) : k === "view" ? (v as string) : (v as string | null);
        if (val) next.set(key, val);
        else next.delete(key);
      }
      const qs = next.toString();
      router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
    },
    [params, router, path],
  );
  return [state, set] as const;
}

export function Explorer({ bundle, index }: { bundle: CampusBundle; index: SearchIndex }) {
  const { t, prefs, start, setStart, saved, history, toggleSaved, student } = useApp();
  const router = useRouter();
  const [s, set] = useExplorerState();
  const [no3d, setNo3d] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [exploded, setExploded] = useState(false);
  const [live, setLive] = useState(true);
  const [onlyFloor, setOnlyFloor] = useState(false);
  const [tapMode, setTapMode] = useState(false);
  useEffect(() => setNo3d((v) => v || !webglAvailable()), []);
  // Measure the panel so the 3D camera and map controls avoid it.
  const panelRef = useRef<HTMLElement>(null);
  const [panelBox, setPanelBox] = useState({ w: 0, h: 0, sheet: false });
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPanelBox({ w: el.offsetWidth, h: el.offsetHeight, sheet: window.matchMedia("(max-width: 767.98px)").matches }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const insets = useMemo(() => (panelBox.sheet ? { start: 0, bottom: panelBox.h } : { start: panelBox.w + 16, bottom: 0 }), [panelBox]);
  const loc = prefs.locale;
  const l = lookup(bundle);
  const [noMap, setNoMap] = useState(false);
  const hasRealMap = !!(bundle.campuses.find((c) => c.id === (s.b ? l.buildings.get(s.b)?.campusId : undefined)) ?? bundle.campuses[0])?.geo && !noMap;
  // Default: the real map when the campus is placed on it; otherwise 3D on large screens and the plan on phones.
  // The university can choose the first view; 3D still falls back to the plan on devices without WebGL.
  // Open on the real map only once at least one building is placed on it; otherwise it's just an empty street map.
  const anyPlaced = bundle.buildings.some((b) => b.geo && b.geo.footprint.length >= 3);
  const preferred = bundle.university.settings.defaultView === "map" && !anyPlaced ? undefined : bundle.university.settings.defaultView;
  const requested: View = s.view ?? preferred ?? (hasRealMap && anyPlaced ? "map" : s.defaultView);
  let view: View = requested === "map" && !hasRealMap ? s.defaultView : requested;
  if (view === "3d" && no3d) view = "2d";
  const building = s.b ? l.buildings.get(s.b) : undefined;
  const floors = building ? floorsOf(bundle, building.id) : [];
  const room = s.r ? l.rooms.get(s.r) : undefined;
  const floor = s.f ? l.floors.get(s.f) : room ? l.floors.get(room.floorId) : undefined;
  const inside = !!building && (s.inside || !!room);
  // Indoors there is no real-map layer yet: the map view shows the floor plan.
  const indoorView: View = view === "3d" ? "3d" : "2d";
  const campus = bundle.campuses.find((c) => c.id === building?.campusId) ?? bundle.campuses[0];
  const isDemo = bundle.university.dataStatus === "demo";
  const startNode = start ? l.nodes.get(start.nodeId) : undefined;
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    if (building || room) setCollapsed(false);
  }, [building, room]);

  const pickResult = (r: SearchResult) => {
    if (r.type === "room") set({ b: r.item.buildingId, f: r.item.floorId, r: r.id, inside: true });
    else if (r.type === "building") set({ b: r.id, f: null, r: null, inside: false });
    else if (r.type === "lecturer") {
      const office = r.item.officeRoomId ? l.rooms.get(r.item.officeRoomId) : undefined;
      if (office) set({ b: office.buildingId, f: office.floorId, r: office.id, inside: true });
      else router.push(`/lecturers/${r.id}`);
    } else if (r.type === "department") {
      if (r.item.buildingId) set({ b: r.item.buildingId, f: null, r: null, inside: false });
      else router.push(`/lecturers?dept=${r.id}`);
    } else router.push(`/courses/${r.id}`);
  };

  const onPick = useCallback(
    (p: PickData | null) => {
      if (!p) return;
      if (p.kind === "building") set({ b: p.id, f: null, r: null, inside: false });
      else if (p.kind === "room") {
        const rm = l.rooms.get(p.id);
        if (rm) set({ r: rm.id, f: rm.floorId });
      } else if (p.kind === "floor") set({ f: p.id, r: null });
    },
    [set, l],
  );

  // Live room status (free / busy / my next class); only when bookings are known (students, staff).
  const canLive = student.access.kind !== "visitor" && featureOn(bundle.university.settings, "freeRooms");
  const tones = useMemo(
    () => (canLive && live ? roomTonesAt(bundle, now, todaySummary(bundle, now, prefs.groupId).groupId) : undefined),
    [canLive, live, bundle, now, prefs.groupId],
  );
  const hasTones = !!tones && Object.keys(tones).length > 0;

  // Memoised so the 3D scene only rebuilds when something relevant changes.
  const spec = useMemo<Scene3DSpec | null>(() => {
    if (!campus) return null;
    if (inside && building)
      return {
        type: "building",
        buildingId: building.id,
        floorId: floor?.id ?? null,
        exploded,
        hideOtherFloors: onlyFloor,
        selectedRoomId: room?.id ?? null,
        roomTones: tones,
        route: null,
        startNodeId: startNode && floors.some((f) => f.id === startNode.floorId) ? startNode.id : null,
        destinationNodeId: room?.entranceNodeId ?? null,
        locale: loc,
        floorLabel: (f: Floor) => `${floorShort(f)} · ${lt(f.name, loc)}`,
      };
    return { type: "campus", campusId: campus.id, selectedBuildingId: building?.id ?? null, locale: loc };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus?.id, inside, building?.id, floor?.id, exploded, onlyFloor, room?.id, startNode?.id, loc, bundle, tones]);
  const focusKey = inside ? `b:${building?.id}:${floor?.id ?? "all"}:${exploded}:${onlyFloor}` : `c:${building?.id ?? ""}`;

  const labels3d = { zoomIn: t("map.zoomIn"), zoomOut: t("map.zoomOut"), rotate: t("explore.rotate"), reset: t("map.reset"), canvas: t("explore.canvas") };

  // ── Map area ──────────────────────────────────────────────────────────
  let mapArea: React.ReactNode;
  const heights3d = heightsFor(bundle);
  const campusBuildings = bundle.buildings.filter((b) => b.campusId === campus?.id);
  const campusPlaced = campusBuildings.filter((b) => b.geo && b.geo.footprint.length >= 3);
  const campusUnplaced = campusPlaced.length ? campusBuildings.length - campusPlaced.length : 0;
  const walkways = bundle.navEdges.filter((e) => e.kind === "outdoor" && e.geometry && e.geometry.length >= 2).map((e) => e.geometry!);
  if (!inside && view === "map" && campus?.geo) {
    mapArea = (
      <RealMap
        geo={campus.geo}
        buildings={bundle.buildings.filter((b) => b.campusId === campus.id)}
        selectedId={building?.id ?? null}
        walkways={walkways}
        locale={loc}
        onSelect={(id) => set({ b: id, f: null, r: null, inside: false })}
        onUnavailable={() => setNoMap(true)}
        padding={insets}
        heights={heights3d}
        labels={{ tilesFailed: t("explore.tilesFailed"), zoomIn: t("map.zoomIn"), zoomOut: t("map.zoomOut"), reset: t("map.reset"), tilt3d: t("map.tilt3d"), flat2d: t("map.flat2d") }}
      />
    );
  } else if ((inside ? indoorView : view) === "3d" && spec) {
    mapArea = <Scene3D bundle={bundle} spec={spec} focusKey={focusKey} onPick={onPick} onUnavailable={() => setNo3d(true)} labels={labels3d} insets={insets} />;
  } else if (inside && building) {
    const f = floor ?? floors.find((x) => x.level === 0) ?? floors[0];
    mapArea = f ? (
      <FloorMap
        key={f.id}
        floor={f}
        elements={bundle.mapElements.filter((e) => e.floorId === f.id)}
        rooms={bundle.rooms.filter((r) => r.floorId === f.id)}
        locale={loc}
        labels={mapLabels(t)}
        selectedRoomId={room?.floorId === f.id ? room.id : null}
        roomTones={tones}
        startNode={startNode?.floorId === f.id ? startNode : null}
        destinationNode={room?.entranceNodeId && room.floorId === f.id ? l.nodes.get(room.entranceNodeId) ?? null : null}
        checkpointNodes={bundle.checkpoints.map((c) => l.nodes.get(c.nodeId)).filter((n): n is NonNullable<typeof n> => !!n && n.floorId === f.id)}
        onRoomSelect={(id) => (tapMode ? undefined : set({ r: id, f: f.id }))}
        onCanvasClick={(x, y) => {
          if (!tapMode) return;
          const n = nearestNode(bundle.navNodes, f.id, x, y);
          if (n) setStart({ nodeId: n.id, source: "manual", at: new Date().toISOString() });
          setTapMode(false);
        }}
        height="100%"
        className="!border-0"
      />
    ) : (
      <div className="absolute inset-0 grid place-items-center text-muted">{t("map.noFloors")}</div>
    );
  } else if (campus) {
    mapArea = <CampusMap2D bundle={bundle} campusId={campus.id} selectedId={building?.id ?? null} onSelect={(id) => set({ b: id, f: null, r: null, inside: false })} insets={{ start: insets.start, bottom: 0 }} />;
  }

  // ── Panel content ─────────────────────────────────────────────────────
  const settings = bundle.university.settings;
  const closures = featureOn(settings, "closures") ? relevantClosures(bundle, now) : { active: [], upcoming: [] };
  const facilityChips = settings.homeFacilities?.length
    ? settings.homeFacilities.map((type) => FACILITIES.find((f) => f.type === type) ?? { type, icon: I.building })
    : FACILITIES;
  const recent = prefs.keepHistory ? history.map((h) => l.rooms.get(h.to)).filter((r): r is NonNullable<typeof r> => !!r).slice(0, 3) : [];
  const savedRooms = saved.map((id) => l.rooms.get(id)).filter((r): r is NonNullable<typeof r> => !!r).slice(0, 3);

  const statusBadges = (b: Building) => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {isDemo || b.dataStatus === "demo" ? <Badge tone="warn">{t("data.demo")}</Badge> : b.dataStatus === "verified" ? <Badge tone="accent">{t("data.verified")}</Badge> : <Badge tone="warn">{t("explore.locationNotVerified")}</Badge>}
      {hasRealMap ? (!b.geo ? <Badge>{t("explore.notOnRealMap")}</Badge> : null) : !b.overview ? <Badge>{t("explore.notPlaced")}</Badge> : null}
    </div>
  );

  let panel: React.ReactNode;
  if (room && building) {
    const f = l.floors.get(room.floorId);
    const closed = (bundle.closures ?? []).find((c) => c.targetType === "room" && c.targetId === room.id && isClosureActive(c, now));
    panel = (
      <div className="space-y-4">
        <button className="text-sm text-muted hover:text-fg" onClick={() => set({ r: null })}>
          <span className="rtl:rotate-180 inline-block">←</span> {building.code} · {lt(f?.name, loc)}
        </button>
        <div>
          <div className="label-caps">{t(`roomType.${room.type}`)}{room.gender && (room.type === "toilet" || room.type === "prayer_room") ? ` · ${t(`gender.${room.gender}`)}` : ""}</div>
          <h2 className="cn-figure text-3xl mt-1">{room.code}</h2>
          <p className="text-lg mt-1">{lt(room.name, loc)}</p>
          <p className="text-sm text-muted">{lt(building.name, loc)} · {lt(f?.name, loc)}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {room.dataStatus === "demo" ? <Badge tone="warn">{t("data.demo")}</Badge> : room.dataStatus === "verified" ? <Badge tone="accent">{t("data.verified")}</Badge> : <Badge tone="warn">{t("explore.locationNotVerified")}</Badge>}
            {room.accessible ? <Badge tone="info">{t("room.accessible")}</Badge> : null}
          </div>
          {closed ? <p className="mt-2 text-sm text-warn">{t("room.closedNow", { reason: lt(closed.reason, loc) })}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {room.entranceNodeId ? (
            <ButtonLink href={`/navigate?to=${room.id}`} variant="primary" className="col-span-2">
              <Icon d={I.route} /> {t("common.navigate")}
            </ButtonLink>
          ) : (
            <p className="col-span-2 text-sm text-warn">{t("room.noEntrance")}</p>
          )}
          <ButtonLink href={`/rooms/${room.id}`}>{t("explore.details")}</ButtonLink>
          <Button onClick={() => toggleSaved(room.id)} aria-pressed={saved.includes(room.id)}>
            <Icon name="star" className={cx("size-4", saved.includes(room.id) && "fill-current text-accent")} /> {saved.includes(room.id) ? t("common.saved_location") : t("common.save_location")}
          </Button>
        </div>
      </div>
    );
  } else if (building) {
    const roomCount = bundle.rooms.filter((r) => r.buildingId === building.id).length;
    const fl = floor ?? null;
    const floorRooms = fl ? bundle.rooms.filter((r) => r.floorId === fl.id).sort((a, z) => a.code.localeCompare(z.code, undefined, { numeric: true })) : [];
    const entrance = bundle.navNodes.find((n) => n.kind === "building_entrance" && floors.some((f) => f.id === n.floorId));
    panel = (
      <div className="space-y-4">
        {inside ? (
          <button className="text-sm text-muted hover:text-fg" onClick={() => set({ inside: false, f: null, r: null })}>
            <span className="rtl:rotate-180 inline-block">←</span> {t("explore.backToCampus")}
          </button>
        ) : (
          <button className="text-sm text-muted hover:text-fg" onClick={() => set({ b: null, f: null, r: null, inside: false })}>
            <span className="rtl:rotate-180 inline-block">←</span> {t("map.campus")}
          </button>
        )}
        <div>
          <div className="flex items-center gap-3">
            <BuildingMark building={building} size="lg" />
            <div className="min-w-0">
              <div className="label-caps">{building.code}</div>
              <h2 className="cn-display cn-display-md mt-0.5">{lt(building.name, loc)}</h2>
            </div>
          </div>
          <OpenStatusLine hours={building.hours} timeZone={bundle.university.settings.timezone} className="mt-2" />
          {building.description ? <p className="text-sm text-muted mt-1">{lt(building.description, loc)}</p> : null}
          <p className="text-sm text-muted mt-1">
            {t("explore.floorsCount", { n: floors.length })} · {t("explore.roomsCount", { n: roomCount })}
          </p>
          {statusBadges(building)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {!inside ? (
            <Button variant="primary" className="col-span-2" onClick={() => set({ inside: true, f: null, r: null })}>
              <Icon d={I.building} /> {t("explore.exploreBuilding")}
            </Button>
          ) : null}
          {entrance ? <ButtonLink href={`/navigate?to=node:${entrance.id}`} className="col-span-2"><Icon d={I.route} /> {t("explore.toEntrance")}</ButtonLink> : null}
          <ButtonLink href={`/buildings/${building.id}`} className="col-span-2">{t("explore.details")}</ButtonLink>
        </div>
        {building.hours && Object.keys(building.hours).length ? (
          <details className="text-sm">
            <summary className="cursor-pointer label-caps">{t("hours.title")}</summary>
            <div className="mt-2"><HoursTable hours={building.hours} /></div>
          </details>
        ) : null}
        <div>
          <div className="label-caps mb-2">{t("map.floors")}</div>
          {floors.length === 0 ? <p className="text-sm text-muted">{t("map.noFloors")}</p> : null}
          <div className="flex flex-wrap gap-1.5">
            {[...floors].reverse().map((f) => (
              <button key={f.id} type="button" className="cn-chip !min-h-9" aria-pressed={fl?.id === f.id} onClick={() => set({ inside: true, f: f.id, r: null })}>
                <span className="mono">{floorShort(f)}</span> {lt(f.name, loc)}
              </button>
            ))}
          </div>
        </div>
        {fl ? (
          <div>
            {!bundle.mapElements.some((e) => e.floorId === fl.id) ? <p className="text-sm text-warn mb-2">{t("explore.planUnavailable")}</p> : null}
            <div className="label-caps mb-1">{t("explore.roomsOnFloor")}</div>
            <ul className="divide-y divide-[var(--cn-border)]">
              {floorRooms.map((r) => (
                <li key={r.id}>
                  <button type="button" className="w-full text-start py-2.5 flex items-center gap-3 hover:text-accent" onClick={() => set({ r: r.id })}>
                    <span className="mono font-semibold w-14 shrink-0">{r.code}</span>
                    <span className="truncate text-sm">{lt(r.name, loc)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  } else {
    const placed = bundle.buildings.filter((b) => b.overview);
    panel = (
      <div className="space-y-5">
        <div className="cn-scroll-x">
          {facilityChips.filter((f) => bundle.rooms.some((r) => r.type === f.type)).map((f) => (
            <Link key={f.type} href={`/nearby?type=${f.type}`} className="cn-chip !min-h-9">
              <Icon d={f.icon} className="size-4 text-accent" /> {t(`roomType.${f.type}`)}
            </Link>
          ))}
        </div>
        {closures.active.length || closures.upcoming.length ? (
          <div className="text-sm border-s-2 border-warn ps-3" role="note">
            <span className="font-medium">{t("home.closures")}</span>{" "}
            <span className="text-xs text-warn">{closures.active.length ? t("closure.active") : t("closure.upcoming")}</span>
            <span className="block text-muted">{lt((closures.active[0] ?? closures.upcoming[0])!.reason, loc)}</span>
          </div>
        ) : null}
        {featureOn(settings, "prayer") ? <SafeBoundary><PrayerCard bundle={bundle} /></SafeBoundary> : null}
        <SafeBoundary><TodayCard bundle={bundle} /></SafeBoundary>
        {start && featureOn(settings, "shareLocation") ? (
          <ShareButton path={`/navigate?to=${encodeURIComponent(`node:${start.nodeId}`)}`} label={t("share.myLocation")} title={t("share.myLocationHint")} className="!min-h-10" />
        ) : null}
        {recent.length || savedRooms.length ? (
          <div>
            <div className="label-caps mb-1">{recent.length ? t("home.recent") : t("home.savedPlaces")}</div>
            <ul className="divide-y divide-[var(--cn-border)]">
              {(recent.length ? recent : savedRooms).map((r) => (
                <li key={r.id}>
                  <button type="button" className="w-full text-start py-2.5 flex items-center gap-3 hover:text-accent" onClick={() => set({ b: r.buildingId, f: r.floorId, r: r.id, inside: true })}>
                    <span className="mono font-semibold w-14 shrink-0">{r.code}</span>
                    <span className="truncate text-sm">{lt(r.name, loc)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <div className="label-caps mb-1">{t("map.buildings")}</div>
          <ul className="divide-y divide-[var(--cn-border)]" aria-label={t("map.buildings")}>
            {bundle.buildings.map((b) => (
              <li key={b.id}>
                <button type="button" className="w-full text-start py-2.5 flex items-center gap-3 hover:text-accent" onClick={() => set({ b: b.id, f: null, r: null, inside: false })}>
                  <BuildingMark building={b} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{lt(b.name, loc)}</span>
                    <span className="flex items-center gap-2 text-xs text-muted whitespace-nowrap"><span className="mono">{b.code}</span><OpenStatusLine hours={b.hours} timeZone={bundle.university.settings.timezone} className="!text-xs" /></span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {placed.length === 0 ? <p className="text-sm text-muted mt-2">{t("explore.notPlaced")}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="cn-explorer" style={{ ["--cn-sheet-h" as string]: panelBox.sheet ? `${panelBox.h}px` : "0px" }}>
      {/* Plans (SVG) fit themselves to their box, so on phones the box stops above the bottom sheet;
          the 3D view and real map instead shift their camera (they stay full-bleed behind the sheet). */}
      <div className="cn-explorer-map" style={(inside ? indoorView : view) === "2d" ? { bottom: "var(--cn-sheet-h, 0px)" } : undefined}>
        {mapArea}
        <MapWatermark offset={insets.start} />
      </div>

      {/* Top-end: view switch + honesty badges */}
      <div className="cn-float top-3 end-3 flex flex-col items-end gap-2 max-w-[60%] max-md:end-auto max-md:start-3 max-md:items-start max-md:max-w-[75%]">
        <div className="cn-segment !p-1 shadow-lg" role="radiogroup" aria-label={t("explore.viewMode")}>
          {((hasRealMap && !inside ? ["map", "3d", "2d"] : ["3d", "2d"]) as View[]).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={(inside ? indoorView : view) === v} disabled={v === "3d" && no3d} onClick={() => set({ view: v })} className="!min-h-8 !px-3">
              {v === "map" ? t("explore.viewMap") : v === "3d" ? t("explore.view3d") : t("explore.viewPlan")}
            </button>
          ))}
        </div>
        {no3d && (inside ? indoorView : view) !== "map" ? <span className="cn-mapbadge" role="status">{t("explore.no3d")}</span> : (inside ? indoorView : view) === "3d" ? (
          !inside && campusPlaced.length ? (
            <>
              <span className="cn-mapbadge hidden md:inline-flex">{t("explore.real3d")}</span>
              {campusUnplaced ? <span className="cn-mapbadge !text-warn">{t("explore.unplaced3d", { n: campusUnplaced })}</span> : null}
            </>
          ) : <span className="cn-mapbadge hidden md:inline-flex">{t("explore.schematic")}</span>
        ) : !inside && view === "map" && !bundle.buildings.some((b) => b.geo) ? <span className="cn-mapbadge">{t("explore.noneOnRealMap")}</span> : null}
        {isDemo ? <span className="cn-mapbadge !text-warn max-md:!hidden">{t("data.demo")}</span> : null}
        {canLive && inside ? (
          <button type="button" className="cn-chip !min-h-8 shadow-lg" aria-pressed={live} onClick={() => setLive(!live)} data-testid="live-toggle">
            <span className={cx("cn-dot", live ? "bg-[var(--cn-map-free-stroke)]" : "bg-[var(--cn-text-faint)]")} aria-hidden /> {t("live.toggle")}
          </button>
        ) : null}
        {inside && hasTones ? (
          <div className="cn-mapbadge flex items-center gap-3" data-testid="live-legend" role="note" title={t("free.caveat")}>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--cn-map-free-stroke)]" aria-hidden />{t("live.free")}</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--cn-border-strong)]" aria-hidden />{t("live.busy")}</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-accent" aria-hidden />{t("live.mine")}</span>
          </div>
        ) : null}
      </div>

      {/* Floor selector (inside a building) */}
      {inside && floors.length ? (
        <div className="cn-float end-3 max-md:end-auto max-md:start-3 -translate-y-1/2 flex flex-col items-end gap-2" style={{ top: "calc((100% - var(--cn-sheet-h, 0px)) / 2 + 24px)" }}>
          <div className="cn-floorbar" role="group" aria-label={t("map.floors")}>
            {[...floors].reverse().map((f) => (
              <button key={f.id} type="button" aria-pressed={floor?.id === f.id} title={lt(f.name, loc)} aria-label={lt(f.name, loc)} onClick={() => set({ f: f.id, r: null })}>
                {floorShort(f)}
              </button>
            ))}
            {indoorView === "3d" ? (
              <button type="button" aria-pressed={!floor} onClick={() => set({ f: null, r: null })} title={t("explore.allFloors")} aria-label={t("explore.allFloors")}>
                <Icon name="layers" className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Building view options */}
      {inside ? (
        <div className="cn-float end-16 flex flex-wrap justify-end gap-1.5" style={{ bottom: "calc(var(--cn-sheet-h, 0px) + 12px)" }}>
          {indoorView === "3d" ? (
            <>
              <button type="button" className="cn-chip !min-h-9 shadow" aria-pressed={exploded} onClick={() => setExploded(!exploded)}>
                {t("explore.exploded")}
              </button>
              {floor ? (
                <button type="button" className="cn-chip !min-h-9 shadow" aria-pressed={onlyFloor} onClick={() => setOnlyFloor(!onlyFloor)}>
                  {t("explore.onlyThisFloor")}
                </button>
              ) : null}
            </>
          ) : (
            <button type="button" className="cn-chip !min-h-9 shadow" aria-pressed={tapMode} onClick={() => setTapMode(!tapMode)}>
              <Icon d={I.pin} className="size-4" /> {tapMode ? t("explore.tapNow") : t("explore.tapToSet")}
            </button>
          )}
        </div>
      ) : null}

      {/* Side panel / bottom sheet */}
      <section ref={panelRef} className="cn-sidepanel" data-collapsed={collapsed} aria-label={building ? lt(building.name, loc) : t("map.campus")}>
        <button type="button" className="md:hidden w-full pb-1" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={collapsed ? t("explore.expand") : t("explore.collapse")}>
          <span className="cn-grabber block" aria-hidden />
        </button>
        <div className="px-4 pt-2 md:pt-4 pb-3 border-b border-line space-y-3">
          {!building ? (
            <div className={cx(collapsed && "max-md:sr-only")}>
              <p className="text-xs text-muted">{bundle.university.branding.productName ?? t("brand.product")}</p>
              <h1 className="font-semibold text-lg leading-tight">{lt(bundle.university.name, loc)}</h1>
            </div>
          ) : null}
          <MapSearch bundle={bundle} index={index} onPick={pickResult} />
          <p className="text-xs text-muted flex items-center gap-2 min-w-0">
            <span className={cx("cn-dot", startNode ? "bg-accent" : "bg-[var(--cn-text-faint)]")} aria-hidden />
            <span className="truncate">{startNode ? t("home.startingFrom", { place: nodeName(startNode, l, loc) }) : t("shell.noLocation")}</span>
            {!startNode ? (
              <Link href="/scan" className="text-accent font-semibold ms-auto shrink-0">
                {t("nav.scan")}
              </Link>
            ) : null}
          </p>
        </div>
        <div
          className="flex-1 overflow-y-auto p-4"
          onFocus={(e) => {
            // Keyboard users get the sheet expanded; taps don't move content mid-gesture.
            if ((e.target as HTMLElement).matches?.(":focus-visible")) setCollapsed(false);
          }}
        >
          {panel}
        </div>
      </section>
    </div>
  );
}

/** 2D campus overview (also the fallback when 3D is unavailable). */
