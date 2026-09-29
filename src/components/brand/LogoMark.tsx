export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <rect x="7" y="8" width="18" height="3.2" rx="1" fill="#fff" />
      <rect x="7" y="14.4" width="18" height="3.2" rx="1" fill="#fff" opacity="0.85" />
      <rect x="7" y="20.8" width="12" height="3.2" rx="1" fill="#fff" />
    </svg>
  );
}
