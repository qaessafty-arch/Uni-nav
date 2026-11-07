import { FILLED_ICONS, ICONS, type IconName } from "@campusnav/tokens";
import { cx } from "./ui";

/** An icon from the shared set, by path (`d`) or by `name`. Decorative unless `label` is given. */
export function Icon({ d, name, className, label }: { d?: string; name?: IconName; className?: string; label?: string }) {
  const path = d ?? (name ? ICONS[name] : "");
  const filled = name ? FILLED_ICONS.has(name) : false;
  return (
    <svg
      viewBox="0 0 24 24"
      className={cx("size-5 shrink-0", className)}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <path d={path} />
    </svg>
  );
}
