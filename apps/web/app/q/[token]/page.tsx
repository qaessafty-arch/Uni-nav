"use client";
import { useParams } from "next/navigation";
import { CheckpointResult } from "@/components/CheckpointResult";
import { PageTitle } from "@/components/ui";
import { useApp } from "@/lib/store";

/** Landing page for printed checkpoint QR codes (https://<host>/q/<token>) scanned with the phone's stock camera. */
export default function CheckpointLandingPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useApp();
  return (
    // No Gate: first-time visitors who scan a printed QR land here directly; the
    // checkpoint's university is selected automatically after verification.
    <div className="max-w-xl">
      <PageTitle>{t("map.checkpoint")}</PageTitle>
      <CheckpointResult token={decodeURIComponent(token)} />
    </div>
  );
}
