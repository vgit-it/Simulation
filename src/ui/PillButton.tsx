import type { ReactNode } from 'react';

interface PillButtonProps {
  onClick?: () => void;
  variant?: 'muted' | 'accent';
  disabled?: boolean;
  /** Extra classes, e.g. 'flex-1' for full-width sheet actions. */
  className?: string;
  children: ReactNode;
}

const variants = {
  muted: 'bg-text/10 px-3 py-1 text-xs text-muted',
  accent: 'bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-40',
};

/** The OS pill button, with uniform press feedback. */
export function PillButton({
  onClick,
  variant = 'muted',
  disabled,
  className = '',
  children,
}: PillButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full transition duration-150 ease-out-soft active:scale-95 active:opacity-90 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
