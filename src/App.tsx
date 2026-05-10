import * as Sentry from "@sentry/react";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PropertyProvider } from "@/contexts/PropertyContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorFallback } from "@/components/ErrorFallback";
import { AppLayout } from "@/components/layout/AppLayout";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import ScrollToTop from "./components/ScrollToTop";

// Lazy-loaded routes — each becomes its own chunk, loaded on first visit.
// Keeps the initial bundle small (was 3.2MB single chunk before splitting).
const Index = lazy(() => import("./pages/Index"));
const AddProperty = lazy(() => import("./pages/AddProperty"));
const EditProperty = lazy(() => import("./pages/EditProperty"));
const PropertyDetails = lazy(() => import("./pages/PropertyDetails"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Balancete = lazy(() => import("./pages/Balancete"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const ItbiAdmin = lazy(() => import("./pages/ItbiAdmin"));
const ItbiSearch = lazy(() => import("./pages/ItbiSearch"));

const queryClient = new QueryClient();

function SessionTimeoutWrapper({ children }: { children: React.ReactNode }) {
  useSessionTimeout();
  return <>{children}</>;
}

// Minimal full-screen loader shown while a route chunk is downloading.
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Carregando" />
  </div>
);

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
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Páginas SEM o sidebar/layout (auth e routes
                        públicas) — renderizam standalone. */}
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/unsubscribe" element={<Unsubscribe />} />

                    {/* Páginas autenticadas — todas embrulhadas em
                        <AppLayout> que provê a sidebar de navegação e
                        a top bar mobile. As páginas em si NÃO renderizam
                        mais o <Header /> — isso vive no layout. */}
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Index />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/add"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <AddProperty />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/edit/:id"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <EditProperty />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/property/:id"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <PropertyDetails />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/analytics"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Analytics />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/balancete"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Balancete />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/itbi"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <ItbiAdmin />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/itbi-search"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <ItbiSearch />
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />

                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </PropertyProvider>
          </SessionTimeoutWrapper>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;
