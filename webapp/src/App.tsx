import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { AppErrorBoundary } from "@/components/system/AppErrorBoundary";
import { toast } from "sonner";

// Pages
import Login from "./pages/Login";
import CreateAccount from "./pages/CreateAccount";
import InspectorDashboard from "./pages/InspectorDashboard";
import CompanyAdmin from "./pages/CompanyAdmin";
import PurchaseOrders from "./pages/PurchaseOrders";
import CreatePO from "./pages/CreatePO";
import PODashboard from "./pages/PODashboard";
import ShipmentSetup from "./pages/ShipmentSetup";
import ShipmentDashboard from "./pages/ShipmentDashboard";
import ContainerSetup from "./pages/ContainerSetup";
import RangeAssignment from "./pages/RangeAssignment";
import ContainerDashboard from "./pages/ContainerDashboard";
import BaleQC from "./pages/BaleQC";
import BaleReview from "./pages/BaleReview";
import ContainerSummary from "./pages/ContainerSummary";
import ShipmentSummary from "./pages/ShipmentSummary";
import NotFound from "./pages/NotFound";

// Configure QueryClient with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds
    },
    mutations: {
      retry: 0,
      onError: (error) => {
        const message = error instanceof Error ? error.message : "An error occurred";
        toast.error(message);
      },
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppErrorBoundary>
          <BrowserRouter>
            <Routes>
              {/* Auth */}
              <Route path="/" element={<Login />} />
              <Route path="/create-account" element={<CreateAccount />} />

              {/* Dashboard */}
              <Route path="/dashboard" element={<InspectorDashboard />} />
              <Route path="/admin" element={<CompanyAdmin />} />

              {/* Purchase Orders */}
              <Route path="/pos" element={<PurchaseOrders />} />
              <Route path="/po/new" element={<CreatePO />} />
              <Route path="/po/:poId" element={<PODashboard />} />

              {/* Shipments */}
              <Route path="/po/:poId/shipment/new" element={<ShipmentSetup />} />
              <Route path="/shipment/:shipmentId" element={<ShipmentDashboard />} />
              <Route path="/shipment/:shipmentId/summary" element={<ShipmentSummary />} />

              {/* Containers */}
              <Route path="/shipment/:shipmentId/container/new" element={<ContainerSetup />} />
              <Route path="/container/:containerId" element={<ContainerDashboard />} />
              <Route path="/container/:containerId/assign" element={<RangeAssignment />} />
              <Route path="/container/:containerId/summary" element={<ContainerSummary />} />

              {/* Bales */}
              <Route path="/container/:containerId/bale/new" element={<BaleQC />} />
              <Route path="/container/:containerId/bales" element={<BaleReview />} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppErrorBoundary>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
