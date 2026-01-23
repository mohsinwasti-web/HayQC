import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Search } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePurchaseOrders } from '@/hooks/useApi';
import { Header, POCard } from '@/components/qc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const {
    companyId,
    logout,
    canCreate,
    canViewAllPOs,
    user,
    isAuthenticated
  } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Fetch POs for company from API
  const { data: allPOs = [], isLoading } = usePurchaseOrders(
    companyId || undefined,
    undefined,
    { enabled: !!companyId }
  );

  // Filter POs based on RBAC
  const accessiblePOs = useMemo(() => {
    if (canViewAllPOs) {
      // Supervisor/Inspector can see all company POs
      return allPOs;
    }
    // Customer/Supplier can only see assigned POs
    const assignedPoIds = user?.assignedPoIds || [];
    return allPOs.filter(po => assignedPoIds.includes(po.id));
  }, [allPOs, canViewAllPOs, user?.assignedPoIds]);

  // Apply search filter
  const filteredPOs = useMemo(() => {
    return accessiblePOs.filter(
      (po) =>
        po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.product.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [accessiblePOs, searchQuery]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCreatePO = () => {
    navigate('/po/new');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        title="Purchase Orders"
        subtitle={`${accessiblePOs.length} ${canViewAllPOs ? 'active' : 'assigned'} orders`}
        showBack={false}
        rightAction={
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        }
      />

      {/* Search */}
      <div className="p-4 bg-card border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search POs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>
      </div>

      {/* PO List */}
      <div className="flex-1 p-4 space-y-3 overflow-auto pb-24">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Loading purchase orders...</p>
          </div>
        ) : filteredPOs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{accessiblePOs.length === 0 ? 'No purchase orders available' : 'No purchase orders found'}</p>
          </div>
        ) : (
          filteredPOs.map((po) => <POCard key={po.id} po={po} />)
        )}
      </div>

      {/* Floating action button - only shown for users who can create */}
      {canCreate && (
        <div className="fixed bottom-6 right-6">
          <Button
            size="lg"
            className="w-14 h-14 rounded-full shadow-lg"
            onClick={handleCreatePO}
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
