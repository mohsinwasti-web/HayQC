import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Plus, Users, List, FileText, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useContainer, useBales, useContainerStats, useAssignments, useShipment, useUpdateContainer } from '@/hooks/useApi';
import { Header, StatCard, BaleCard, StatusBadge, ProgressRing } from '@/components/qc';
import { Button } from '@/components/ui/button';
import { itemTypeDisplay } from '@/types/qc';
import { toast } from '@/hooks/use-toast';

export default function ContainerDashboard() {
  const { containerId } = useParams<{ containerId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, canCreate, canEdit } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Fetch container
  const {
    data: container,
    isLoading: containerLoading,
    error: containerError
  } = useContainer(containerId || '', { enabled: !!containerId });

  // Fetch bales for this container
  const { data: bales = [] } = useBales(
    { containerId },
    { enabled: !!containerId }
  );

  // Fetch stats
  const { data: stats } = useContainerStats(containerId || '', { enabled: !!containerId });

  // Fetch assignments
  const { data: assignments = [] } = useAssignments(containerId, { enabled: !!containerId });

  // Fetch shipment for back navigation
  const { data: shipment } = useShipment(
    container?.shipmentId || '',
    { enabled: !!container?.shipmentId }
  );

  // Update container mutation
  const updateContainerMutation = useUpdateContainer();

  // Loading state
  if (containerLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading container...</p>
      </div>
    );
  }

  // Error state
  if (containerError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-500 mb-4">Failed to load container</p>
          <p className="text-sm text-muted-foreground mb-6">{containerError.message}</p>
          <Button onClick={() => navigate('/pos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Purchase Orders
          </Button>
        </div>
      </div>
    );
  }

  // Not found state
  if (!container) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-muted-foreground mb-4">Container not found</p>
          <Button onClick={() => navigate('/pos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Purchase Orders
          </Button>
        </div>
      </div>
    );
  }

  // Get recent bales (last 5)
  const recentBales = [...bales].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  // Target bales estimation
  const targetBales = 80;
  const total = stats?.total ?? bales.length;
  const accepted = stats?.accepted ?? 0;
  const rejected = stats?.rejected ?? 0;
  const totalWeight = stats?.totalWeight ?? 0;
  const acceptedWeight = stats?.acceptedWeight ?? 0;

  const progressPercent = Math.min(100, (total / targetBales) * 100);
  const acceptanceRate = total > 0 ? ((accepted / total) * 100).toFixed(1) : '0';

  const handleMarkComplete = async () => {
    if (confirm('Mark this container as completed?')) {
      try {
        await updateContainerMutation.mutateAsync({
          id: container.id,
          data: { status: 'COMPLETED' }
        });
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : 'Failed to update container', variant: 'destructive' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        title={container.containerCode}
        subtitle={container.containerNumber || itemTypeDisplay[container.itemType] || container.itemType}
        backPath={shipment ? `/shipment/${shipment.id}` : '/pos'}
      />

      {/* Container Info */}
      <div className="p-4 bg-card border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ProgressRing progress={progressPercent} size={64} />
            <div>
              <p className="font-semibold text-lg">{itemTypeDisplay[container.itemType] || container.itemType}</p>
              <p className="text-sm text-muted-foreground">
                {total} bales logged
              </p>
            </div>
          </div>
          <StatusBadge status={container.status} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <StatCard
          label="Accepted"
          value={accepted}
          sublabel={`${acceptanceRate}% acceptance`}
          variant="success"
        />
        <StatCard
          label="Rejected"
          value={rejected}
          variant="danger"
        />
        <StatCard
          label="Total Weight"
          value={`${(totalWeight / 1000).toFixed(2)}`}
          sublabel="Metric Tons"
        />
        <StatCard
          label="Accepted Weight"
          value={`${(acceptedWeight / 1000).toFixed(2)}`}
          sublabel="Metric Tons"
          variant="success"
        />
      </div>

      {/* Inspectors Section */}
      <div className="px-4 pb-4">
        <button
          onClick={() => navigate(`/container/${containerId}/assign`)}
          className="w-full bg-card rounded-xl border border-border p-4 flex items-center justify-between hover:border-primary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">Inspector Assignments</p>
              <p className="text-sm text-muted-foreground">
                {assignments.length === 0
                  ? 'No inspectors assigned'
                  : `${assignments.length} inspector(s) assigned`}
              </p>
            </div>
          </div>
          <span className="text-primary font-medium">Manage</span>
        </button>
      </div>

      {/* Recent Bales Section */}
      <div className="flex-1 p-4 pb-32">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Recent Bales</h3>
          {bales.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/container/${containerId}/bales`)}
            >
              <List className="w-4 h-4 mr-1" />
              View All ({bales.length})
            </Button>
          )}
        </div>

        {recentBales.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-muted rounded-xl">
            <p>No bales logged yet</p>
            <p className="text-sm">Start inspection by adding a bale</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentBales.map((bale) => (
              <BaleCard key={bale.id} bale={bale} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border safe-area-inset-bottom">
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="h-14"
            onClick={() => navigate(`/container/${containerId}/summary`)}
          >
            <FileText className="w-5 h-5" />
          </Button>
          {container.status !== 'COMPLETED' && canEdit && (
            <Button
              variant="outline"
              size="lg"
              className="h-14"
              onClick={handleMarkComplete}
              disabled={updateContainerMutation.isPending}
            >
              <CheckCircle className="w-5 h-5" />
            </Button>
          )}
          {container.status !== 'COMPLETED' && canCreate && (
            <Button
              size="lg"
              className="flex-1 h-14 text-lg"
              onClick={() => navigate(`/container/${containerId}/bale/new`)}
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Bale
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
