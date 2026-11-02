/** CAMPUS NAV mark: a square grid cell with a route vector — NULL-TECH geometric language. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="22" height="22" fill="none" stroke="var(--cn-text)" strokeWidth="2" />
      <path d="M6 18 L6 10 L14 10 L14 6" fill="none" stroke="var(--cn-accent)" strokeWidth="2.5" strokeLinecap="square" />
      <rect x="15.5" y="15.5" width="3" height="3" fill="var(--cn-accent)" />
    </svg>
  );
}
