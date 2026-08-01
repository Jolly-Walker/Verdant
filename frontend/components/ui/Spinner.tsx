interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** `onDark` renders a white spinner for use on filled (e.g. moss) buttons. */
  tone?: 'default' | 'onDark';
  className?: string;
}

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-4',
};

const toneMap = {
  default: 'border-verdant-rule border-t-verdant-moss',
  onDark: 'border-white/40 border-t-white',
};

export function Spinner({ size = 'md', tone = 'default', className = '' }: SpinnerProps) {
  return (
    <div className={`animate-spin rounded-full ${toneMap[tone]} ${sizeMap[size]} ${className}`} />
  );
}
