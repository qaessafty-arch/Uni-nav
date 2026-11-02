"use client";
import { EntityPage } from "@/components/EntityPage";
import { scheduleChangeConfig } from "@/lib/entities";

export default function Page() {
  return <EntityPage config={scheduleChangeConfig} relations={["rooms", "lecturers"]} />;
}
