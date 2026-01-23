import { cn } from '@/lib/utils';
import { BaleGrade, gradeDisplay } from '@/types/qc';

interface GradeBadgeProps {
  grade: BaleGrade;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const gradeColors: Record<BaleGrade, { bg: string; text: string; border: string }> = {
  [BaleGrade.A]: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
  },
  [BaleGrade.B]: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-300',
  },
  [BaleGrade.C]: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-300',
  },
  [BaleGrade.D]: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
  },
  [BaleGrade.REJECT]: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
  },
};

const sizeClasses = {
  small: 'px-2 py-0.5 text-xs',
  medium: 'px-3 py-1 text-sm',
  large: 'px-4 py-2 text-lg font-bold',
};

export function GradeBadge({ grade, size = 'medium', className }: GradeBadgeProps) {
  const colors = gradeColors[grade];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg border-2 font-semibold',
        colors.bg,
        colors.text,
        colors.border,
        sizeClasses[size],
        className
      )}
    >
      {gradeDisplay[grade]}
    </span>
  );
}
