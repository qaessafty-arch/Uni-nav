"use client";
import { EntityPage } from "@/components/EntityPage";
import { departmentConfig } from "@/lib/entities";

export default function Page() {
  return <EntityPage config={departmentConfig} relations={[]} />;
}
