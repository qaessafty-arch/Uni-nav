"use client";
import { EntityPage } from "@/components/EntityPage";
import { roomConfig } from "@/lib/entities";

export default function Page() {
  return <EntityPage config={roomConfig} relations={["buildings", "floors"]} />;
}
