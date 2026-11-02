"use client";
import { EntityPage } from "@/components/EntityPage";
import { campusConfig } from "@/lib/entities";

export default function Page() {
  return <EntityPage config={campusConfig} relations={[]} />;
}
