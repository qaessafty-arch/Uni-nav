"use client";
import { NullTechMark } from "@/components/NullTechMark";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LOCALES } from "@campusnav/core";
import { useApp } from "@/lib/store";
import { Button, cx } from "@/components/ui";
import { Logo } from "@/components/Logo";

/** Splash + onboarding + language selection, shown on first launch. */
export default function OnboardingPage() {
  const { t, prefs, setPrefs, hydrated } = useApp();
  const router = useRouter();
  const [splash, setSplash] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setSplash(false), 900);
    return () => window.clearTimeout(id);
  }, []);

  const finish = () => {
    setPrefs({ onboarded: true });
    router.replace(prefs.universityId ? "/" : "/campus");
  };

  const slides = [
    { title: t("onboarding.title1"), body: t("onboarding.body1"), glyph: "M4 4h10v10H4zM12 12l8 8" },
    { title: t("onboarding.title2"), body: t("onboarding.body2"), glyph: "M4 20V8h8V4h8" },
    { title: t("onboarding.title3"), body: t("onboarding.body3"), glyph: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z" },
  ];

  if (splash || !hydrated) {
    return (
      <div className="min-h-dvh grid place-items-center grid-bg" aria-busy>
        <div className="text-center">
          <div className="inline-block p-4 bg-bg border border-line-strong">
            <Logo size={56} />
          </div>
          <p className="mono text-xl font-semibold tracking-[0.2em] mt-6">CAMPUS NAV</p>
          <p className="mono text-xs text-faint mt-2 tracking-[0.3em] flex items-center justify-center gap-2"><NullTechMark size={16} /> NULL-TECH</p>
        </div>
      </div>
    );
  }

  const s = slides[step]!;
  return (
    <div className="min-h-dvh flex flex-col mx-auto max-w-lg px-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="mono font-semibold tracking-wider">CAMPUS NAV</span>
        </div>
        <Button variant="ghost" onClick={finish}>
          {t("onboarding.skip")}
        </Button>
      </div>

      <fieldset className="mt-8">
        <legend className="label-caps mb-2">{t("language.title")}</legend>
        <div className="grid grid-cols-3 gap-2">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={prefs.locale === l}
              onClick={() => setPrefs({ locale: l })}
              className={cx("min-h-11 border px-2 text-sm", prefs.locale === l ? "border-accent text-accent" : "border-line-strong text-muted")}
              lang={l}
            >
              {t(`language.${l}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex-1 flex flex-col justify-center py-10" aria-live="polite">
        <div className="size-20 border border-line-strong grid place-items-center grid-bg">
          <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="var(--cn-accent)" strokeWidth={2} strokeLinecap="square" aria-hidden>
            <path d={s.glyph} />
          </svg>
        </div>
        <p className="label-caps mt-8">{`0${step + 1} / 03`}</p>
        <h1 className="cn-display cn-display-xl mt-3">{s.title}</h1>
        <p className="text-muted mt-3 text-lg">{s.body}</p>
      </div>

      <div className="flex gap-2 mb-6" aria-hidden>
        {slides.map((_, i) => (
          <span key={i} className={cx("h-1 flex-1", i <= step ? "bg-accent" : "bg-line")} />
        ))}
      </div>
      {step < slides.length - 1 ? (
        <Button variant="primary" onClick={() => setStep(step + 1)}>
          {t("common.continue")}
        </Button>
      ) : (
        <Button variant="primary" onClick={finish}>
          {t("onboarding.start")}
        </Button>
      )}
      <p className="text-center text-faint text-xs mono mt-6">{t("splash.tagline")}</p>
    </div>
  );
}
