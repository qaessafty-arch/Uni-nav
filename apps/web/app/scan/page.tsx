"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { parseCheckpointPayload } from "@campusnav/core";
import { CheckpointResult } from "@/components/CheckpointResult";
import { Button, Notice, PageTitle } from "@/components/ui";
import { useApp } from "@/lib/store";

type CamState = "idle" | "starting" | "running" | "denied" | "unavailable";

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/**
 * Camera QR scanning. Uses the native BarcodeDetector where available, else
 * jsQR (lazy-loaded) on video frames. Camera permission is requested only when
 * the user taps "Start camera"; manual code entry always works.
 */
function ScanInner() {
  const { t } = useApp();
  const then = useSearchParams().get("then");
  const [cam, setCam] = useState<CamState>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const accept = useCallback(
    (raw: string) => {
      const p = parseCheckpointPayload(raw, [window.location.host]);
      if (!p.ok) return false;
      stop();
      setCam("idle");
      setToken(p.token);
      return true;
    },
    [stop],
  );

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam("unavailable");
      return;
    }
    setCam("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCam("running");
      const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const detector: Detector | null = BD ? new BD({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      let busy = false;
      const tick = async () => {
        if (!streamRef.current) return;
        if (!busy && video.readyState >= 2) {
          busy = true;
          try {
            if (detector) {
              const codes = await detector.detect(video);
              for (const c of codes) if (accept(c.rawValue)) return;
            } else if (jsQR) {
              const w = (canvas.width = Math.min(640, video.videoWidth));
              const h = (canvas.height = Math.round((video.videoHeight / video.videoWidth) * w));
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
              if (code && accept(code.data)) return;
            }
          } catch {
            /* transient decode errors */
          }
          busy = false;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      stop();
      setCam(e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "denied" : "unavailable");
    }
  };

  return (
    <div className="max-w-xl">
      <PageTitle>{t("scan.title")}</PageTitle>
      {token ? (
        <CheckpointResult token={token} then={then} onReset={() => setToken(null)} />
      ) : (
        <>
          <div className="relative aspect-square bg-black border border-line-strong overflow-hidden">
            <video ref={videoRef} className="absolute inset-0 size-full object-cover" playsInline muted aria-label={t("scan.hint")} />
            {cam !== "running" ? (
              <div className="absolute inset-0 grid place-items-center p-6 text-center grid-bg">
                <div>
                  <p className="text-muted mb-4">{t("scan.hint")}</p>
                  <Button variant="primary" onClick={startCamera} disabled={cam === "starting"}>
                    {t("scan.startCamera")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="absolute inset-[18%] border-2 border-accent pointer-events-none" aria-hidden />
            )}
          </div>
          {cam === "denied" ? <div className="mt-3"><Notice tone="warn">{t("scan.cameraDenied")}</Notice></div> : null}
          {cam === "unavailable" ? <div className="mt-3"><Notice tone="warn">{t("scan.cameraUnavailable")}</Notice></div> : null}

          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              setManualError(!accept(manual));
            }}
          >
            <label htmlFor="manual-code" className="label-caps">
              {t("scan.manual")}
            </label>
            <div className="flex gap-2 mt-2">
              <input
                id="manual-code"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder={t("scan.manualPlaceholder")}
                className="flex-1 min-h-11 bg-surface border border-line-strong px-3 mono"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={512}
                aria-invalid={manualError}
                aria-describedby={manualError ? "manual-error" : undefined}
              />
              <Button type="submit" disabled={!manual.trim()}>
                {t("scan.submit")}
              </Button>
            </div>
            {manualError ? (
              <p id="manual-error" className="text-danger text-sm mt-2">
                {t("scan.unknown")}
              </p>
            ) : null}
          </form>
        </>
      )}
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense>
      <ScanInner />
    </Suspense>
  );
}
