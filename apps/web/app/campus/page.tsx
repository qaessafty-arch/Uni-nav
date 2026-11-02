"use client";
import { useRouter } from "next/navigation";
import { lt } from "@campusnav/core";
import { useApp } from "@/lib/store";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { Logo } from "@/components/Logo";

export default function CampusSelectPage() {
  const { t, universities, prefs, setPrefs, start, setStart } = useApp();
  const router = useRouter();

  const choose = (id: string) => {
    if (id !== prefs.universityId) {
      setPrefs({ universityId: id, groupId: null, onboarded: true });
      if (start) setStart(null); // starting points belong to the previous university
    } else setPrefs({ onboarded: true });
    router.replace("/");
  };

  return (
    <div className="min-h-dvh mx-auto max-w-lg px-6 py-10">
      <div className="flex items-center gap-2 mb-10">
        <Logo />
        <span className="mono font-semibold tracking-wider">CAMPUS NAV</span>
      </div>
      <h1 className="cn-display cn-display-lg">{t("campus.select")}</h1>
      <p className="text-muted mt-2">{t("campus.selectHint")}</p>
      <div className="mt-8 space-y-2">
        {universities === null ? (
          <Spinner label={t("common.loading")} />
        ) : universities.length === 0 ? (
          <EmptyState title={t("campus.none")} />
        ) : (
          universities.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => choose(u.id)}
              className="cn-tile w-full text-start p-4 flex items-center gap-4 min-h-16"
              aria-current={prefs.universityId === u.id ? "true" : undefined}
            >
              <span className="size-10 grid place-items-center border border-line-strong mono text-xs">{u.shortName.slice(0, 4)}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate">{lt(u.name, prefs.locale)}</span>
                <span className="block text-sm text-muted mono">{u.branding.productName ?? u.shortName}</span>
              </span>
              {u.dataStatus === "demo" ? <Badge tone="warn">{t("data.demo")}</Badge> : u.dataStatus === "verified" ? <Badge tone="accent">{t("data.verified")}</Badge> : <Badge>{t("data.unverified")}</Badge>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
