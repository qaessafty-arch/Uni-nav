"use client";
import Link from "next/link";
import { lt } from "@campusnav/core";
import { formatInstant } from "@campusnav/i18n";
import { Button, ButtonLink, PageTitle, Section, Toggle, cx } from "@/components/ui";
import { useApp } from "@/lib/store";
import { APP_VERSION, backendMode } from "@/lib/config";

export default function SettingsPage() {
  const { t, prefs, setPrefs, universities, bundleState, reload, clearOffline, clearHistory } = useApp();
  const uni = universities?.find((u) => u.id === prefs.universityId);
  const tz = bundleState.status === "ready" ? bundleState.bundle.university.settings.timezone : "UTC";
  return (
    <div className="max-w-2xl">
      <PageTitle>{t("settings.title")}</PageTitle>
      <Section title={t("campus.select")}>
        <div className="flex items-center justify-between gap-3">
          <span>{uni ? lt(uni.name, prefs.locale) : "—"}</span>
          <ButtonLink href="/campus">{t("campus.change")}</ButtonLink>
        </div>
      </Section>
      <Section title={t("settings.language")}>
        <Link href="/language" className="flex items-center justify-between min-h-11 hover:underline">
          <span>{t(`language.${prefs.locale}`)}</span>
          <span aria-hidden className="rtl:rotate-180">→</span>
        </Link>
      </Section>
      <Section title={t("settings.theme")}>
        <div className="flex border border-line-strong w-fit" role="radiogroup" aria-label={t("settings.theme")}>
          {(["dark", "light", "system"] as const).map((th) => (
            <button key={th} role="radio" aria-checked={prefs.theme === th} onClick={() => setPrefs({ theme: th })} className={cx("min-h-11 px-4 text-sm", prefs.theme === th ? "bg-accent text-accent-fg" : "text-muted")}>
              {t(`settings.theme.${th}`)}
            </button>
          ))}
        </div>
      </Section>
      <Section title={t("navigate.title")}>
        <Toggle checked={prefs.accessible} onChange={(v) => setPrefs({ accessible: v })} label={t("settings.accessibleDefault")} />
        <Toggle checked={prefs.keepHistory} onChange={(v) => { setPrefs({ keepHistory: v }); if (!v) clearHistory(); }} label={t("settings.history")} description={t("settings.privacy")} />
        {prefs.keepHistory ? <Button onClick={clearHistory}>{t("settings.clearHistory")}</Button> : null}
      </Section>
      <Section title={t("settings.offline")}>
        {bundleState.status === "ready" ? <p className="text-sm text-muted mb-3">{t("settings.offlineSaved", { date: formatInstant(prefs.locale, bundleState.cachedAt, tz) })}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={reload}>{t("settings.offlineRefresh")}</Button>
          <Button variant="danger" onClick={() => void clearOffline()}>{t("settings.offlineClear")}</Button>
        </div>
      </Section>
      <Section title={t("settings.about")}>
        <p className="text-sm text-muted mono">
          {t("brand.product")} · {t("settings.version", { v: APP_VERSION })} · {backendMode}
        </p>
        <p className="text-sm text-muted mono mt-1">{t("brand.studio")}</p>
      </Section>
    </div>
  );
}
