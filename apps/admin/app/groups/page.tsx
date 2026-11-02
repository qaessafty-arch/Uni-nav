"use client";
import { EntityPage } from "@/components/EntityPage";
import { groupConfig } from "@/lib/entities";

export default function Page() {
  return <EntityPage config={groupConfig} relations={[]} />;
}
