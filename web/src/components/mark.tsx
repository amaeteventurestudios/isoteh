// The Isoteh mark: the cube outline from the logo, in terracotta.
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="var(--brand)" />
      <rect x="6" y="6" width="12" height="12" rx="2.6" fill="none" stroke="#fff" strokeWidth="1.9" />
      <rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1" fill="#fff" />
    </svg>
  );
}
