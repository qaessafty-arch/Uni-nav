"use client";
import Link from "next/link";
import { useState } from "react";
import { executeIntent, RuleBasedIntentParser, type AssistantAnswer } from "@campusnav/core";
import { Gate } from "@/components/Gate";
import { resultHref, useResultText } from "@/components/SearchBox";
import { Badge, Button, Notice, PageTitle, Row } from "@/components/ui";
import { useApp } from "@/lib/store";

const parser = new RuleBasedIntentParser();

/**
 * Campus assistant (offline, rule-based). Every answer is a lookup in the campus
 * bundle; nothing is generated. An LLM parser can be plugged in via IntentParser.
 */
export default function AssistantPage() {
  const { t } = useApp();
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  return (
    <Gate>
      {(bundle) => (
        <AssistantInner bundle={bundle} q={q} setQ={setQ} answer={answer} setAnswer={setAnswer} t={t} />
      )}
    </Gate>
  );
}

function AssistantInner({ bundle, q, setQ, answer, setAnswer, t }: { bundle: Parameters<typeof executeIntent>[1]; q: string; setQ: (s: string) => void; answer: AssistantAnswer | null; setAnswer: (a: AssistantAnswer) => void; t: ReturnType<typeof useApp>["t"] }) {
  const text = useResultText(bundle);
  return (
    <div className="max-w-2xl">
      <PageTitle>{t("assistant.title")}</PageTitle>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) setAnswer(executeIntent(parser.parse(q), bundle));
        }}
      >
        <label htmlFor="ask" className="sr-only">{t("assistant.title")}</label>
        <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("assistant.placeholder")} maxLength={300} className="flex-1 min-h-12 bg-surface border border-line-strong px-3" />
        <Button type="submit" variant="primary">{t("common.search")}</Button>
      </form>
      <p className="text-xs text-faint mt-2">{t("assistant.offlineNote")}</p>
      <div className="mt-6" aria-live="polite">
        {!answer ? null : answer.kind === "timetable" ? (
          <Link href={answer.intent.type === "next_lecture" ? "/" : "/timetable"} className="underline">
            {answer.intent.type === "next_lecture" ? t("home.nextLecture") : t("timetable.title")} →
          </Link>
        ) : answer.kind === "not_found" ? (
          <Notice tone="warn">{t("assistant.notFound")}</Notice>
        ) : answer.kind === "unsupported" ? (
          <Notice>{t("assistant.unsupported")}</Notice>
        ) : (
          <div>
            {answer.kind === "clarify" ? <p className="mb-2 font-medium">{t("assistant.clarify")}</p> : null}
            {(answer.kind === "clarify" ? answer.options : answer.results).map((r) => {
              const { title, subtitle } = text(r);
              const href = answer.intent.type === "navigate" && r.type === "room" ? `/navigate?to=${r.id}` : resultHref(r);
              return <Row key={`${r.type}-${r.id}`} href={href} title={title} subtitle={subtitle} leading={<Badge>{t(`search.type.${r.type}`)}</Badge>} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
