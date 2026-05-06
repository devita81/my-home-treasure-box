import * as Sentry from "@sentry/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PropertyProvider } from "@/contexts/PropertyContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorFallback } from "@/components/ErrorFallback";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import Index from "./pages/Index";
import AddProperty from "./pages/AddProperty";
import EditProperty from "./pages/EditProperty";
import PropertyDetails from "./pages/PropertyDetails";
import Analytics from "./pages/Analytics";
import Balancete from "./pages/Balancete";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";
import ItbiAdmin from "./pages/ItbiAdmin";
import ItbiSearch from "./pages/ItbiSearch";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

function SessionTimeoutWrapper({ children }: { children: React.ReactNode }) {
  useSessionTimeout();
  return <>{children}</>;
}

const App = () => (
  <Sentry.ErrorBoundary
    fallback={({ resetError }) => <ErrorFallback resetError={resetError} />}
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SessionTimeoutWrapper>
            <PropertyProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/add" element={<ProtectedRoute><AddProperty /></ProtectedRoute>} />
                  <Route path="/edit/:id" element={<ProtectedRoute><EditProperty /></ProtectedRoute>} />
                  <Route path="/property/:id" element={<ProtectedRoute><PropertyDetails /></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                  <Route path="/balancete" element={<ProtectedRoute><Balancete /></ProtectedRoute>} />
                  <Route path="/admin/itbi" element={<ProtectedRoute><ItbiAdmin /></ProtectedRoute>} />
                  <Route path="/itbi-search" element={<ProtectedRoute><ItbiSearch /></ProtectedRoute>} />
                  <Route path="/unsubscribe" element={<Unsubscribe />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </PropertyProvider>
          </SessionTimeoutWrapper>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;
