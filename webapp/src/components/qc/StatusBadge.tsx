import { cn } from '@/lib/utils';
import { POStatus, ShipmentStatus, ContainerStatus, Decision, SyncStatus } from '@/types/qc';

type StatusType = POStatus | ShipmentStatus | ContainerStatus | Decision | SyncStatus | string;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

function getStatusStyle(status: StatusType): string {
  switch (status) {
    // PO Status
    case POStatus.OPEN:
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case POStatus.IN_PROGRESS:
    case ShipmentStatus.IN_PROGRESS:
    case ContainerStatus.IN_PROGRESS:
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case POStatus.COMPLETED:
    case ShipmentStatus.COMPLETED:
    case ContainerStatus.COMPLETED:
    case SyncStatus.SYNCED:
      return 'bg-green-100 text-green-800 border-green-200';

    // Pending states
    case ShipmentStatus.PENDING:
    case ContainerStatus.PENDING:
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case SyncStatus.PENDING:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';

    // Decision
    case Decision.ACCEPT:
      return 'bg-green-100 text-green-800 border-green-200';
    case Decision.REJECT:
    case SyncStatus.ERROR:
      return 'bg-red-100 text-red-800 border-red-200';

    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getStatusLabel(status: StatusType): string {
  switch (status) {
    case POStatus.OPEN:
      return 'Open';
    case POStatus.IN_PROGRESS:
    case ShipmentStatus.IN_PROGRESS:
    case ContainerStatus.IN_PROGRESS:
      return 'In Progress';
    case POStatus.COMPLETED:
    case ShipmentStatus.COMPLETED:
    case ContainerStatus.COMPLETED:
      return 'Completed';
    case ShipmentStatus.PENDING:
    case ContainerStatus.PENDING:
      return 'Pending';
    case Decision.ACCEPT:
      return 'Accepted';
    case Decision.REJECT:
      return 'Rejected';
    case SyncStatus.PENDING:
      return 'Pending Sync';
    case SyncStatus.SYNCED:
      return 'Synced';
    case SyncStatus.ERROR:
      return 'Sync Error';
    default:
      return String(status);
  }
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = getStatusStyle(status);
  const label = getStatusLabel(status);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        style,
        className
      )}
    >
      {label}
    </span>
  );
}
