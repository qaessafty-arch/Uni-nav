"use client";
import { EntityPage } from "@/components/EntityPage";
import { announcementConfig } from "@/lib/entities";

export default function Page() {
  return <EntityPage config={announcementConfig} relations={[]} />;
}
