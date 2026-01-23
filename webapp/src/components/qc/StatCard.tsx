import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  variant?: 'default' | 'success' | 'danger' | 'warning';
  icon?: React.ReactNode;
  className?: string;
}

const variantStyles = {
  default: 'bg-card border-border',
  success: 'bg-green-50 border-green-200',
  danger: 'bg-red-50 border-red-200',
  warning: 'bg-amber-50 border-amber-200',
};

const valueStyles = {
  default: 'text-foreground',
  success: 'text-green-700',
  danger: 'text-red-700',
  warning: 'text-amber-700',
};

export function StatCard({
  label,
  value,
  sublabel,
  variant = 'default',
  icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex flex-col',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <span className={cn('text-2xl font-bold', valueStyles[variant])}>{value}</span>
      {sublabel && <span className="text-xs text-muted-foreground mt-1">{sublabel}</span>}
    </div>
  );
}
