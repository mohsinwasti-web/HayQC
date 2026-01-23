import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useShipment, useContainers, useCreateContainer, usePurchaseOrder } from '@/hooks/useApi';
import { Header, ToggleButtonGroup } from '@/components/qc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const containerCodes = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10'];

export default function ContainerSetup() {
  const { shipmentId } = useParams<{ shipmentId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, canCreate } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Fetch shipment
  const { data: shipment, isLoading: shipmentLoading, error: shipmentError } = useShipment(
    shipmentId || '',
    { enabled: !!shipmentId }
  );

  // Fetch existing containers for code suggestion
  const { data: existingContainers = [] } = useContainers(shipmentId, { enabled: !!shipmentId });

  // Fetch PO for header
  const { data: po } = usePurchaseOrder(shipment?.poId || '', { enabled: !!shipment?.poId });

  // Create container mutation
  const createContainerMutation = useCreateContainer();

  // Find next available container code
  const usedCodes = existingContainers.map((c) => c.containerCode);
  const nextCode = containerCodes.find((c) => !usedCodes.includes(c)) || 'C01';

  const [formData, setFormData] = useState({
    containerCode: '',
    containerNumber: '',
    itemType: 'RHODES_GRASS',
    balePress: 'DOUBLE',
    baleSize: 'MEDIUM',
    avgExpectedWeight: '380',
  });

  const [error, setError] = useState('');

  // Update container code when existing containers load
  useEffect(() => {
    if (!formData.containerCode && nextCode) {
      setFormData(prev => ({ ...prev, containerCode: nextCode }));
    }
  }, [nextCode]);

  // Block users who can't create
  if (!canCreate) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-500 font-medium mb-2">Access Denied</p>
          <p className="text-muted-foreground mb-6">You don't have permission to create containers.</p>
          <Button onClick={() => navigate(`/shipment/${shipmentId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Shipment
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (shipmentLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Error state
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const newContainer = await createContainerMutation.mutateAsync({
        shipmentId: shipmentId || '',
        containerCode: formData.containerCode,
        containerNumber: formData.containerNumber.trim(),
        itemType: formData.itemType,
        balePress: formData.balePress,
        baleSize: formData.baleSize,
        avgExpectedWeight: parseFloat(formData.avgExpectedWeight) || 380,
        status: 'PENDING',
      });

      navigate(`/container/${newContainer.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create container');
    }
  };

  const itemTypeOptions = [
    { value: 'RHODES_GRASS', label: 'Rhodes Grass' },
    { value: 'WHEAT_STRAW', label: 'Wheat Straw' },
    { value: 'ALFALFA', label: 'Alfalfa' },
  ];

  const balePressOptions = [
    { value: 'SINGLE', label: 'Single' },
    { value: 'DOUBLE', label: 'Double' },
  ];

  const baleSizeOptions = [
    { value: 'SMALL', label: 'Small' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LARGE', label: 'Large' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        title="New Container"
        subtitle={shipment.shipmentCode}
        backPath={`/shipment/${shipmentId}`}
      />

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 p-4 space-y-6">
          {/* Container Code */}
          <div className="space-y-2">
            <Label>Container Code</Label>
            <Select
              value={formData.containerCode}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, containerCode: value }))
              }
            >
              <SelectTrigger className="h-14 text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {containerCodes.map((code) => (
                  <SelectItem
                    key={code}
                    value={code}
                    disabled={usedCodes.includes(code)}
                    className="h-12 text-base"
                  >
                    {code} {usedCodes.includes(code) && '(used)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Container Number */}
          <div className="space-y-2">
            <Label htmlFor="containerNumber">Container Number (Optional)</Label>
            <Input
              id="containerNumber"
              value={formData.containerNumber}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  containerNumber: e.target.value.toUpperCase(),
                }))
              }
              placeholder="e.g., MSCU1234567"
              className="h-14 text-lg uppercase"
            />
          </div>

          {/* Item Type */}
          <div className="space-y-3">
            <Label>Item Type</Label>
            <ToggleButtonGroup
              options={itemTypeOptions}
              value={formData.itemType}
              onChange={(value) => setFormData((prev) => ({ ...prev, itemType: value }))}
              size="large"
            />
          </div>

          {/* Bale Press */}
          <div className="space-y-3">
            <Label>Bale Press</Label>
            <ToggleButtonGroup
              options={balePressOptions}
              value={formData.balePress}
              onChange={(value) => setFormData((prev) => ({ ...prev, balePress: value }))}
              size="large"
            />
          </div>

          {/* Bale Size */}
          <div className="space-y-3">
            <Label>Bale Size</Label>
            <ToggleButtonGroup
              options={baleSizeOptions}
              value={formData.baleSize}
              onChange={(value) => setFormData((prev) => ({ ...prev, baleSize: value }))}
              size="large"
            />
            <p className="text-xs text-muted-foreground">
              Small: &lt;300kg | Medium: 300-400kg | Large: &gt;400kg
            </p>
          </div>

          {/* Avg Expected Weight */}
          <div className="space-y-2">
            <Label htmlFor="avgExpectedWeight">Avg Expected Weight (kg)</Label>
            <Input
              id="avgExpectedWeight"
              type="number"
              value={formData.avgExpectedWeight}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  avgExpectedWeight: e.target.value,
                }))
              }
              placeholder="380"
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
            <h3 className="font-medium mb-2">Quick Tip</h3>
            <p className="text-sm text-muted-foreground">
              After creating the container, assign inspectors to specific bale ranges
              before starting the inspection.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="p-4 bg-card border-t border-border safe-area-inset-bottom">
          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-lg"
            disabled={createContainerMutation.isPending}
          >
            {createContainerMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Create Container
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
