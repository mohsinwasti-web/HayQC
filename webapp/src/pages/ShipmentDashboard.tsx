import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Plus, Box, CheckCircle, FileText, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useShipment, useContainers, useShipmentStats, usePurchaseOrder, useUpdateShipment } from '@/hooks/useApi';
import { Header, StatCard, ContainerCard, StatusBadge } from '@/components/qc';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export default function ShipmentDashboard() {
  const { shipmentId } = useParams<{ shipmentId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, canCreate, canEdit } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Fetch shipment
  const {
    data: shipment,
    isLoading: shipmentLoading,
    error: shipmentError
  } = useShipment(shipmentId || '', { enabled: !!shipmentId });

  // Fetch containers
  const { data: containers = [], isLoading: containersLoading } = useContainers(
    shipmentId,
    { enabled: !!shipmentId }
  );

  // Fetch stats
  const { data: stats } = useShipmentStats(shipmentId || '', { enabled: !!shipmentId });

  // Fetch PO for back path
  const { data: po } = usePurchaseOrder(
    shipment?.poId || '',
    { enabled: !!shipment?.poId }
  );

  // Update shipment mutation
  const updateShipmentMutation = useUpdateShipment();

  // Loading state
  if (shipmentLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading shipment...</p>
      </div>
    );
  }

  // Error state
  if (shipmentError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-500 mb-4">Failed to load shipment</p>
          <p className="text-sm text-muted-foreground mb-6">{shipmentError.message}</p>
          <Button onClick={() => navigate('/pos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Purchase Orders
          </Button>
        </div>
      </div>
    );
  }

  // Not found state
  if (!shipment) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-muted-foreground mb-4">Shipment not found</p>
          <Button onClick={() => navigate('/pos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Purchase Orders
          </Button>
        </div>
      </div>
    );
  }

  const handleMarkComplete = async () => {
    if (confirm('Mark this shipment as completed?')) {
      try {
        await updateShipmentMutation.mutateAsync({
          id: shipment.id,
          data: { status: 'COMPLETED' }
        });
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : 'Failed to update shipment', variant: 'destructive' });
      }
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        title={shipment.shipmentCode}
        subtitle={shipment.supplierName}
        backPath={po ? `/po/${po.id}` : '/pos'}
      />

      {/* Shipment Info */}
      <div className="p-4 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm text-muted-foreground">{formatDate(shipment.shipmentDate)}</p>
            <p className="font-medium">{po?.poNumber}</p>
          </div>
          <StatusBadge status={shipment.status} />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <StatCard
          label="Containers"
          value={containers.length}
          icon={<Box className="w-4 h-4" />}
        />
        <StatCard
          label="Accepted"
          value={stats?.accepted ?? 0}
          variant="success"
        />
        <StatCard
          label="Rejected"
          value={stats?.rejected ?? 0}
          variant="danger"
        />
      </div>

      {/* Total Weight */}
      <div className="px-4 pb-4">
        <div className="bg-muted rounded-xl p-4 flex justify-between items-center">
          <span className="text-muted-foreground">Total Weight</span>
          <span className="text-xl font-bold">{((stats?.totalWeight ?? 0) / 1000).toFixed(2)} MT</span>
        </div>
      </div>

      {/* Containers Section */}
      <div className="flex-1 p-4 pb-32">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Box className="w-5 h-5" />
            Containers ({containers.length})
          </h3>
        </div>

        <div className="space-y-3">
          {containersLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p>Loading containers...</p>
            </div>
          ) : containers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No containers yet</p>
              <p className="text-sm">Add a container to start inspection</p>
            </div>
          ) : (
            containers.map((container) => (
              <ContainerCard key={container.id} container={container} />
            ))
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border safe-area-inset-bottom">
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-14"
            onClick={() => navigate(`/shipment/${shipmentId}/summary`)}
          >
            <FileText className="w-5 h-5 mr-2" />
            Summary
          </Button>
          {shipment.status !== 'COMPLETED' && canEdit && (
            <Button
              variant="outline"
              size="lg"
              className="h-14"
              onClick={handleMarkComplete}
              disabled={updateShipmentMutation.isPending}
            >
              <CheckCircle className="w-5 h-5" />
            </Button>
          )}
          {shipment.status !== 'COMPLETED' && canCreate && (
            <Button
              size="lg"
              className="flex-1 h-14"
              onClick={() => navigate(`/shipment/${shipmentId}/container/new`)}
            >
              <Plus className="w-5 h-5 mr-2" />
              Container
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
