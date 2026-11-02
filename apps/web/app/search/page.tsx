"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { search } from "@campusnav/core";
import { Gate } from "@/components/Gate";
import { SearchBox, resultHref, useResultText } from "@/components/SearchBox";
import { Badge, PageTitle, Row } from "@/components/ui";
import { useApp } from "@/lib/store";
import type { CampusBundle, SearchIndex } from "@campusnav/core";

function Results({ bundle, index, q }: { bundle: CampusBundle; index: SearchIndex; q: string }) {
  const { t } = useApp();
  const results = useMemo(() => search(index, q, { limit: 50 }), [index, q]);
  const text = useResultText(bundle);
  if (!q) return null;
  if (!results.length) return <p className="text-muted mt-6">{t("search.noResults", { q })}</p>;
  return (
    <div className="mt-6">
      {results.map((r) => {
        const { title, subtitle } = text(r);
        return <Row key={`${r.type}-${r.id}`} href={resultHref(r)} title={title} subtitle={subtitle} leading={<Badge>{t(`search.type.${r.type}`)}</Badge>} />;
      })}
    </div>
  );
}

function SearchInner() {
  const { t } = useApp();
  const q = useSearchParams().get("q") ?? "";
  return (
    <Gate>
      {(bundle, index) => (
        <div className="max-w-2xl">
          <PageTitle>{t("search.title")}</PageTitle>
          <SearchBox bundle={bundle} index={index} initial={q} autoFocus />
          <Results bundle={bundle} index={index} q={q} />
        </div>
      )}
    </Gate>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}
