import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, User, Mail, ToggleLeft, ToggleRight, X, Check, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUsers, useCreateUser, useUpdateUser } from '@/hooks/useApi';
import { BilingualLabel } from '@/components/qc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { bilingualLabels, User as UserType, UserRole, roleDisplay } from '@/types/qc';

export default function CompanyAdmin() {
  const navigate = useNavigate();
  const {
    company,
    user: currentUser,
    companyId,
    isAuthenticated,
    isSupervisor
  } = useAuth();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    pin: '',
    confirm_pin: '',
    role: 'INSPECTOR' as UserRole,
  });
  const [error, setError] = useState('');

  // Fetch users from API
  const { data: companyUsers = [], isLoading } = useUsers(
    companyId || undefined,
    undefined,
    { enabled: !!companyId }
  );

  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Block non-supervisors
  if (!isSupervisor) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="bg-card rounded-xl border border-border p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            Only supervisors can access the Company Admin panel.
          </p>
          <Button onClick={() => navigate('/dashboard')} className="w-full">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!company || !currentUser) {
    return null;
  }

  const handleAddUser = async () => {
    setError('');

    if (!newUser.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!newUser.email.trim() || !newUser.email.includes('@')) {
      setError('Valid email is required');
      return;
    }
    if (newUser.pin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }
    if (newUser.pin !== newUser.confirm_pin) {
      setError('PINs do not match');
      return;
    }

    try {
      await createUserMutation.mutateAsync({
        companyId: companyId!,
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        pin: newUser.pin,
        role: newUser.role,
        isActive: true,
      });

      setNewUser({ name: '', email: '', pin: '', confirm_pin: '', role: 'INSPECTOR' });
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const toggleUserStatus = async (user: UserType) => {
    // Don't allow deactivating yourself
    if (user.id === currentUser.id) {
      toast({ title: 'You cannot deactivate your own account', variant: 'destructive' });
      return;
    }

    try {
      await updateUserMutation.mutateAsync({
        id: user.id,
        data: { isActive: !user.isActive },
      });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed to update user', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-4 safe-area-inset-top">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold">
              <BilingualLabel en={bilingualLabels.companyAdmin.en} ur={bilingualLabels.companyAdmin.ur} />
            </h1>
            <p className="text-sm opacity-80">{company.name}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-6 pb-24">
        {/* Company Info */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-semibold mb-3">Company Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{company.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Code</span>
              <span className="font-medium">{company.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Address</span>
              <span className="font-medium">{company.address || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{company.contactEmail || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{company.contactPhone || '-'}</span>
            </div>
          </div>
        </div>

        {/* Users Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Users ({companyUsers.length})</h2>
            <Button
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Add User Form */}
          {showAddForm && (
            <div className="bg-card rounded-xl border border-border p-4 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Add New User</h3>
                <button onClick={() => setShowAddForm(false)}>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input
                    value={newUser.name}
                    onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="User name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="user@company.com"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Role *</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value: UserRole) => setNewUser(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(roleDisplay) as UserRole[]).map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleDisplay[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>PIN *</Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={newUser.pin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setNewUser(prev => ({ ...prev, pin: value }));
                      }}
                      placeholder="****"
                      className="h-11 text-center tracking-widest"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Confirm PIN *</Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={newUser.confirm_pin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setNewUser(prev => ({ ...prev, confirm_pin: value }));
                      }}
                      placeholder="****"
                      className="h-11 text-center tracking-widest"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-sm">{error}</p>
                )}

                <Button
                  onClick={handleAddUser}
                  className="w-full h-11"
                  disabled={createUserMutation.isPending}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {createUserMutation.isPending ? 'Adding...' : 'Add User'}
                </Button>
              </div>
            </div>
          )}

          {/* User List */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading users...</p>
              </div>
            ) : companyUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No users found</p>
              </div>
            ) : (
              companyUsers.map((user) => (
                <div
                  key={user.id}
                  className={`bg-card rounded-xl border p-4 ${
                    user.isActive ? 'border-border' : 'border-red-200 bg-red-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        user.isActive ? 'bg-primary/10' : 'bg-red-100'
                      }`}>
                        <User className={`w-5 h-5 ${user.isActive ? 'text-primary' : 'text-red-500'}`} />
                      </div>
                      <div>
                        <p className="font-medium">
                          {user.name}
                          {user.id === currentUser.id && (
                            <span className="ml-2 text-xs text-primary">(You)</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {roleDisplay[user.role as UserRole] || user.role}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleUserStatus(user)}
                      disabled={user.id === currentUser.id || updateUserMutation.isPending}
                      className={`p-2 rounded-lg transition-colors ${
                        user.id === currentUser.id
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {user.isActive ? (
                        <ToggleRight className="w-8 h-8 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-red-400" />
                      )}
                    </button>
                  </div>

                  {!user.isActive && (
                    <p className="text-xs text-red-500 mt-2">Inactive - Cannot log in</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border safe-area-inset-bottom">
        <Button
          variant="outline"
          size="lg"
          className="w-full h-14"
          onClick={() => navigate('/dashboard')}
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
