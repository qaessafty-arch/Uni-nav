import { FILLED_ICONS, ICONS, type IconName } from "@campusnav/tokens";

/** Shared CAMPUS NAV icon (same set as the student app). */
export function Icon({ d, name, className = "size-[18px]", label }: { d?: string; name?: IconName; className?: string; label?: string }) {
  const path = d ?? (name ? ICONS[name] : "");
  const filled = name ? FILLED_ICONS.has(name) : false;
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <path d={path} />
    </svg>
  );
}
