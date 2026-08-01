interface WarningBannerProps {
  message: string;
  variant?: 'warning' | 'error';
}

export function WarningBanner({ message, variant = 'warning' }: WarningBannerProps) {
  const styles =
    variant === 'error'
      ? 'bg-verdant-loss/10 border-verdant-loss/25 text-verdant-loss'
      : 'bg-verdant-caution/10 border-verdant-caution/25 text-verdant-caution';

  return (
    <div
      role="alert"
      className={`border text-sm px-4 py-2 rounded-lg flex items-start gap-2 ${styles}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="mt-0.5 shrink-0"
      >
        <path
          d="M12 9v4m0 3.5h.01M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
}
