"use client";
import { EntityPage } from "@/components/EntityPage";
import { floorConfig } from "@/lib/entities";

export default function Page() {
  return <EntityPage config={floorConfig} relations={["buildings"]} />;
}
