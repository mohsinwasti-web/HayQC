import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePurchaseOrder, useShipments, useCreateShipment } from '@/hooks/useApi';
import { Header } from '@/components/qc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ShipmentSetup() {
  const { poId } = useParams<{ poId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, canCreate } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Fetch PO
  const { data: po, isLoading: poLoading, error: poError } = usePurchaseOrder(poId || '', { enabled: !!poId });

  // Fetch existing shipments for code suggestion
  const { data: existingShipments = [] } = useShipments(poId, { enabled: !!poId });

  // Create shipment mutation
  const createShipmentMutation = useCreateShipment();

  const [formData, setFormData] = useState({
    shipmentCode: '',
    supplierName: '',
    shipmentDate: new Date().toISOString().split('T')[0],
  });

  const [error, setError] = useState('');

  // Update shipment code when existing shipments load
  useEffect(() => {
    if (!formData.shipmentCode && existingShipments) {
      setFormData(prev => ({
        ...prev,
        shipmentCode: `SH-${String(existingShipments.length + 1).padStart(3, '0')}`
      }));
    }
  }, [existingShipments]);

  // Block users who can't create
  if (!canCreate) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-500 font-medium mb-2">Access Denied</p>
          <p className="text-muted-foreground mb-6">You don't have permission to create shipments.</p>
          <Button onClick={() => navigate(`/po/${poId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to PO
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (poLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Error state
  if (poError || !po) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.supplierName.trim()) {
      setError('Please enter supplier name');
      return;
    }

    try {
      const newShipment = await createShipmentMutation.mutateAsync({
        poId: poId || '',
        shipmentCode: formData.shipmentCode,
        supplierName: formData.supplierName.trim(),
        shipmentDate: new Date(formData.shipmentDate).toISOString(),
        status: 'PENDING',
      });

      navigate(`/shipment/${newShipment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shipment');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        title="New Shipment"
        subtitle={po.poNumber}
        backPath={`/po/${poId}`}
      />

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 p-4 space-y-6">
          {/* Shipment Code */}
          <div className="space-y-2">
            <Label htmlFor="shipmentCode">Shipment Code</Label>
            <Input
              id="shipmentCode"
              value={formData.shipmentCode}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, shipmentCode: e.target.value }))
              }
              placeholder="e.g., SH-001"
              className="h-14 text-lg"
            />
          </div>

          {/* Supplier Name */}
          <div className="space-y-2">
            <Label htmlFor="supplierName">Supplier Name</Label>
            <Input
              id="supplierName"
              value={formData.supplierName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, supplierName: e.target.value }))
              }
              placeholder="Enter supplier name"
              className="h-14 text-lg"
              autoFocus
            />
          </div>

          {/* Shipment Date */}
          <div className="space-y-2">
            <Label htmlFor="shipmentDate">Shipment Date</Label>
            <Input
              id="shipmentDate"
              type="date"
              value={formData.shipmentDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, shipmentDate: e.target.value }))
              }
              className="h-14 text-lg"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Info Card */}
          <div className="bg-muted rounded-xl p-4 mt-6">
            <h3 className="font-medium mb-2">Next Steps</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>1. Add containers to this shipment</li>
              <li>2. Assign inspectors to container ranges</li>
              <li>3. Start logging bales</li>
            </ul>
          </div>
        </div>

        {/* Save Button */}
        <div className="p-4 bg-card border-t border-border safe-area-inset-bottom">
          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-lg"
            disabled={createShipmentMutation.isPending}
          >
            {createShipmentMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Create Shipment
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
