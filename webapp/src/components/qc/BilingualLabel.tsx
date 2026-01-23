import { cn } from '@/lib/utils';

interface BilingualLabelProps {
  en: string;
  ur?: string;
  showUrdu?: boolean;
  className?: string;
  urduClassName?: string;
}

export function BilingualLabel({
  en,
  ur,
  showUrdu = true,
  className,
  urduClassName,
}: BilingualLabelProps) {
  return (
    <span className={cn('inline-flex flex-col', className)}>
      <span>{en}</span>
      {showUrdu && ur && (
        <span className={cn('text-xs text-muted-foreground text-urdu', urduClassName)}>{ur}</span>
      )}
    </span>
  );
}
