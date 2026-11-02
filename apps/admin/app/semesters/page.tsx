"use client";
import { EntityPage } from "@/components/EntityPage";
import { semesterConfig } from "@/lib/entities";

export default function Page() {
  return <EntityPage config={semesterConfig} relations={[]} />;
}
