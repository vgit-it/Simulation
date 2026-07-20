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
  muted: 'bg-text/10 px-space-lg py-1.5 text-text/80',
  accent: 'bg-accent px-space-xl py-2 text-white disabled:opacity-40',
};

/** The OS pill button: label typography, full-round shape, uniform press feedback. */
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
      className={`type-label rounded-ds-full transition duration-150 ease-out-soft active:scale-95 active:opacity-90 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
