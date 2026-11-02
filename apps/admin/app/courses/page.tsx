"use client";
import { EntityPage } from "@/components/EntityPage";
import { courseConfig } from "@/lib/entities";

export default function Page() {
  return <EntityPage config={courseConfig} relations={["departments"]} />;
}
