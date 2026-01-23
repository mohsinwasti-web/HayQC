import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, User, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useContainer, useAssignments, useCreateAssignment, useDeleteAssignment, useUsers, useShipment } from '@/hooks/useApi';
import { Header } from '@/components/qc';
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

export default function RangeAssignment() {
  const { containerId } = useParams<{ containerId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, companyId, canEdit } = useAuth();

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

  // Fetch assignments
  const { data: assignments = [] } = useAssignments(containerId, { enabled: !!containerId });

  // Fetch shipment for header
  const { data: shipment } = useShipment(
    container?.shipmentId || '',
    { enabled: !!container?.shipmentId }
  );

  // Fetch users (inspectors) for this company
  const { data: users = [] } = useUsers(companyId || undefined, 'INSPECTOR', { enabled: !!companyId });

  // Create/delete assignment mutations
  const createAssignmentMutation = useCreateAssignment();
  const deleteAssignmentMutation = useDeleteAssignment();

  const [newAssignment, setNewAssignment] = useState({
    inspectorId: '',
    rangeStart: '',
    rangeEnd: '',
  });

  // Block users who can't edit
  if (!canEdit) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-500 font-medium mb-2">Access Denied</p>
          <p className="text-muted-foreground mb-6">You don't have permission to manage assignments.</p>
          <Button onClick={() => navigate(`/container/${containerId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
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

  // Check for overlapping ranges
  const checkOverlap = (start: number, end: number, excludeId?: string): boolean => {
    return assignments.some((a) => {
      if (excludeId && a.id === excludeId) return false;
      return (
        (start >= a.rangeStart && start <= a.rangeEnd) ||
        (end >= a.rangeStart && end <= a.rangeEnd) ||
        (start <= a.rangeStart && end >= a.rangeEnd)
      );
    });
  };

  // Get user name by ID
  const getUserName = (userId: string): string => {
    const user = users.find(u => u.id === userId);
    return user?.name || 'Unknown';
  };

  const handleAddAssignment = async () => {
    const start = parseInt(newAssignment.rangeStart, 10);
    const end = parseInt(newAssignment.rangeEnd, 10);

    if (!newAssignment.inspectorId) {
      toast({ title: 'Please select an inspector', variant: 'destructive' });
      return;
    }

    if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
      toast({ title: 'Please enter valid range (start must be less than or equal to end)', variant: 'destructive' });
      return;
    }

    if (checkOverlap(start, end)) {
      toast({ title: 'This range overlaps with an existing assignment', variant: 'destructive' });
      return;
    }

    try {
      await createAssignmentMutation.mutateAsync({
        containerId: containerId || '',
        inspectorId: newAssignment.inspectorId,
        rangeStart: start,
        rangeEnd: end,
      });

      setNewAssignment({ inspectorId: '', rangeStart: '', rangeEnd: '' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed to create assignment', variant: 'destructive' });
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (confirm('Delete this assignment?')) {
      try {
        await deleteAssignmentMutation.mutateAsync(assignmentId);
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : 'Failed to delete assignment', variant: 'destructive' });
      }
    }
  };

  // Sort assignments by rangeStart
  const sortedAssignments = [...assignments].sort((a, b) => a.rangeStart - b.rangeStart);

  // Filter active inspectors
  const activeInspectors = users.filter(u => u.isActive);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        title="Assign Inspectors"
        subtitle={`${container.containerCode} - ${container.containerNumber || 'No number'}`}
        backPath={`/container/${containerId}`}
      />

      <div className="flex-1 p-4 space-y-6">
        {/* Current Assignments */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <User className="w-5 h-5" />
            Current Assignments ({assignments.length})
          </h3>

          {sortedAssignments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground bg-muted rounded-xl">
              <p>No inspectors assigned yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-card rounded-xl border border-border p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{getUserName(assignment.inspectorId)}</p>
                    <p className="text-sm text-muted-foreground">
                      Bales {assignment.rangeStart} - {assignment.rangeEnd}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteAssignment(assignment.id)}
                    disabled={deleteAssignmentMutation.isPending}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Visual Range Display */}
        {sortedAssignments.length > 0 && (
          <div className="bg-muted rounded-xl p-4">
            <h4 className="font-medium mb-3">Range Coverage</h4>
            <div className="flex flex-wrap gap-1">
              {sortedAssignments.map((a, i) => (
                <div
                  key={a.id}
                  className="px-3 py-1 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: `hsl(${(i * 60) % 360}, 70%, 85%)`,
                    color: `hsl(${(i * 60) % 360}, 70%, 25%)`,
                  }}
                >
                  {a.rangeStart}-{a.rangeEnd}: {getUserName(a.inspectorId).split(' ')[0]}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Assignment */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <h3 className="font-semibold">Add Assignment</h3>

          <div className="space-y-2">
            <Label>Inspector</Label>
            <Select
              value={newAssignment.inspectorId}
              onValueChange={(value) =>
                setNewAssignment((prev) => ({ ...prev, inspectorId: value }))
              }
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select inspector..." />
              </SelectTrigger>
              <SelectContent>
                {activeInspectors.map((user) => (
                  <SelectItem key={user.id} value={user.id} className="h-11">
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rangeStart">From Bale #</Label>
              <Input
                id="rangeStart"
                type="number"
                min="1"
                value={newAssignment.rangeStart}
                onChange={(e) =>
                  setNewAssignment((prev) => ({ ...prev, rangeStart: e.target.value }))
                }
                placeholder="1"
                className="h-12 text-lg text-center"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rangeEnd">To Bale #</Label>
              <Input
                id="rangeEnd"
                type="number"
                min="1"
                value={newAssignment.rangeEnd}
                onChange={(e) =>
                  setNewAssignment((prev) => ({ ...prev, rangeEnd: e.target.value }))
                }
                placeholder="50"
                className="h-12 text-lg text-center"
              />
            </div>
          </div>

          <Button
            onClick={handleAddAssignment}
            size="lg"
            className="w-full h-12"
            disabled={createAssignmentMutation.isPending}
          >
            <Plus className="w-5 h-5 mr-2" />
            {createAssignmentMutation.isPending ? 'Adding...' : 'Add Assignment'}
          </Button>
        </div>
      </div>

      {/* Done Button */}
      <div className="p-4 bg-card border-t border-border safe-area-inset-bottom">
        <Button
          variant="outline"
          size="lg"
          className="w-full h-14"
          onClick={() => navigate(`/container/${containerId}`)}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
