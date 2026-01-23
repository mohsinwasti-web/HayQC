import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wheat } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies, useLoginUsers, useLogin } from '@/hooks/useApi';
import { BilingualLabel } from '@/components/qc';
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
import { bilingualLabels } from '@/types/qc';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated, isSupervisor, isInspector } = useAuth();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Fetch companies from API
  const { data: companies = [], isLoading: companiesLoading } = useCompanies();

  // Fetch users for selected company
  const { data: companyUsers = [], isLoading: usersLoading, isError: usersError } = useLoginUsers(
    selectedCompanyId || undefined,
    undefined
  );

  // Login mutation
  const loginMutation = useLogin();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedUserId(''); // Reset user when company changes
    setPin('');
    setError('');
  };

  const handleStartInspection = async () => {
    if (!selectedCompanyId) {
      setError('Please select a company');
      return;
    }
    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }
    if (!pin || pin.length !== 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    try {
      const result = await loginMutation.mutateAsync({
        companyId: selectedCompanyId,
        userId: selectedUserId,
        pin,
      });

      // Set auth state (persists to localStorage)
      setAuth(result);

      // Navigate based on role
      const role = result.user.role;
      if (role === 'SUPERVISOR' || role === 'INSPECTOR') {
        navigate('/dashboard');
      } else {
        // Customer/Supplier go to POs list
        navigate('/pos');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with logo */}
      <div className="bg-primary text-primary-foreground py-8 px-6">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
            <Wheat className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold text-center">HayQC</h1>
          <p className="text-sm opacity-80 mt-1">Bale Logging & Quality Control</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          {/* Company selection */}
          <div className="space-y-3 mb-6">
            <label className="block">
              <BilingualLabel
                en={bilingualLabels.company.en}
                ur={bilingualLabels.company.ur}
                className="text-sm font-medium mb-2 block"
              />
            </label>
            <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
              <SelectTrigger className="h-14 text-lg">
                <SelectValue placeholder={companiesLoading ? "Loading..." : "Select company..."} />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id} className="h-12 text-base">
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User selection */}
          <div className="space-y-3 mb-6">
            <label className="block">
              <BilingualLabel
                en={bilingualLabels.inspector.en}
                ur={bilingualLabels.inspector.ur}
                className="text-sm font-medium mb-2 block"
              />
            </label>
            <Select
              value={selectedUserId}
              onValueChange={(value) => {
                setSelectedUserId(value);
                setError('');
              }}
              disabled={!selectedCompanyId || usersLoading}
            >
              <SelectTrigger className="h-14 text-lg">
                <SelectValue
                  placeholder={
                    !selectedCompanyId
                      ? "Select company first..."
                      : usersLoading
                        ? "Loading users..."
                        : "Select user..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {usersError ? (
                  <div className="p-3 text-sm text-red-600">Failed to load users</div>
                ) : companyUsers.length === 0 && !usersLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">No active users found</div>
                ) : (
                  companyUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id} className="h-12 text-base">
                      {user.name} ({user.role})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* PIN field */}
          <div className="space-y-3 mb-6">
            <Label className="block">
              <BilingualLabel
                en={bilingualLabels.pin.en}
                ur={bilingualLabels.pin.ur}
                className="text-sm font-medium"
              />
            </Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPin(value);
                setError('');
              }}
              placeholder="****"
              className="w-full h-14 text-2xl text-center tracking-[0.5em] rounded-xl border-2"
              disabled={!selectedUserId}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Login button */}
          <Button
            onClick={handleStartInspection}
            disabled={!selectedCompanyId || !selectedUserId || pin.length !== 4 || loginMutation.isPending}
            size="lg"
            className="w-full h-16 text-lg font-semibold rounded-xl"
          >
            {loginMutation.isPending ? (
              'Logging in...'
            ) : (
              <BilingualLabel
                en={bilingualLabels.login.en}
                ur={bilingualLabels.login.ur}
                showUrdu={true}
              />
            )}
          </Button>

          {/* Create Account link */}
          <div className="mt-6 text-center">
            <Link
              to="/create-account"
              className="text-primary hover:underline font-medium"
            >
              <BilingualLabel
                en={bilingualLabels.createAccount.en}
                ur={bilingualLabels.createAccount.ur}
              />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>Version 2.0</p>
        </div>
      </div>
    </div>
  );
}
