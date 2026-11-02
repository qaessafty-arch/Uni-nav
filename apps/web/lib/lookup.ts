import type { Building, CampusBundle, Course, Department, Floor, Lecturer, NavNode, Room, StudentGroup } from "@campusnav/core";

export interface Lookup {
  rooms: Map<string, Room>;
  buildings: Map<string, Building>;
  floors: Map<string, Floor>;
  nodes: Map<string, NavNode>;
  lecturers: Map<string, Lecturer>;
  courses: Map<string, Course>;
  departments: Map<string, Department>;
  groups: Map<string, StudentGroup>;
  roomByEntrance: Map<string, Room>;
  checkpointNodeIds: Set<string>;
}

const cache = new WeakMap<CampusBundle, Lookup>();

export function lookup(b: CampusBundle): Lookup {
  let l = cache.get(b);
  if (!l) {
    l = {
      rooms: new Map(b.rooms.map((x) => [x.id, x])),
      buildings: new Map(b.buildings.map((x) => [x.id, x])),
      floors: new Map(b.floors.map((x) => [x.id, x])),
      nodes: new Map(b.navNodes.map((x) => [x.id, x])),
      lecturers: new Map(b.lecturers.map((x) => [x.id, x])),
      courses: new Map(b.courses.map((x) => [x.id, x])),
      departments: new Map(b.departments.map((x) => [x.id, x])),
      groups: new Map(b.groups.map((x) => [x.id, x])),
      roomByEntrance: new Map(b.rooms.filter((r) => r.entranceNodeId).map((r) => [r.entranceNodeId!, r])),
      checkpointNodeIds: new Set(b.checkpoints.map((c) => c.nodeId)),
    };
    cache.set(b, l);
  }
  return l;
}

export function floorsOf(b: CampusBundle, buildingId: string): Floor[] {
  return b.floors.filter((f) => f.buildingId === buildingId).sort((a, z) => a.level - z.level);
}
