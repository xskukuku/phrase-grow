export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <span className={`logo-mark ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none" role="img">
        <path
          d="M20 31V18.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M19.8 22.4C12.4 22.6 8.2 18.2 8.2 10.4c7.7-.1 11.8 4 11.6 12Z"
          fill="currentColor"
          opacity=".95"
        />
        <path
          d="M20.2 18.1c.5-6.5 4.4-9.9 11.4-9.3-.2 7.3-4.4 11-11.4 9.3Z"
          fill="currentColor"
          opacity=".62"
        />
        <path
          d="M11.3 32.1h17.4"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity=".35"
        />
      </svg>
    </span>
  );
}
