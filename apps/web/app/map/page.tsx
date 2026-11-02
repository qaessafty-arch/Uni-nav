"use client";
import { Suspense } from "react";
import { Gate } from "@/components/Gate";
import { Explorer } from "@/components/Explorer";

/** Same explorer as the home screen: search, 2D/3D campus, buildings, floors and rooms in one place. */
export default function MapPage() {
  return (
    <Suspense>
      <Gate>{(bundle, index) => <Explorer bundle={bundle} index={index} />}</Gate>
    </Suspense>
  );
}
