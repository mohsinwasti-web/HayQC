import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import {
  Wheat,
  LogOut,
  Package,
  Settings,
  TrendingUp,
  CheckCircle,
  XCircle,
  Box,
  Clock
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useBales, useUserStats } from '@/hooks/useApi';
import { BilingualLabel } from '@/components/qc';
import { GradeBadge } from '@/components/qc/GradeBadge';
import { Button } from '@/components/ui/button';
import { bilingualLabels, BaleGrade, Decision } from '@/types/qc';

export default function InspectorDashboard() {
  const navigate = useNavigate();
  const {
    user: currentUser,
    company: currentCompany,
    userId,
    logout,
    isAuthenticated,
    isSupervisor
  } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Fetch user's bales from API
  const { data: userBales = [] } = useBales(
    { inspectorId: userId || undefined },
    { enabled: !!userId }
  );

  // Fetch user stats from API
  const { data: stats } = useUserStats(userId || '', { enabled: !!userId });

  if (!currentUser || !currentCompany) {
    return null;
  }

  // Get recent activity (last 10 bales)
  const recentBales = [...userBales]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  // Calculate grade distribution for all user's bales
  const gradeDistribution = {
    A: userBales.filter(b => b.grade === BaleGrade.A || b.grade === 'A').length,
    B: userBales.filter(b => b.grade === BaleGrade.B || b.grade === 'B').length,
    C: userBales.filter(b => b.grade === BaleGrade.C || b.grade === 'C').length,
    REJECT: userBales.filter(b => b.grade === BaleGrade.REJECT || b.grade === 'REJECT').length,
  };

  const totalGraded = gradeDistribution.A + gradeDistribution.B + gradeDistribution.C + gradeDistribution.REJECT;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Calculate acceptance rate from stats
  const todayCount = stats?.todayCount || 0;
  const acceptedCount = stats?.accepted || 0;
  const acceptanceRate = todayCount > 0
    ? ((acceptedCount / todayCount) * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-4 safe-area-inset-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Wheat className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-lg font-bold">
                <BilingualLabel en={bilingualLabels.dashboard.en} ur={bilingualLabels.dashboard.ur} />
              </h1>
              <p className="text-sm opacity-80">{currentCompany.name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Welcome Section */}
      <div className="px-4 py-4 bg-card border-b border-border">
        <p className="text-muted-foreground">Welcome back,</p>
        <h2 className="text-2xl font-bold">{currentUser.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">{currentUser.role}</p>
      </div>

      {/* Quick Stats */}
      <div className="p-4 space-y-4">
        <h3 className="font-semibold text-lg">Today's Activity</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-2xl font-bold">{stats?.todayCount || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground">Bales Logged</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-2xl font-bold text-green-600">{acceptanceRate}%</span>
            </div>
            <p className="text-xs text-muted-foreground">Acceptance</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Box className="w-4 h-4 text-amber-500" />
              <span className="text-2xl font-bold">{stats?.total || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total Bales</p>
          </div>
        </div>
      </div>

      {/* Grade Distribution */}
      {totalGraded > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="font-semibold mb-3">Grade Distribution (All Time)</h3>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <div className="h-16 bg-green-100 rounded-lg flex items-end justify-center pb-1 mb-1"
                  style={{
                    background: `linear-gradient(to top, rgb(34 197 94) ${(gradeDistribution.A / totalGraded) * 100}%, rgb(220 252 231) 0%)`
                  }}
                >
                  <span className="font-bold text-green-700">{gradeDistribution.A}</span>
                </div>
                <GradeBadge grade={BaleGrade.A} size="small" />
              </div>
              <div className="text-center">
                <div className="h-16 bg-amber-100 rounded-lg flex items-end justify-center pb-1 mb-1"
                  style={{
                    background: `linear-gradient(to top, rgb(245 158 11) ${(gradeDistribution.B / totalGraded) * 100}%, rgb(254 243 199) 0%)`
                  }}
                >
                  <span className="font-bold text-amber-700">{gradeDistribution.B}</span>
                </div>
                <GradeBadge grade={BaleGrade.B} size="small" />
              </div>
              <div className="text-center">
                <div className="h-16 bg-orange-100 rounded-lg flex items-end justify-center pb-1 mb-1"
                  style={{
                    background: `linear-gradient(to top, rgb(249 115 22) ${(gradeDistribution.C / totalGraded) * 100}%, rgb(255 237 213) 0%)`
                  }}
                >
                  <span className="font-bold text-orange-700">{gradeDistribution.C}</span>
                </div>
                <GradeBadge grade={BaleGrade.C} size="small" />
              </div>
              <div className="text-center">
                <div className="h-16 bg-red-100 rounded-lg flex items-end justify-center pb-1 mb-1"
                  style={{
                    background: `linear-gradient(to top, rgb(239 68 68) ${(gradeDistribution.REJECT / totalGraded) * 100}%, rgb(254 226 226) 0%)`
                  }}
                >
                  <span className="font-bold text-red-700">{gradeDistribution.REJECT}</span>
                </div>
                <GradeBadge grade={BaleGrade.REJECT} size="small" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="px-4 pb-4 flex-1">
        <h3 className="font-semibold mb-3">Recent Activity</h3>
        {recentBales.length === 0 ? (
          <div className="bg-muted rounded-xl p-6 text-center">
            <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No bales logged yet</p>
            <p className="text-sm text-muted-foreground">Start by selecting a Purchase Order</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentBales.map((bale) => (
              <div
                key={bale.id}
                className="bg-card rounded-lg border border-border p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    bale.decision === Decision.ACCEPT || bale.decision === 'ACCEPT' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {bale.decision === Decision.ACCEPT || bale.decision === 'ACCEPT' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">#{bale.baleNumber} - {bale.weightKg}kg</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(bale.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <GradeBadge grade={bale.grade as BaleGrade} size="small" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border safe-area-inset-bottom">
        <div className="grid grid-cols-2 gap-3">
          {/* Only show Admin button for supervisors */}
          {isSupervisor ? (
            <Button
              variant="outline"
              size="lg"
              className="h-14"
              onClick={() => navigate('/admin')}
            >
              <Settings className="w-5 h-5 mr-2" />
              <BilingualLabel en={bilingualLabels.companyAdmin.en} ur={bilingualLabels.companyAdmin.ur} />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              className="h-14"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-2" />
              <BilingualLabel en={bilingualLabels.logout.en} ur={bilingualLabels.logout.ur} />
            </Button>
          )}
          <Button
            size="lg"
            className="h-14"
            onClick={() => navigate('/pos')}
          >
            <Package className="w-5 h-5 mr-2" />
            <BilingualLabel en={bilingualLabels.purchaseOrders.en} ur={bilingualLabels.purchaseOrders.ur} />
          </Button>
        </div>
      </div>
    </div>
  );
}
