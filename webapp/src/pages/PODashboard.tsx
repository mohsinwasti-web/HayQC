import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Plus, Calendar, DollarSign, Package, Truck, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePurchaseOrder, useShipments, usePOStats } from '@/hooks/useApi';
import { Header, StatCard, ShipmentCard, StatusBadge } from '@/components/qc';
import { Button } from '@/components/ui/button';

export default function PODashboard() {
  const { poId } = useParams<{ poId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isAssignedToPO, canCreate, canViewAllPOs } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Fetch PO from API
  const {
    data: po,
    isLoading: poLoading,
    error: poError
  } = usePurchaseOrder(poId || '', { enabled: !!poId });

  // Fetch shipments from API
  const {
    data: shipments = [],
    isLoading: shipmentsLoading
  } = useShipments(poId, { enabled: !!poId });

  // Fetch PO stats from API
  const { data: stats } = usePOStats(poId || '', { enabled: !!poId });

  // RBAC check for customer/supplier - only see assigned POs
  const hasAccess = canViewAllPOs || (poId ? isAssignedToPO(poId) : false);

  // Loading state
  if (poLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading purchase order...</p>
      </div>
    );
  }

  // Error state
  if (poError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-500 mb-4">Failed to load purchase order</p>
          <p className="text-sm text-muted-foreground mb-6">{poError.message}</p>
          <Button onClick={() => navigate('/pos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Purchase Orders
          </Button>
        </div>
      </div>
    );
  }

  // Not found state
  if (!po) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-muted-foreground mb-4">Purchase order not found</p>
          <Button onClick={() => navigate('/pos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Purchase Orders
          </Button>
        </div>
      </div>
    );
  }

  // Access denied for customer/supplier without assignment
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-500 font-medium mb-2">Access Denied</p>
          <p className="text-muted-foreground mb-6">You are not assigned to this purchase order.</p>
          <Button onClick={() => navigate('/pos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Purchase Orders
          </Button>
        </div>
      </div>
    );
  }

  const deliveredMT = stats?.deliveredMT ?? 0;
  const progressPercent = po.contractQtyMt > 0
    ? Math.min(100, (deliveredMT / po.contractQtyMt) * 100)
    : 0;

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
        title={po.poNumber}
        subtitle={po.customerName}
        backPath="/pos"
      />

      {/* PO Summary Card */}
      <div className="p-4 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-lg">{po.product}</h2>
            <p className="text-sm text-muted-foreground">{po.customerName}</p>
          </div>
          <StatusBadge status={po.status} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{formatDate(po.poDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span>${po.pricePerMt ?? 0}/MT</span>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Contract Progress</span>
            <span className="font-medium">
              {deliveredMT.toFixed(1)} / {po.contractQtyMt} MT
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {(po.contractQtyMt - deliveredMT).toFixed(1)} MT remaining
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <StatCard
          label="Bales"
          value={stats?.total ?? 0}
          icon={<Package className="w-4 h-4" />}
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

      {/* Shipments Section */}
      <div className="flex-1 p-4 pb-24">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Shipments ({shipments.length})
          </h3>
        </div>

        <div className="space-y-3">
          {shipmentsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p>Loading shipments...</p>
            </div>
          ) : shipments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No shipments yet</p>
              <p className="text-sm">Add a shipment to get started</p>
            </div>
          ) : (
            shipments.map((shipment) => (
              <ShipmentCard key={shipment.id} shipment={shipment} />
            ))
          )}
        </div>
      </div>

      {/* Add Shipment Button - only for users who can create */}
      {canCreate && (
        <div className="fixed bottom-6 right-6">
          <Button
            size="lg"
            className="h-14 px-6 rounded-full shadow-lg"
            onClick={() => navigate(`/po/${poId}/shipment/new`)}
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Shipment
          </Button>
        </div>
      )}
    </div>
  );
}
