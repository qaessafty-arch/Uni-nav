"use client";
import { ButtonLink, PageTitle } from "@/components/ui";
import { useApp } from "@/lib/store";

export default function NotFound() {
  const { t } = useApp();
  return (
    <div className="max-w-md">
      <PageTitle>{t("error.notFound")}</PageTitle>
      <ButtonLink href="/" variant="primary">{t("nav.home")}</ButtonLink>
    </div>
  );
}
