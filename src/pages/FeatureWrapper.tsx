import { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ShieldAlert } from 'lucide-react';
import { featurePageMap } from '@/app/featureRegistry';
import DashboardLayout from '@/components/DashboardLayout';
import RouteLoader from '@/components/RouteLoader';
import { useAuth } from '@/contexts/useAuth';
import { canAccessFeature } from '@/lib/featureAccess';

interface FeatureWrapperProps {
  page: string;
}

const FeatureWrapper = ({ page }: FeatureWrapperProps) => {
  const { user } = useAuth();
  const config = featurePageMap[page];
  const Page = page === 'results' && user?.role === 'imaging' ? featurePageMap.imaging.component : config?.component;
  const pageProps = {
    ...(config?.props ?? {}),
    ...(page === 'results' && user?.role === 'imaging' ? { page: 'results' } : {}),
  };

  if (!config) return (
    <DashboardLayout>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-warning" />
          <h1 className="text-2xl font-display font-bold text-foreground">Workspace not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">The page you requested is not available in this dashboard.</p>
          <div className="mt-6 flex justify-center">
            <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
  if (!canAccessFeature(page, user?.role)) {
    const patientOnlyWorkspaces = new Set([
      'health-metrics',
      'prescription-refills',
      'consent',
      'problem-list',
      'medication-adherence',
      'billing',
    ]);
    const shouldUsePatientAccountMessage =
      user?.role &&
      user.role !== 'patient' &&
      patientOnlyWorkspaces.has(page);

    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <h1 className="text-2xl font-display font-bold text-foreground">Access restricted</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {shouldUsePatientAccountMessage
                ? 'This page is for patient accounts. If you also use Alera as a patient, sign in with your separate patient account to continue.'
                : 'Your current role does not have access to this page. Return to the dashboard to continue.'}
            </p>
            <div className="mt-6 flex justify-center">
              <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                <ArrowLeft className="h-4 w-4" />
                Return to dashboard
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  return (
    <DashboardLayout>
      <Suspense fallback={<RouteLoader compact label="Loading dashboard..." />}>
        <div className="alera-feature">
          <Page {...pageProps} />
        </div>
      </Suspense>
    </DashboardLayout>
  );
};

export default FeatureWrapper;
