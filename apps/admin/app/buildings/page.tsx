"use client";
import { EntityPage } from "@/components/EntityPage";
import { buildingConfig } from "@/lib/entities";

export default function Page() {
  return <EntityPage config={buildingConfig} relations={["campuses"]} />;
}
