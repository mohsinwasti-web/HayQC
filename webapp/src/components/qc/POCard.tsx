import { useNavigate } from 'react-router-dom';
import { ChevronRight, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PurchaseOrder } from '@/types/qc';
import { StatusBadge } from './StatusBadge';
import { usePOStats } from '@/hooks/useApi';

interface POCardProps {
  po: PurchaseOrder;
  className?: string;
}

export function POCard({ po, className }: POCardProps) {
  const navigate = useNavigate();
  const { data: stats } = usePOStats(po.id, { enabled: !!po.id });

  const deliveredMT = stats?.deliveredMT ?? (stats?.totalWeight ? stats.totalWeight / 1000 : 0);
  const progressPercent = po.contractQtyMt > 0
    ? Math.min(100, (deliveredMT / po.contractQtyMt) * 100)
    : 0;

  return (
    <button
      onClick={() => navigate(`/po/${po.id}`)}
      className={cn(
        'w-full text-left bg-card rounded-xl border border-border p-4 shadow-sm',
        'hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-semibold text-base truncate">{po.poNumber}</span>
          </div>
          <p className="text-sm text-muted-foreground truncate">{po.customerName}</p>
          <p className="text-sm text-muted-foreground">{po.product}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={po.status} />
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">
            {deliveredMT.toFixed(1)} / {po.contractQtyMt} MT
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </button>
  );
}
