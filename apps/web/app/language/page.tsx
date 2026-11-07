"use client";
import { LOCALES } from "@campusnav/core";
import { PageTitle, cx } from "@/components/ui";
import { useApp } from "@/lib/store";
import { Icon } from "@/components/Icon";

export default function LanguagePage() {
  const { t, prefs, setPrefs } = useApp();
  return (
    <div className="max-w-md">
      <PageTitle>{t("language.title")}</PageTitle>
      <div role="radiogroup" aria-label={t("language.title")} className="border border-line divide-y divide-line">
        {LOCALES.map((l) => (
          <button
            key={l}
            role="radio"
            aria-checked={prefs.locale === l}
            lang={l}
            dir={l === "en" ? "ltr" : "rtl"}
            onClick={() => setPrefs({ locale: l })}
            className={cx("w-full flex items-center justify-between px-4 min-h-14 text-lg", prefs.locale === l ? "text-accent" : "")}
          >
            <span>{t(`language.${l}`)}</span>
            {prefs.locale === l ? <Icon name="check" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
