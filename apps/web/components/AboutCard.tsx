"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "./ui";
import { NullTechMark } from "./NullTechMark";

/** Optional: set NEXT_PUBLIC_INSTAGRAM_URL (e.g. https://instagram.com/uni.nav) to show a follow link. */
const INSTAGRAM = process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "";

type InstallEvent = Event & { prompt: () => Promise<void> };

/** How to install the web app (no app store), the "unofficial" note, and the Instagram link. */
export function AboutCard({ compact = false }: { compact?: boolean }) {
  const { t } = useApp();
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia?.("(display-mode: standalone)").matches ?? false);
    const on = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  return (
    <div className="border border-line p-4 space-y-2 text-sm" data-testid="about-card">
      {!installed ? (
        <>
          <p className="font-medium">{t("about.install")}</p>
          {installEvt ? (
            <Button variant="primary" onClick={() => void installEvt.prompt().then(() => setInstallEvt(null))}>{t("about.installNow")}</Button>
          ) : (
            !compact && (
              <ul className="text-muted space-y-1">
                <li>{t("about.ios")}</li>
                <li>{t("about.android")}</li>
              </ul>
            )
          )}
        </>
      ) : null}
      <p className="text-faint text-xs flex items-center gap-2"><NullTechMark size={14} /> {t("about.unofficial")}</p>
      {INSTAGRAM ? (
        <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className="inline-block underline text-accent">{t("about.follow")}</a>
      ) : null}
    </div>
  );
}
