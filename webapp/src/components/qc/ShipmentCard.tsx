import { useNavigate } from 'react-router-dom';
import { ChevronRight, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Shipment } from '@/types/qc';
import { StatusBadge } from './StatusBadge';
import { useShipmentStats } from '@/hooks/useApi';

interface ShipmentCardProps {
  shipment: Shipment;
  className?: string;
}

export function ShipmentCard({ shipment, className }: ShipmentCardProps) {
  const navigate = useNavigate();
  const { data: stats } = useShipmentStats(shipment.id, { enabled: !!shipment.id });

  const total = stats?.total ?? 0;
  const accepted = stats?.accepted ?? 0;
  const rejected = stats?.rejected ?? 0;
  const containerCount = stats?.containerCount ?? 0;

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <button
      onClick={() => navigate(`/shipment/${shipment.id}`)}
      className={cn(
        'w-full text-left bg-card rounded-xl border border-border p-4 shadow-sm',
        'hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-semibold text-base truncate">{shipment.shipmentCode}</span>
          </div>
          <p className="text-sm text-muted-foreground truncate">{shipment.supplierName}</p>
          <p className="text-sm text-muted-foreground">{formatDate(shipment.shipmentDate)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={shipment.status} />
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
        <div>
          <span className="text-muted-foreground">Containers:</span>{' '}
          <span className="font-medium">{containerCount}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Bales:</span>{' '}
          <span className="font-medium">{total}</span>
        </div>
        <div>
          <span className="text-green-600 font-medium">{accepted}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-red-600 font-medium">{rejected}</span>
        </div>
      </div>
    </button>
  );
}
