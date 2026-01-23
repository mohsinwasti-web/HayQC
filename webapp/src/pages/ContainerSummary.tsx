import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Download, Check, X, Scale, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useContainer, useBales, useContainerStats, useShipment } from '@/hooks/useApi';
import { Header, ProgressRing } from '@/components/qc';
import { Button } from '@/components/ui/button';
import { Decision, itemTypeDisplay } from '@/types/qc';
import { toast } from '@/hooks/use-toast';

export default function ContainerSummary() {
  const { containerId } = useParams<{ containerId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

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

  // Fetch bales
  const { data: bales = [] } = useBales(
    { containerId },
    { enabled: !!containerId }
  );

  // Fetch stats
  const { data: stats } = useContainerStats(containerId || '', { enabled: !!containerId });

  // Fetch shipment for header
  const { data: shipment } = useShipment(
    container?.shipmentId || '',
    { enabled: !!container?.shipmentId }
  );

  // Loading state
  if (containerLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Error/not found state
  if (containerError || !container) {
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

  // Calculate stats - handle both ACCEPT/REJECT and PASS/FAIL
  const total = stats?.total ?? bales.length;
  const accepted = stats?.accepted ?? bales.filter((b) =>
    b.decision === Decision.ACCEPT || b.decision === 'PASS'
  ).length;
  const rejected = stats?.rejected ?? bales.filter((b) =>
    b.decision === Decision.REJECT || b.decision === 'FAIL'
  ).length;
  const totalWeight = stats?.totalWeight ?? bales.reduce((sum, b) => sum + b.weightKg, 0);
  const acceptedWeight = stats?.acceptedWeight ?? bales
    .filter((b) => b.decision === Decision.ACCEPT || b.decision === 'PASS')
    .reduce((sum, b) => sum + b.weightKg, 0);

  // Calculate reject reasons breakdown - handle both formats
  const rejectedBales = bales.filter((b) =>
    b.decision === Decision.REJECT || b.decision === 'FAIL'
  );
  const rejectReasonsCount = rejectedBales.reduce((acc, bale) => {
    const reason = bale.rejectReason || 'Unknown';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedRejectReasons = Object.entries(rejectReasonsCount)
    .sort(([, a], [, b]) => b - a);

  const acceptanceRate = total > 0 ? ((accepted / total) * 100) : 0;

  const handleExport = () => {
    toast({ title: 'Export functionality coming soon. This will generate a PDF/Excel report.' });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        title="Container Summary"
        subtitle={`${container.containerCode} - ${container.containerNumber || itemTypeDisplay[container.itemType] || container.itemType}`}
        backPath={`/container/${containerId}`}
      />

      <div className="flex-1 p-4 space-y-6 pb-24">
        {/* Overview Card */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">{container.containerCode}</h2>
              <p className="text-muted-foreground">{itemTypeDisplay[container.itemType] || container.itemType}</p>
            </div>
            <ProgressRing progress={acceptanceRate} size={80} />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-green-700">{accepted}</span>
              </div>
              <p className="text-sm text-green-600">Accepted</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <X className="w-5 h-5 text-red-600" />
                <span className="text-2xl font-bold text-red-700">{rejected}</span>
              </div>
              <p className="text-sm text-red-600">Rejected</p>
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
              <span className="text-muted-foreground">Total Weight</span>
              <span className="font-semibold">{(totalWeight / 1000).toFixed(3)} MT</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Accepted Weight</span>
              <span className="font-semibold text-green-600">
                {(acceptedWeight / 1000).toFixed(3)} MT
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Average Bale Weight</span>
              <span className="font-semibold">
                {total > 0 ? (totalWeight / total).toFixed(1) : 0} kg
              </span>
            </div>
          </div>
        </div>

        {/* Reject Reasons Breakdown */}
        {sortedRejectReasons.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Rejection Reasons
            </h3>
            <div className="space-y-3">
              {sortedRejectReasons.map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between">
                  <span className="text-sm">{reason}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${(count / rejectedBales.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quality Indicators */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-semibold mb-4">Quality Indicators</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-xl font-bold">
                {bales.filter((b) => b.contamination).length}
              </p>
              <p className="text-xs text-muted-foreground">Contamination</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-xl font-bold">
                {bales.filter((b) => b.mixedMaterial).length}
              </p>
              <p className="text-xs text-muted-foreground">Mixed Material</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-xl font-bold">{bales.filter((b) => b.mold).length}</p>
              <p className="text-xs text-muted-foreground">Mold</p>
            </div>
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border safe-area-inset-bottom">
        <Button size="lg" className="w-full h-14" onClick={handleExport}>
          <Download className="w-5 h-5 mr-2" />
          Export Report
        </Button>
      </div>
    </div>
  );
}
