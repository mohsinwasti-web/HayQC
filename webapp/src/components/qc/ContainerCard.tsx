import { useNavigate } from 'react-router-dom';
import { ChevronRight, Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container, itemTypeDisplay } from '@/types/qc';
import { StatusBadge } from './StatusBadge';
import { ProgressRing } from './ProgressRing';
import { useContainerStats } from '@/hooks/useApi';

interface ContainerCardProps {
  container: Container;
  targetBales?: number;
  className?: string;
}

export function ContainerCard({ container, targetBales = 80, className }: ContainerCardProps) {
  const navigate = useNavigate();
  const { data: stats } = useContainerStats(container.id, { enabled: !!container.id });

  const total = stats?.total ?? 0;
  const accepted = stats?.accepted ?? 0;
  const rejected = stats?.rejected ?? 0;
  const progressPercent = targetBales > 0 ? Math.min(100, (total / targetBales) * 100) : 0;

  return (
    <button
      onClick={() => navigate(`/container/${container.id}`)}
      className={cn(
        'w-full text-left bg-card rounded-xl border border-border p-4 shadow-sm',
        'hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <ProgressRing progress={progressPercent} size={56} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Box className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-semibold text-base">{container.containerCode}</span>
            <StatusBadge status={container.status} />
          </div>
          <p className="text-sm text-muted-foreground truncate">{container.containerNumber}</p>
          <p className="text-sm text-muted-foreground">{itemTypeDisplay[container.itemType] || container.itemType}</p>
        </div>

        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      </div>

      {/* Stats */}
      <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
        <div>
          <span className="text-muted-foreground">Bales:</span>{' '}
          <span className="font-medium">{total}</span>
        </div>
        <div>
          <span className="text-green-600 font-medium">{accepted}</span>
          <span className="text-muted-foreground mx-1">accepted</span>
        </div>
        <div>
          <span className="text-red-600 font-medium">{rejected}</span>
          <span className="text-muted-foreground mx-1">rejected</span>
        </div>
      </div>
    </button>
  );
}
