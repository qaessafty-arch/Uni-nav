"use client";
import Link from "next/link";
import { lt } from "@campusnav/core";
import { formatDate } from "@campusnav/i18n";
import { Gate } from "@/components/Gate";
import { Panel } from "@/components/Blocks";
import { Badge, Button, EmptyState, PageTitle, Row } from "@/components/ui";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";
import { Icon } from "@/components/Icon";

export default function SavedPage() {
  const { t, prefs, saved, toggleSaved, history, clearHistory } = useApp();
  return (
    <Gate>
      {(bundle) => {
        const l = lookup(bundle);
        const loc = prefs.locale;
        const rooms = saved.map((id) => l.rooms.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
        return (
          <div className="space-y-6">
            <PageTitle eyebrow={t("nav.group.you")}>{t("saved.title")}</PageTitle>
            <div className="grid lg:grid-cols-2 gap-6">
              <Panel title={t("home.savedPlaces")}>
                {rooms.length === 0 ? (
                  <EmptyState title={t("home.noSaved")} />
                ) : (
                  <ul>
                    {rooms.map((r) => (
                      <li key={r.id} className="flex items-center gap-2 border-b border-line last:border-0">
                        <Link href={`/rooms/${r.id}`} className="flex-1 min-w-0 py-3 hover:underline">
                          <span className="block font-medium truncate">
                            {r.code} · {lt(r.name, loc)}
                          </span>
                          <span className="block text-xs text-muted truncate">{lt(l.buildings.get(r.buildingId)?.name, loc)} · {lt(l.floors.get(r.floorId)?.name, loc)}</span>
                        </Link>
                        <Link className="cn-btn cn-btn-primary !min-h-9" href={`/navigate?to=${r.id}`}>
                          {t("common.navigate")}
                        </Link>
                        <Button className="!min-h-9" onClick={() => toggleSaved(r.id)} aria-label={`${t("common.delete")} ${r.code}`}>
                          <Icon name="close" className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title={t("home.recent")} action={prefs.keepHistory && history.length ? <Button className="!min-h-8 text-xs" onClick={clearHistory}>{t("common.delete")}</Button> : undefined}>
                {!prefs.keepHistory ? (
                  <p className="text-sm text-muted">
                    {t("saved.historyOff")}{" "}
                    <Link className="text-accent underline" href="/settings">
                      {t("nav.settings")}
                    </Link>
                  </p>
                ) : history.length === 0 ? (
                  <EmptyState title={t("notifications.empty")} />
                ) : (
                  history.map((h) => {
                    const r = l.rooms.get(h.to);
                    return r ? <Row key={h.at} href={`/navigate?to=${r.id}`} title={`${r.code} · ${lt(r.name, loc)}`} subtitle={formatDate(loc, h.at)} meta={<Badge>{t("common.navigate")}</Badge>} /> : null;
                  })
                )}
              </Panel>
            </div>
          </div>
        );
      }}
    </Gate>
  );
}
