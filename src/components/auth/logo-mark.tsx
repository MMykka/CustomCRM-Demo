export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M16 2 L29 9 L16 16 L3 9 Z" fill="currentColor" />
      <path d="M3 9 L16 16 L16 30 L3 23 Z" fill="currentColor" opacity="0.55" />
      <path d="M29 9 L16 16 L16 30 L29 23 Z" fill="currentColor" opacity="0.8" />
    </svg>
  );
}
