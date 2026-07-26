import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppDataProvider } from "@/contexts/AppDataContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { SystemProvider } from "@/contexts/SystemContext";
import { useAuth } from "@/contexts/useAuth";
import { useSystem } from "@/contexts/useSystem";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import RouteLoader from "./components/RouteLoader";
import { featureRouteKeys as featureRoutes } from "@/app/featureRegistry";
import type { MaintenanceBannerType } from "@/contexts/system-context";

const MainLayout = lazy(() => import("./components/MainLayout"));
const LandingHome = lazy(() => import("./pages/Landing/Home"));
const LandingHowItWorks = lazy(() => import("./pages/Landing/HowItWorks"));
const LandingFeatures = lazy(() => import("./pages/Landing/Features"));
const LandingTrust = lazy(() => import("./pages/Landing/Trust"));
const LandingWhoWeServe = lazy(() => import("./pages/Landing/WhoWeServe"));
const LandingWhyAlera = lazy(() => import("./pages/Landing/WhyAlera"));
const LandingAbout = lazy(() => import("./pages/Landing/About"));
const PrivacyPolicy = lazy(() => import("./pages/Landing/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/Landing/TermsOfService"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const DashboardHome = lazy(() => import("./pages/DashboardHome"));
const FeatureWrapper = lazy(() => import("./pages/FeatureWrapper"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const NotFound = lazy(() => import("./pages/NotFound"));
import MaintenanceBanner from "@/components/MaintenanceBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const PublicLayout = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const MaintenanceGuard = ({ children }: { children: React.ReactNode }) => {
  const { isMaintenanceMode, settings, bannerVisible, closeBanner } = useSystem();
  const { user } = useAuth();
  const location = useLocation();
  const bannerType: MaintenanceBannerType =
    settings?.notification_banner_type === 'warning' || settings?.notification_banner_type === 'success'
      ? settings.notification_banner_type
      : 'info';

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isMaintenancePage = location.pathname === '/maintenance';
  const isLoginPage = location.pathname === '/login';

  // Allow admins to bypass maintenance mode
  // Also allow access to login page so admins can log in
  if (isMaintenanceMode && !isAdmin && !isMaintenancePage && !isLoginPage) {
    return <Navigate to="/maintenance" replace />;
  }

  // If system is NOT in maintenance mode but user is on maintenance page, redirect to dashboard/home
  if (!isMaintenanceMode && isMaintenancePage) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      {bannerVisible && settings?.notification_banner_message && (
        <MaintenanceBanner 
          message={settings.notification_banner_message} 
          type={bannerType}
          onClose={closeBanner}
        />
      )}
      {children}
    </>
  );
};

const App = () => {
  try {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
          <AppDataProvider>
            <NotificationProvider>
              <ChatProvider>
                <SystemProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <SpeedInsights />
                    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                      <MaintenanceGuard>
                        <Suspense fallback={<RouteLoader />}>
                          <Routes>
                            <Route element={<PublicLayout><MainLayout /></PublicLayout>}>
                              <Route path="/" element={<LandingHome />} />
                              <Route path="/about" element={<LandingAbout />} />
                              <Route path="/how-it-works" element={<LandingHowItWorks />} />
                              <Route path="/features" element={<LandingFeatures />} />
                              <Route path="/trust" element={<LandingTrust />} />
                              <Route path="/who-we-serve" element={<LandingWhoWeServe />} />
                              <Route path="/why-alera" element={<LandingWhyAlera />} />
                              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                              <Route path="/terms" element={<TermsOfService />} />
                            </Route>
                            <Route path="/login" element={<Login />} />
                            <Route path="/signup" element={<Signup />} />
                            <Route path="/forgot-password" element={<ForgotPassword />} />
                            <Route path="/reset-password" element={<ResetPassword />} />
                            <Route path="/verify-email" element={<VerifyEmail />} />
                            <Route path="/maintenance" element={<Maintenance />} />
                            <Route path="/dashboard" element={<ProtectedRoute><DashboardHome /></ProtectedRoute>} />
                            {featureRoutes.map(page => (
                              <Route key={page} path={`/dashboard/${page}`} element={<ProtectedRoute><FeatureWrapper page={page} /></ProtectedRoute>} />
                            ))}
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </Suspense>
                      </MaintenanceGuard>
                    </BrowserRouter>
                  </TooltipProvider>
                </SystemProvider>
              </ChatProvider>
            </NotificationProvider>
          </AppDataProvider>
        </AuthProvider>
      </QueryClientProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    return <div style={{ color: 'red', padding: '20px' }}>ERROR: {String(error)}</div>;
  }
};

export default App;
