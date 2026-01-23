import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useContainer, useBales, useShipment } from '@/hooks/useApi';
import { Header, BaleCard } from '@/components/qc';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Decision } from '@/types/qc';

export default function BaleReview() {
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

  // Fetch shipment for header
  const { data: shipment } = useShipment(
    container?.shipmentId || '',
    { enabled: !!container?.shipmentId }
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDecision, setFilterDecision] = useState<Decision | 'all'>('all');
  const [expandedBaleId, setExpandedBaleId] = useState<string | null>(null);

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

  // Sort bales by number descending (newest first)
  const sortedBales = [...bales].sort((a, b) => b.baleNumber - a.baleNumber);

  // Filter bales - handle both ACCEPT/REJECT and PASS/FAIL
  const filteredBales = sortedBales.filter((bale) => {
    const matchesSearch =
      searchQuery === '' ||
      bale.baleNumber.toString().includes(searchQuery) ||
      bale.baleIdDisplay.toLowerCase().includes(searchQuery.toLowerCase());

    // Map backend PASS/FAIL to frontend ACCEPT/REJECT
    const baleDecision = bale.decision === 'PASS' ? Decision.ACCEPT :
                         bale.decision === 'FAIL' ? Decision.REJECT :
                         bale.decision;

    const matchesDecision =
      filterDecision === 'all' || baleDecision === filterDecision;

    return matchesSearch && matchesDecision;
  });

  // Count accepted/rejected - handle both formats
  const acceptedCount = bales.filter((b) =>
    b.decision === Decision.ACCEPT || b.decision === 'PASS'
  ).length;
  const rejectedCount = bales.filter((b) =>
    b.decision === Decision.REJECT || b.decision === 'FAIL'
  ).length;

  const toggleExpand = (baleId: string) => {
    setExpandedBaleId(expandedBaleId === baleId ? null : baleId);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        title="Bale Review"
        subtitle={`${container.containerCode} - ${bales.length} bales`}
        backPath={`/container/${containerId}`}
      />

      {/* Search and Filter */}
      <div className="p-4 bg-card border-b border-border space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by bale number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant={filterDecision === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterDecision('all')}
            className="flex-1"
          >
            All ({bales.length})
          </Button>
          <Button
            variant={filterDecision === Decision.ACCEPT ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterDecision(Decision.ACCEPT)}
            className="flex-1"
          >
            Accepted ({acceptedCount})
          </Button>
          <Button
            variant={filterDecision === Decision.REJECT ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterDecision(Decision.REJECT)}
            className="flex-1"
          >
            Rejected ({rejectedCount})
          </Button>
        </div>
      </div>

      {/* Bale List */}
      <div className="flex-1 p-4 space-y-2 overflow-auto">
        {filteredBales.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No bales found</p>
          </div>
        ) : (
          filteredBales.map((bale) => (
            <BaleCard
              key={bale.id}
              bale={bale}
              showDetails={expandedBaleId === bale.id}
              onClick={() => toggleExpand(bale.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
