interface AvatarProps {
  emoji: string;
  size?: 'sm' | 'md';
}

const sizes = {
  sm: 'h-7 w-7 text-base',
  md: 'h-11 w-11 text-xl',
};

/** The circular emoji avatar used in lists and chips. */
export function Avatar({ emoji, size = 'md' }: AvatarProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-text/10 ${sizes[size]}`}
    >
      {emoji}
    </span>
  );
}
