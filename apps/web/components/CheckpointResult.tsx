"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { lt, parseCheckpointPayload, type CheckpointResolution } from "@campusnav/core";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";
import { Button, ButtonLink, ErrorState, Notice, Spinner } from "./ui";

export async function resolveCheckpointToken(raw: string, universityId?: string | null): Promise<CheckpointResolution> {
  const parsed = parseCheckpointPayload(raw, typeof window !== "undefined" ? [window.location.host] : undefined);
  if (!parsed.ok) return { status: "unknown" };
  try {
    const res = await fetch(`/api/checkpoint/${encodeURIComponent(parsed.token)}${universityId ? `?university=${universityId}` : ""}`, { cache: "no-store" });
    const body = (await res.json()) as CheckpointResolution;
    return body;
  } catch {
    return { status: "network_error" };
  }
}

/** Resolves a token and shows the outcome; on success sets the user's start point. */
export function CheckpointResult({ token, then, onReset }: { token: string; then?: string | null; onReset?: () => void }) {
  const { t, prefs, setStart, setPrefs, bundleState, universities, hydrated } = useApp();
  const router = useRouter();
  const [res, setRes] = useState<CheckpointResolution | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setRes(null);
    resolveCheckpointToken(token, prefs.universityId).then((r) => {
      if (cancelled) return;
      setRes(r);
      if (r.status === "ok" && !prefs.universityId) setPrefs({ universityId: r.checkpoint.universityId, onboarded: true });
      if (r.status === "ok") setStart({ nodeId: r.checkpoint.nodeId, source: "checkpoint", label: lt(r.checkpoint.label, prefs.locale), at: new Date().toISOString() });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, prefs.universityId, hydrated]);

  if (!res) return <Spinner label={t("scan.resolving")} />;

  if (res.status === "ok") {
    const bundle = bundleState.status === "ready" ? bundleState.bundle : null;
    const node = bundle ? lookup(bundle).nodes.get(res.checkpoint.nodeId) : undefined;
    const safeThen = then && then.startsWith("/") && !then.startsWith("//") ? then : null;
    return (
      <div className="border border-accent p-5" role="status">
        <p className="label-caps text-accent">{t("map.youAreHere")}</p>
        <p className="text-xl font-semibold mt-1">{t("scan.ok", { place: lt(res.checkpoint.label, prefs.locale) })}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {safeThen ? (
            <Button variant="primary" onClick={() => router.push(safeThen)}>
              {t("common.continue")}
            </Button>
          ) : (
            <ButtonLink href="/search" variant="primary">
              {t("scan.navigateFromHere")}
            </ButtonLink>
          )}
          {node ? <ButtonLink href={`/floors/${node.floorId}`}>{t("common.viewOnMap")}</ButtonLink> : null}
          {onReset ? <Button onClick={onReset}>{t("nav.scan")}</Button> : null}
        </div>
      </div>
    );
  }

  if (res.status === "wrong_university") {
    const other = universities?.find((u) => u.id === res.universityId);
    return (
      <div className="space-y-3">
        <Notice tone="warn">{t("scan.wrongUniversity")}</Notice>
        {other ? (
          <Button
            onClick={() => {
              setPrefs({ universityId: other.id, groupId: null });
              setRes(null);
              resolveCheckpointToken(token, other.id).then(setRes);
            }}
          >
            {t("scan.switchUniversity")}: {lt(other.name, prefs.locale)}
          </Button>
        ) : null}
      </div>
    );
  }

  const msg = {
    unknown: t("scan.unknown"),
    disabled: t("scan.disabled"),
    expired: t("scan.expired"),
    rate_limited: t("scan.rateLimited"),
    network_error: t("scan.network"),
  }[res.status];
  return <ErrorState title={msg} onRetry={onReset} retryLabel={t("common.retry")} />;
}
