import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useContainer, useBales, useShipment, usePurchaseOrder, useCreateBale } from '@/hooks/useApi';
import { ToggleButtonGroup, PhotoCapture, BilingualLabel, GradeBadge } from '@/components/qc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Color,
  Stems,
  Wetness,
  Decision,
  SyncStatus,
  BaleGrade,
  bilingualLabels,
  rejectReasons,
  itemTypeDisplay,
  calculateBaleGrade,
} from '@/types/qc';

export default function BaleQC() {
  const { containerId } = useParams<{ containerId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, userId, canCreate } = useAuth();

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
  const { data: existingBales = [] } = useBales(
    { containerId },
    { enabled: !!containerId }
  );

  // Fetch shipment
  const { data: shipment } = useShipment(
    container?.shipmentId || '',
    { enabled: !!container?.shipmentId }
  );

  // Fetch PO
  const { data: po } = usePurchaseOrder(
    shipment?.poId || '',
    { enabled: !!shipment?.poId }
  );

  // Create bale mutation
  const createBaleMutation = useCreateBale();

  // Find next bale number
  const nextBaleNumber = existingBales.length > 0
    ? Math.max(...existingBales.map((b) => b.baleNumber)) + 1
    : 1;

  const [formData, setFormData] = useState({
    baleNumber: 1,
    weightKg: '',
    moisturePct: '',
    color: null as Color | null,
    stems: null as Stems | null,
    wetness: null as Wetness | null,
    contamination: false,
    mixedMaterial: false,
    mold: false,
    decision: null as Decision | null,
    rejectReason: '',
    photo1Url: null as string | null,
    photo2Url: null as string | null,
    notes: '',
  });

  const [isSaving, setIsSaving] = useState(false);

  // Calculate grade in real-time
  const calculatedGrade = useMemo(() => {
    if (!formData.color || !formData.wetness) return null;
    const moisture = formData.moisturePct ? parseFloat(formData.moisturePct) : null;
    return calculateBaleGrade(moisture, formData.color, formData.wetness, formData.mold, formData.contamination);
  }, [formData.color, formData.wetness, formData.moisturePct, formData.mold, formData.contamination]);

  // Update bale number when existing bales change
  useEffect(() => {
    const newNextNumber = existingBales.length > 0
      ? Math.max(...existingBales.map((b) => b.baleNumber)) + 1
      : 1;
    setFormData(prev => ({ ...prev, baleNumber: newNextNumber }));
  }, [existingBales.length]);

  // Block users who can't create bales
  if (!canCreate) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-500 font-medium mb-2">Access Denied</p>
          <p className="text-muted-foreground mb-6">You don't have permission to log bales.</p>
          <Button onClick={() => navigate(`/container/${containerId}`)}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Container
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (containerLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Error state
  if (containerError || !container) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Container not found</p>
      </div>
    );
  }

  // Wait for shipment and PO
  if (!shipment || !po) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading shipment data...</p>
      </div>
    );
  }

  const validateForm = (): boolean => {
    if (!formData.weightKg || parseFloat(formData.weightKg) <= 0) {
      toast({ title: 'Please enter a valid weight', variant: 'destructive' });
      return false;
    }
    if (!formData.color) {
      toast({ title: 'Please select color', variant: 'destructive' });
      return false;
    }
    if (!formData.stems) {
      toast({ title: 'Please select stems level', variant: 'destructive' });
      return false;
    }
    if (!formData.wetness) {
      toast({ title: 'Please select wetness level', variant: 'destructive' });
      return false;
    }
    if (!formData.decision) {
      toast({ title: 'Please make a decision (Accept/Reject)', variant: 'destructive' });
      return false;
    }
    if (formData.decision === Decision.REJECT && !formData.rejectReason) {
      toast({ title: 'Please select a reject reason', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSave = async (andNext: boolean) => {
    if (!validateForm()) return;

    setIsSaving(true);

    const moisture = formData.moisturePct ? parseFloat(formData.moisturePct) : null;
    const grade = calculateBaleGrade(moisture, formData.color!, formData.wetness!, formData.mold, formData.contamination);

    // Map frontend decision to backend decision
    // Frontend: ACCEPT/REJECT -> Backend: PASS/FAIL
    const backendDecision = formData.decision === Decision.ACCEPT ? 'PASS' :
                           formData.decision === Decision.REJECT ? 'FAIL' :
                           formData.decision;

    try {
      await createBaleMutation.mutateAsync({
        poId: po.id,
        shipmentId: shipment.id,
        containerId: containerId || '',
        inspectorId: userId || 'unknown',
        baleNumber: formData.baleNumber,
        baleIdDisplay: `${container.containerCode}-${String(formData.baleNumber).padStart(3, '0')}`,
        weightKg: parseFloat(formData.weightKg),
        moisturePct: moisture,
        color: formData.color!,
        stems: formData.stems!,
        wetness: formData.wetness!,
        contamination: formData.contamination,
        mixedMaterial: formData.mixedMaterial,
        mold: formData.mold,
        grade,
        decision: backendDecision as Decision,
        rejectReason: formData.decision === Decision.REJECT ? formData.rejectReason : null,
        photo1Url: formData.photo1Url,
        photo2Url: formData.photo2Url,
        notes: formData.notes || null,
        syncStatus: SyncStatus.SYNCED,
      });

      if (andNext) {
        // Reset form for next bale
        setFormData({
          baleNumber: formData.baleNumber + 1,
          weightKg: '',
          moisturePct: '',
          color: null,
          stems: null,
          wetness: null,
          contamination: false,
          mixedMaterial: false,
          mold: false,
          decision: null,
          rejectReason: '',
          photo1Url: null,
          photo2Url: null,
          notes: '',
        });
        setIsSaving(false);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate(`/container/${containerId}`);
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed to save bale', variant: 'destructive' });
      setIsSaving(false);
    }
  };

  const colorOptions = [
    { value: Color.DARK_GREEN, label: 'Dark Green', urduLabel: bilingualLabels.green.ur },
    { value: Color.GREEN, label: bilingualLabels.green.en, urduLabel: bilingualLabels.green.ur },
    { value: Color.LIGHT_GREEN, label: 'Light Green', urduLabel: bilingualLabels.green.ur },
    { value: Color.BROWN, label: bilingualLabels.brown.en, urduLabel: bilingualLabels.brown.ur },
  ];

  const stemsOptions = [
    { value: Stems.LOW, label: bilingualLabels.low.en, urduLabel: bilingualLabels.low.ur },
    { value: Stems.MED, label: bilingualLabels.med.en, urduLabel: bilingualLabels.med.ur },
    { value: Stems.HIGH, label: bilingualLabels.high.en, urduLabel: bilingualLabels.high.ur },
  ];

  const wetnessOptions = [
    { value: Wetness.DRY, label: bilingualLabels.dry.en, urduLabel: bilingualLabels.dry.ur },
    { value: Wetness.DAMP, label: bilingualLabels.damp.en, urduLabel: bilingualLabels.damp.ur },
    { value: Wetness.WET, label: bilingualLabels.wet.en, urduLabel: bilingualLabels.wet.ur },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/container/${containerId}`)}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <p className="font-semibold">{container.containerCode} - Bale #{formData.baleNumber}</p>
            <p className="text-sm opacity-80">{itemTypeDisplay[container.itemType] || container.itemType}</p>
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 p-4 space-y-5 pb-32">
        {/* Bale Number & Weight Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>
              <BilingualLabel en={bilingualLabels.baleNumber.en} ur={bilingualLabels.baleNumber.ur} />
            </Label>
            <Input
              type="number"
              value={formData.baleNumber}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, baleNumber: parseInt(e.target.value, 10) || 0 }))
              }
              className="input-large"
            />
          </div>
          <div className="space-y-2">
            <Label>
              <BilingualLabel en={bilingualLabels.weight.en} ur={bilingualLabels.weight.ur} />
            </Label>
            <Input
              type="number"
              value={formData.weightKg}
              onChange={(e) => setFormData((prev) => ({ ...prev, weightKg: e.target.value }))}
              placeholder="350"
              className="input-large"
              autoFocus
            />
          </div>
        </div>

        {/* Moisture % Direct Input */}
        <div className="space-y-2">
          <Label>
            <BilingualLabel en={bilingualLabels.moisturePct.en} ur={bilingualLabels.moisturePct.ur} /> (Optional)
          </Label>
          <Input
            type="number"
            value={formData.moisturePct}
            onChange={(e) => setFormData((prev) => ({ ...prev, moisturePct: e.target.value }))}
            placeholder="Enter moisture % if measured"
            className="h-14 text-lg"
          />
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label>
            <BilingualLabel en={bilingualLabels.color.en} ur={bilingualLabels.color.ur} />
          </Label>
          <ToggleButtonGroup
            options={colorOptions}
            value={formData.color}
            onChange={(v) => setFormData((prev) => ({ ...prev, color: v }))}
            size="large"
          />
        </div>

        {/* Stems */}
        <div className="space-y-2">
          <Label>
            <BilingualLabel en={bilingualLabels.stems.en} ur={bilingualLabels.stems.ur} />
          </Label>
          <ToggleButtonGroup
            options={stemsOptions}
            value={formData.stems}
            onChange={(v) => setFormData((prev) => ({ ...prev, stems: v }))}
            size="large"
          />
        </div>

        {/* Wetness */}
        <div className="space-y-2">
          <Label>
            <BilingualLabel en={bilingualLabels.wetness.en} ur={bilingualLabels.wetness.ur} />
          </Label>
          <ToggleButtonGroup
            options={wetnessOptions}
            value={formData.wetness}
            onChange={(v) => setFormData((prev) => ({ ...prev, wetness: v }))}
            size="large"
          />
        </div>

        {/* Grade Display (auto-calculated) */}
        {calculatedGrade && (
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">
                <BilingualLabel en={bilingualLabels.grade.en} ur={bilingualLabels.grade.ur} />
              </Label>
              <GradeBadge grade={calculatedGrade} size="large" />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Grade is auto-calculated based on moisture, color, and wetness
            </p>
          </div>
        )}

        {/* Defect Toggles */}
        <div className="space-y-3">
          <Label>Defects</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, contamination: !prev.contamination }))}
              className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                formData.contamination
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-border bg-background'
              }`}
            >
              <BilingualLabel
                en={bilingualLabels.contamination.en}
                ur={bilingualLabels.contamination.ur}
                className="text-sm"
              />
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, mixedMaterial: !prev.mixedMaterial }))}
              className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                formData.mixedMaterial
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-border bg-background'
              }`}
            >
              <BilingualLabel
                en={bilingualLabels.mixedMaterial.en}
                ur={bilingualLabels.mixedMaterial.ur}
                className="text-sm"
              />
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, mold: !prev.mold }))}
              className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                formData.mold
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-border bg-background'
              }`}
            >
              <BilingualLabel
                en={bilingualLabels.mold.en}
                ur={bilingualLabels.mold.ur}
                className="text-sm"
              />
            </button>
          </div>
        </div>

        {/* Decision - VERY LARGE BUTTONS */}
        <div className="space-y-3">
          <Label className="text-lg font-semibold">Decision</Label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, decision: Decision.ACCEPT, rejectReason: '' }))}
              className={`py-6 rounded-xl border-3 font-bold text-xl transition-all active:scale-95 ${
                formData.decision === Decision.ACCEPT
                  ? 'bg-green-500 text-white border-green-600 shadow-lg'
                  : 'bg-green-50 text-green-700 border-green-200 hover:border-green-400'
              }`}
            >
              <BilingualLabel
                en={bilingualLabels.accept.en}
                ur={bilingualLabels.accept.ur}
                showUrdu={true}
              />
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, decision: Decision.REJECT }))}
              className={`py-6 rounded-xl border-3 font-bold text-xl transition-all active:scale-95 ${
                formData.decision === Decision.REJECT
                  ? 'bg-red-500 text-white border-red-600 shadow-lg'
                  : 'bg-red-50 text-red-700 border-red-200 hover:border-red-400'
              }`}
            >
              <BilingualLabel
                en={bilingualLabels.reject.en}
                ur={bilingualLabels.reject.ur}
                showUrdu={true}
              />
            </button>
          </div>
        </div>

        {/* Reject Reason (conditional) */}
        {formData.decision === Decision.REJECT && (
          <div className="space-y-2">
            <Label>Reject Reason</Label>
            <Select
              value={formData.rejectReason}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, rejectReason: value }))}
            >
              <SelectTrigger className="h-14 text-lg">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {rejectReasons.map((reason) => (
                  <SelectItem key={reason} value={reason} className="h-12">
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Photos */}
        <div className="space-y-2">
          <Label>
            <BilingualLabel en={bilingualLabels.photo.en} ur={bilingualLabels.photo.ur} />
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <PhotoCapture
              label="Photo 1"
              value={formData.photo1Url}
              onChange={(path) => setFormData((prev) => ({ ...prev, photo1Url: path }))}
            />
            <PhotoCapture
              label="Photo 2"
              value={formData.photo2Url}
              onChange={(path) => setFormData((prev) => ({ ...prev, photo2Url: path }))}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>
            <BilingualLabel en={bilingualLabels.notes.en} ur={bilingualLabels.notes.ur} /> (Optional)
          </Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Additional notes..."
            className="min-h-[80px]"
          />
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border safe-area-inset-bottom">
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-14"
            onClick={() => handleSave(false)}
            disabled={isSaving || createBaleMutation.isPending}
          >
            <Save className="w-5 h-5 mr-2" />
            <BilingualLabel en={bilingualLabels.saveBack.en} ur={bilingualLabels.saveBack.ur} />
          </Button>
          <Button
            size="lg"
            className="flex-1 h-14 bg-primary"
            onClick={() => handleSave(true)}
            disabled={isSaving || createBaleMutation.isPending}
          >
            <BilingualLabel en={bilingualLabels.saveNext.en} ur={bilingualLabels.saveNext.ur} />
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
