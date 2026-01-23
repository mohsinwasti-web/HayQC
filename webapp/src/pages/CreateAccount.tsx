import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCreateCompany, useCreateUser } from '@/hooks/useApi';
import { BilingualLabel } from '@/components/qc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bilingualLabels } from '@/types/qc';

export default function CreateAccount() {
  const navigate = useNavigate();
  const createCompanyMutation = useCreateCompany();
  const createUserMutation = useCreateUser();

  const [formData, setFormData] = useState({
    companyName: '',
    companyCode: '',
    address: '',
    contactEmail: '',
    contactPhone: '',
    adminName: '',
    adminEmail: '',
    adminPin: '',
    confirmPin: '',
  });

  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.companyName.trim()) {
      setError('Company name is required');
      return;
    }
    if (!formData.companyCode.trim() || formData.companyCode.length < 2) {
      setError('Company code must be at least 2 characters');
      return;
    }
    if (!formData.adminName.trim()) {
      setError('Admin name is required');
      return;
    }
    if (!formData.adminEmail.trim() || !formData.adminEmail.includes('@')) {
      setError('Valid admin email is required');
      return;
    }
    if (formData.adminPin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }
    if (formData.adminPin !== formData.confirmPin) {
      setError('PINs do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create company
      const company = await createCompanyMutation.mutateAsync({
        name: formData.companyName.trim(),
        code: formData.companyCode.trim().toUpperCase(),
        address: formData.address.trim() || null,
        contactEmail: formData.contactEmail.trim() || null,
        contactPhone: formData.contactPhone.trim() || null,
      });

      // Create admin user (as SUPERVISOR)
      await createUserMutation.mutateAsync({
        companyId: company.id,
        name: formData.adminName.trim(),
        email: formData.adminEmail.trim(),
        pin: formData.adminPin,
        role: 'SUPERVISOR',
        isActive: true,
      });

      // Navigate to login
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-6 px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">
              <BilingualLabel
                en={bilingualLabels.createAccount.en}
                ur={bilingualLabels.createAccount.ur}
              />
            </h1>
            <p className="text-sm opacity-80">Set up your company account</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-6 overflow-auto pb-24">
        {/* Company Info Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Company Information</h2>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder="e.g., Al Dayer Trading Co."
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyCode">Company Code *</Label>
            <Input
              id="companyCode"
              value={formData.companyCode}
              onChange={(e) => setFormData(prev => ({ ...prev, companyCode: e.target.value.toUpperCase() }))}
              placeholder="e.g., ADT"
              maxLength={5}
              className="h-12 uppercase"
            />
            <p className="text-xs text-muted-foreground">2-5 characters, used for bale IDs</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="City, Country"
              className="h-12"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                placeholder="info@company.com"
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                placeholder="+974-xxxx-xxxx"
                className="h-12"
              />
            </div>
          </div>
        </div>

        {/* Admin Info Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Admin Account</h2>

          <div className="space-y-2">
            <Label htmlFor="adminName">Admin Name *</Label>
            <Input
              id="adminName"
              value={formData.adminName}
              onChange={(e) => setFormData(prev => ({ ...prev, adminName: e.target.value }))}
              placeholder="Your full name"
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminEmail">Admin Email *</Label>
            <Input
              id="adminEmail"
              type="email"
              value={formData.adminEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, adminEmail: e.target.value }))}
              placeholder="admin@company.com"
              className="h-12"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="adminPin">PIN *</Label>
              <Input
                id="adminPin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={formData.adminPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setFormData(prev => ({ ...prev, adminPin: value }));
                }}
                placeholder="****"
                className="h-12 text-center text-xl tracking-widest"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPin">Confirm PIN *</Label>
              <Input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={formData.confirmPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setFormData(prev => ({ ...prev, confirmPin: value }));
                }}
                placeholder="****"
                className="h-12 text-center text-xl tracking-widest"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">PIN must be exactly 4 digits</p>
        </div>

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
          disabled={isSubmitting || createCompanyMutation.isPending || createUserMutation.isPending}
          size="lg"
          className="w-full h-14 text-lg font-semibold"
        >
          {isSubmitting ? 'Creating...' : 'Create Account'}
        </Button>
      </div>
    </div>
  );
}
