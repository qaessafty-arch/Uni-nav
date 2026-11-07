"use client";
import { useEffect } from "react";
import { readableWithWhite, type University } from "@campusnav/core";

/**
 * Applies the university's brand colour to the accent tokens (buttons, route
 * line, selection) in both themes. Colours that would make white text
 * unreadable (below WCAG AA 4.5:1) are ignored and the default blue stays.
 */
export function BrandStyle({ branding }: { branding: University["branding"] | undefined }) {
  const c = branding?.primaryColor;
  useEffect(() => {
    const id = "cn-brand";
    document.getElementById(id)?.remove();
    if (!c || !readableWithWhite(c)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
:root:root[data-theme="light"]{--cn-accent:${c};--cn-accent-text:#FFFFFF;--cn-accent-soft:color-mix(in srgb, ${c} 10%, #FFFFFF);--cn-map-selected:color-mix(in srgb, ${c} 18%, #FFFFFF);--cn-map-route:${c}}
:root:root[data-theme="dark"]{--cn-accent:color-mix(in srgb, ${c} 55%, #FFFFFF);--cn-accent-text:#0B1220;--cn-accent-soft:color-mix(in srgb, ${c} 28%, #0F1115);--cn-map-selected:color-mix(in srgb, ${c} 30%, #0F1115);--cn-map-route:color-mix(in srgb, ${c} 55%, #FFFFFF)}`;
    document.head.appendChild(el);
    return () => el.remove();
  }, [c]);
  return null;
}

/** The university logo when published, else the CAMPUS NAV mark. */
export function UniversityLogo({ branding, fallback }: { branding: University["branding"] | undefined; fallback: React.ReactNode }) {
  if (!branding?.logoUrl) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={branding.logoUrl} alt="" className="size-7 object-contain shrink-0" data-testid="university-logo" />;
}
