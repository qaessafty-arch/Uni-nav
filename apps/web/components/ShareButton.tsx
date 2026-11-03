"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { Icon } from "./Icon";
import { I } from "./icons";
import { Button } from "./ui";

/** Share a path on this site via the native share sheet, or copy the link. */
export function ShareButton({ path, label, className, title }: { path: string; label?: string; className?: string; title?: string }) {
  const { t } = useApp();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      className={className}
      title={title}
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        try {
          if (navigator.share) await navigator.share({ url });
          else {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        } catch {
          /* user cancelled */
        }
      }}
    >
      <Icon d={I.share} className="size-4" /> {copied ? t("navigate.copied") : (label ?? t("navigate.share"))}
    </Button>
  );
}
