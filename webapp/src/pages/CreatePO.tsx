import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCreatePurchaseOrder, usePurchaseOrders } from '@/hooks/useApi';
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

const paymentTermsOptions = [
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'Advance Payment',
  'LC at Sight',
];

export default function CreatePO() {
  const navigate = useNavigate();
  const { company, companyId, isAuthenticated, canCreate } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Fetch existing POs to generate suggested PO number
  const { data: existingPOs = [] } = usePurchaseOrders(companyId || undefined, undefined, {
    enabled: !!companyId
  });

  // Create PO mutation
  const createPOMutation = useCreatePurchaseOrder();

  // Generate suggested PO number
  const currentYear = new Date().getFullYear();
  const existingPOsThisYear = existingPOs.filter(po =>
    po.poNumber.includes(String(currentYear))
  ).length;
  const suggestedPONumber = `PO-${currentYear}-${String(existingPOsThisYear + 1).padStart(3, '0')}`;

  const [formData, setFormData] = useState({
    poNumber: '',
    customerName: '',
    product: 'Rhodes Grass Hay',
    contractQtyMt: '',
    poDate: new Date().toISOString().split('T')[0],
    paymentTerms: 'Net 30',
    pricePerMt: '',
  });

  // Update PO number when suggestion changes
  useEffect(() => {
    if (suggestedPONumber && !formData.poNumber) {
      setFormData(prev => ({ ...prev, poNumber: suggestedPONumber }));
    }
  }, [suggestedPONumber]);

  const [error, setError] = useState('');

  // Block users who can't create
  if (!canCreate) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-500 font-medium mb-2">Access Denied</p>
          <p className="text-muted-foreground mb-6">You don't have permission to create purchase orders.</p>
          <Button onClick={() => navigate('/pos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Purchase Orders
          </Button>
        </div>
      </div>
    );
  }

  if (!company || !companyId) {
    return null;
  }

  const productOptions = [
    { value: 'Rhodes Grass Hay', label: 'Rhodes Grass Hay' },
    { value: 'Wheat Straw', label: 'Wheat Straw' },
    { value: 'Alfalfa', label: 'Alfalfa' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.poNumber.trim()) {
      setError('PO Number is required');
      return;
    }
    if (!formData.customerName.trim()) {
      setError('Customer name is required');
      return;
    }
    if (!formData.contractQtyMt || parseFloat(formData.contractQtyMt) <= 0) {
      setError('Contract quantity must be greater than 0');
      return;
    }
    if (!formData.pricePerMt || parseFloat(formData.pricePerMt) <= 0) {
      setError('Price per MT must be greater than 0');
      return;
    }

    try {
      const newPO = await createPOMutation.mutateAsync({
        companyId,
        poNumber: formData.poNumber.trim(),
        customerName: formData.customerName.trim(),
        product: formData.product,
        contractQtyMt: parseFloat(formData.contractQtyMt),
        poDate: new Date(formData.poDate).toISOString(),
        paymentTerms: formData.paymentTerms,
        pricePerMt: parseFloat(formData.pricePerMt),
        status: 'OPEN',
      });

      navigate(`/po/${newPO.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PO. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-4 safe-area-inset-top">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pos')}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold">New Purchase Order</h1>
            <p className="text-sm opacity-80">{company.name}</p>
          </div>
        </div>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-5 pb-24">
        {/* PO Number */}
        <div className="space-y-2">
          <Label htmlFor="poNumber">PO Number *</Label>
          <Input
            id="poNumber"
            value={formData.poNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, poNumber: e.target.value }))}
            placeholder="PO-2024-001"
            className="h-14 text-lg"
          />
        </div>

        {/* Customer Name */}
        <div className="space-y-2">
          <Label htmlFor="customerName">Customer Name *</Label>
          <Input
            id="customerName"
            value={formData.customerName}
            onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
            placeholder="e.g., Al Marai Dairy"
            className="h-14 text-lg"
          />
        </div>

        {/* Product */}
        <div className="space-y-2">
          <Label>Product *</Label>
          <ToggleButtonGroup
            options={productOptions}
            value={formData.product}
            onChange={(value) => setFormData(prev => ({ ...prev, product: value }))}
            size="large"
          />
        </div>

        {/* Contract Quantity & Price */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="contractQtyMt">Contract Qty (MT) *</Label>
            <Input
              id="contractQtyMt"
              type="number"
              step="0.1"
              value={formData.contractQtyMt}
              onChange={(e) => setFormData(prev => ({ ...prev, contractQtyMt: e.target.value }))}
              placeholder="500"
              className="h-14 text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pricePerMt">Price per MT *</Label>
            <Input
              id="pricePerMt"
              type="number"
              step="0.01"
              value={formData.pricePerMt}
              onChange={(e) => setFormData(prev => ({ ...prev, pricePerMt: e.target.value }))}
              placeholder="245"
              className="h-14 text-lg"
            />
          </div>
        </div>

        {/* PO Date */}
        <div className="space-y-2">
          <Label htmlFor="poDate">PO Date *</Label>
          <div className="relative">
            <Input
              id="poDate"
              type="date"
              value={formData.poDate}
              onChange={(e) => setFormData(prev => ({ ...prev, poDate: e.target.value }))}
              className="h-14 text-lg"
            />
          </div>
        </div>

        {/* Payment Terms */}
        <div className="space-y-2">
          <Label>Payment Terms *</Label>
          <Select
            value={formData.paymentTerms}
            onValueChange={(value) => setFormData(prev => ({ ...prev, paymentTerms: value }))}
          >
            <SelectTrigger className="h-14 text-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentTermsOptions.map((term) => (
                <SelectItem key={term} value={term} className="h-12">
                  {term}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contract Value Summary */}
        {formData.contractQtyMt && formData.pricePerMt && (
          <div className="bg-muted rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Contract Value</p>
            <p className="text-2xl font-bold">
              ${(parseFloat(formData.contractQtyMt) * parseFloat(formData.pricePerMt)).toLocaleString()}
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}
      </form>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border safe-area-inset-bottom">
        <Button
          onClick={handleSubmit}
          disabled={createPOMutation.isPending}
          size="lg"
          className="w-full h-14 text-lg font-semibold"
        >
          {createPOMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              Create Purchase Order
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
