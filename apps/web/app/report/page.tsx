"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { lt, PROBLEM_CATEGORIES, problemReportInputSchema, type ProblemCategory } from "@campusnav/core";
import { Gate } from "@/components/Gate";
import { nodeName } from "@/components/LocationPicker";
import { Button, ButtonLink, Notice, PageTitle } from "@/components/ui";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";
import { getDataSource } from "@/lib/config";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const idParam = (v: string | null) => (v && ID.test(v) ? v : null);

function ReportInner() {
  const { t, prefs } = useApp();
  const params = useSearchParams();
  const [category, setCategory] = useState<ProblemCategory>((PROBLEM_CATEGORIES as readonly string[]).includes(params.get("category") ?? "") ? (params.get("category") as ProblemCategory) : "wrong_location");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "demo" | "error" | "invalid">("idle");
  const roomId = idParam(params.get("room"));
  const fromId = idParam(params.get("from"));
  const toId = idParam(params.get("to"));
  const nodeId = idParam(params.get("node"));

  return (
    <Gate>
      {(bundle) => {
        const l = lookup(bundle);
        const loc = prefs.locale;
        const room = roomId ? l.rooms.get(roomId) : undefined;
        const from = fromId ? l.nodes.get(fromId) : undefined;
        const to = toId ? l.nodes.get(toId) : undefined;
        const node = nodeId ? l.nodes.get(nodeId) : undefined;
        const about = room ? `${room.code} · ${lt(room.name, loc)}` : from && to ? `${nodeName(from, l, loc)} → ${nodeName(to, l, loc)}` : node ? nodeName(node, l, loc) : null;

        if (state === "sent" || state === "demo") {
          return (
            <div className="max-w-xl">
              <PageTitle eyebrow={t("nav.report")}>{t("report.title")}</PageTitle>
              <Notice tone={state === "sent" ? "accent" : "warn"}>
                <p role="status">{state === "sent" ? t("report.sent") : t("report.demo")}</p>
              </Notice>
              <div className="mt-6 flex gap-2">
                <ButtonLink href="/" variant="primary">
                  {t("nav.home")}
                </ButtonLink>
                <Button onClick={() => { setMessage(""); setState("idle"); }}>{t("nav.report")}</Button>
              </div>
            </div>
          );
        }

        return (
          <div className="max-w-xl">
            <PageTitle eyebrow={t("nav.report")}>{t("report.title")}</PageTitle>
            <p className="text-muted mb-6">{t("report.intro")}</p>
            {about ? <p className="cn-locbar !cursor-default mb-5">{t("report.about", { place: about })}</p> : null}
            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                const input = {
                  universityId: bundle.university.id,
                  category,
                  message,
                  roomId: room?.id ?? null,
                  nodeId: node?.id ?? null,
                  routeFromNodeId: from?.id ?? null,
                  routeToNodeId: to?.id ?? null,
                };
                if (!problemReportInputSchema.safeParse(input).success) return setState("invalid");
                setState("sending");
                try {
                  const src = await getDataSource();
                  const res = await src.submitReport(input);
                  setState(res.status);
                } catch {
                  setState("error");
                }
              }}
            >
              <fieldset>
                <legend className="font-semibold mb-2">{t("report.category")}</legend>
                <div className="grid gap-2" role="radiogroup">
                  {PROBLEM_CATEGORIES.map((c) => (
                    <label key={c} className={`cn-locbar cursor-pointer ${category === c ? "!border-[var(--cn-accent)]" : ""}`}>
                      <input type="radio" name="category" value={c} checked={category === c} onChange={() => setCategory(c)} className="size-4 accent-[var(--cn-accent)]" />
                      <span>{t(`report.cat.${c}`)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="report-msg" className="font-semibold block mb-1">
                  {t("report.message")}
                </label>
                <p id="report-hint" className="text-sm text-muted mb-2">
                  {t("report.messageHint")}
                </p>
                <textarea
                  id="report-msg"
                  aria-describedby="report-hint"
                  className="cn-input w-full min-h-32 p-3"
                  maxLength={1000}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (state === "invalid") setState("idle");
                  }}
                />
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-danger" role="alert">
                    {state === "invalid" ? t("report.tooShort") : state === "error" ? t("report.error") : ""}
                  </span>
                  <span className="text-faint mono">{message.length}/1000</span>
                </div>
              </div>
              <Button type="submit" variant="primary" disabled={state === "sending"} className="w-full">
                {state === "sending" ? t("common.saving") : t("report.submit")}
              </Button>
            </form>
          </div>
        );
      }}
    </Gate>
  );
}

export default function ReportPage() {
  return (
    <Suspense>
      <ReportInner />
    </Suspense>
  );
}
