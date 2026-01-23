import { cn } from '@/lib/utils';

interface ToggleButtonGroupProps<T extends string> {
  options: { value: T; label: string; urduLabel?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  size?: 'default' | 'large';
  className?: string;
}

export function ToggleButtonGroup<T extends string>({
  options,
  value,
  onChange,
  size = 'default',
  className,
}: ToggleButtonGroupProps<T>) {
  return (
    <div className={cn('flex gap-2', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-xl border-2 font-semibold transition-all duration-150 active:scale-95',
            size === 'large' ? 'py-4 px-4 text-lg' : 'py-3 px-3 text-base',
            value === option.value
              ? 'border-primary bg-primary text-primary-foreground shadow-md'
              : 'border-border bg-background text-foreground hover:border-primary/50'
          )}
        >
          <span className="block">{option.label}</span>
          {option.urduLabel && (
            <span className="block text-xs opacity-75 text-urdu mt-0.5">{option.urduLabel}</span>
          )}
        </button>
      ))}
    </div>
  );
}
