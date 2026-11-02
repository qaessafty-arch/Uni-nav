"use client";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { CampusBundle } from "@campusnav/core";
import type { SearchIndex } from "@campusnav/core";
import { useApp } from "@/lib/store";
import { ButtonLink, ErrorState, Spinner } from "./ui";

/**
 * Ensures onboarding is done, a university is selected and its bundle is loaded
 * (from network or offline cache) before rendering a screen.
 */
export function Gate({ children }: { children: (bundle: CampusBundle, index: SearchIndex) => ReactNode }) {
  const { hydrated, prefs, bundleState, t, reload, online } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!prefs.onboarded) router.replace("/onboarding");
    else if (!prefs.universityId) router.replace("/campus");
  }, [hydrated, prefs.onboarded, prefs.universityId, router]);

  if (!hydrated || !prefs.onboarded || !prefs.universityId || bundleState.status === "idle" || bundleState.status === "loading") {
    return <Spinner label={t("common.loading")} />;
  }
  if (bundleState.status === "error") {
    return (
      <div className="space-y-4">
        <ErrorState title={online ? t("error.load") : t("offline.title")} body={online ? bundleState.error : t("offline.noData")} onRetry={reload} retryLabel={t("common.retry")} />
        <ButtonLink href="/campus">{t("campus.change")}</ButtonLink>
      </div>
    );
  }
  return <>{children(bundleState.bundle, bundleState.index)}</>;
}
