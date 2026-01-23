import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Download, Check, X, Box, Scale, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useShipment, useContainers, useShipmentStats, useBales, usePurchaseOrder, useUpdateShipment } from '@/hooks/useApi';
import { Header, ContainerCard } from '@/components/qc';
import { Button } from '@/components/ui/button';
import { Decision } from '@/types/qc';
import { toast } from '@/hooks/use-toast';

export default function ShipmentSummary() {
  const { shipmentId } = useParams<{ shipmentId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, canEdit } = useAuth();

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
  const { data: containers = [] } = useContainers(shipmentId, { enabled: !!shipmentId });

  // Fetch stats
  const { data: stats } = useShipmentStats(shipmentId || '', { enabled: !!shipmentId });

  // Fetch bales
  const { data: bales = [] } = useBales(
    { shipmentId },
    { enabled: !!shipmentId }
  );

  // Fetch PO for header
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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Error/not found state
  if (shipmentError || !shipment) {
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

  // Calculate stats - handle both ACCEPT/REJECT and PASS/FAIL
  const total = stats?.total ?? bales.length;
  const accepted = stats?.accepted ?? bales.filter((b) =>
    b.decision === Decision.ACCEPT || b.decision === 'PASS'
  ).length;
  const rejected = stats?.rejected ?? bales.filter((b) =>
    b.decision === Decision.REJECT || b.decision === 'FAIL'
  ).length;
  const totalWeight = stats?.totalWeight ?? bales.reduce((sum, b) => sum + b.weightKg, 0);

  const acceptanceRate = total > 0 ? ((accepted / total) * 100) : 0;
  const acceptedWeight = bales
    .filter((b) => b.decision === Decision.ACCEPT || b.decision === 'PASS')
    .reduce((sum, b) => sum + b.weightKg, 0);

  const handleExportEvidencePack = () => {
    toast({
      title: 'Export Evidence Pack coming soon',
      description: 'This will generate a comprehensive PDF including shipment summary, container reports, photos, and QC decisions.'
    });
  };

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
        title="Shipment Summary"
        subtitle={shipment.shipmentCode}
        backPath={`/shipment/${shipmentId}`}
      />

      <div className="flex-1 p-4 space-y-6 pb-32">
        {/* Overview Card */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">{shipment.shipmentCode}</h2>
              <p className="text-muted-foreground">{shipment.supplierName}</p>
              <p className="text-sm text-muted-foreground">{formatDate(shipment.shipmentDate)}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">{acceptanceRate.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">Acceptance Rate</p>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-green-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-green-700">{accepted}</span>
              </div>
              <p className="text-sm text-green-600">Bales Accepted</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <X className="w-5 h-5 text-red-600" />
                <span className="text-2xl font-bold text-red-700">{rejected}</span>
              </div>
              <p className="text-sm text-red-600">Bales Rejected</p>
            </div>
          </div>
        </div>

        {/* Weight Summary */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5" />
            Weight Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Total Inspected</span>
              <span className="font-semibold">{(totalWeight / 1000).toFixed(3)} MT</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Accepted Weight</span>
              <span className="font-semibold text-green-600">
                {(acceptedWeight / 1000).toFixed(3)} MT
              </span>
            </div>
            {po && (
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Contract Qty</span>
                <span className="font-semibold">{po.contractQtyMt} MT</span>
              </div>
            )}
          </div>
        </div>

        {/* Containers Overview */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Box className="w-5 h-5" />
            Containers ({containers.length})
          </h3>
          <div className="space-y-3">
            {containers.map((container) => (
              <ContainerCard key={container.id} container={container} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border safe-area-inset-bottom">
        <div className="flex gap-3">
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
          <Button size="lg" className="flex-1 h-14" onClick={handleExportEvidencePack}>
            <Download className="w-5 h-5 mr-2" />
            Export Evidence Pack
          </Button>
        </div>
      </div>
    </div>
  );
}
