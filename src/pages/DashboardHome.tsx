import { useAuth } from '@/contexts/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import PatientDashboard from '@/pages/dashboards/PatientDashboard';
import DoctorDashboard from '@/pages/dashboards/DoctorDashboard';
import HospitalDashboard from '@/pages/dashboards/HospitalDashboard';
import LaboratoryDashboard from '@/pages/dashboards/LaboratoryDashboard';
import ImagingDashboard from '@/pages/dashboards/ImagingDashboard';
import PharmacyDashboard from '@/pages/dashboards/PharmacyDashboard';
import AmbulanceDashboard from '@/pages/dashboards/AmbulanceDashboard';
import AdminDashboard from '@/pages/dashboards/AdminDashboard';
import SuperAdminDashboard from '@/pages/dashboards/SuperAdminDashboard';
import PhysiotherapistDashboard from '@/pages/dashboards/PhysiotherapistDashboard';

const dashboardMap: Record<string, React.ComponentType> = {
  // Frontend role labels
  patient: PatientDashboard,
  doctor: DoctorDashboard,
  hospital: HospitalDashboard,
  laboratory: LaboratoryDashboard,
  imaging: ImagingDashboard,
  pharmacy: PharmacyDashboard,
  ambulance: AmbulanceDashboard,
  physiotherapist: PhysiotherapistDashboard,
  admin: AdminDashboard,
  super_admin: SuperAdminDashboard,
  // Backend enum values (may differ from frontend labels)
  provider: DoctorDashboard,    // backend stores doctors as 'provider'
  pharmacist: PharmacyDashboard, // backend stores pharmacists as 'pharmacist'
};

const DashboardHome = () => {
  const { user } = useAuth();
  if (!user) return <div>No user found</div>;
  const Dashboard = dashboardMap[user.role] || PatientDashboard;
  return (
    <DashboardLayout>
      <Dashboard />
    </DashboardLayout>
  );
};

export default DashboardHome;
