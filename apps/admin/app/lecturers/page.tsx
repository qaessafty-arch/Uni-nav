"use client";
import { EntityPage } from "@/components/EntityPage";
import { lecturerConfig } from "@/lib/entities";

export default function Page() {
  return <EntityPage config={lecturerConfig} relations={["departments", "rooms"]} />;
}
