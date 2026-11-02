"use client";
import { ButtonLink, PageTitle } from "@/components/ui";
import { useApp } from "@/lib/store";

/** Served by the service worker when a page isn't cached and the network is down. */
export default function OfflinePage() {
  const { t } = useApp();
  return (
    <div className="max-w-md">
      <PageTitle>{t("offline.title")}</PageTitle>
      <p className="text-muted">{t("offline.noData")}</p>
      <div className="mt-6 flex gap-2">
        <ButtonLink href="/" variant="primary">
          {t("nav.home")}
        </ButtonLink>
        <ButtonLink href="/map">{t("nav.map")}</ButtonLink>
      </div>
    </div>
  );
}
