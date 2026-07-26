import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DashboardHome from '@/pages/DashboardHome';
import FeatureWrapper from '@/pages/FeatureWrapper';

type Role = 'doctor' | 'hospital' | 'laboratory' | 'imaging' | 'pharmacy';

type MockUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isVerified: boolean;
  emailVerified: boolean;
  isActive?: boolean;
  profile?: {
    bio?: string;
  };
};

const baseUsers = [
  {
    id: 'patient-1',
    email: 'patient@example.com',
    name: 'Pat One',
    role: 'patient',
    isVerified: true,
    emailVerified: true,
    isActive: true,
  },
  {
    id: 'doctor-1',
    email: 'doctor@example.com',
    name: 'Dr. Alice',
    role: 'doctor',
    isVerified: true,
    emailVerified: true,
    isActive: true,
    profile: { bio: 'Cardiology' },
  },
  {
    id: 'doctor-2',
    email: 'doctor2@example.com',
    name: 'Dr. Ben',
    role: 'doctor',
    isVerified: true,
    emailVerified: true,
    isActive: true,
    profile: { bio: 'Radiology' },
  },
  {
    id: 'hospital-1',
    email: 'hospital@example.com',
    name: 'City Hospital',
    role: 'hospital',
    isVerified: true,
    emailVerified: true,
    isActive: true,
  },
  {
    id: 'laboratory-1',
    email: 'lab@example.com',
    name: 'Central Lab',
    role: 'laboratory',
    isVerified: true,
    emailVerified: true,
    isActive: true,
  },
  {
    id: 'imaging-1',
    email: 'imaging@example.com',
    name: 'Scan Center',
    role: 'imaging',
    isVerified: true,
    emailVerified: true,
    isActive: true,
  },
  {
    id: 'pharmacy-1',
    email: 'pharmacy@example.com',
    name: 'Care Pharmacy',
    role: 'pharmacy',
    isVerified: true,
    emailVerified: true,
    isActive: true,
  },
] satisfies Array<Record<string, unknown>>;

let currentUser: MockUser;

const mockAppData = {
  appointments: [
    {
      id: 'apt-1',
      patientId: 'patient-1',
      patientName: 'Pat One',
      doctorId: 'doctor-1',
      doctorName: 'Dr. Alice',
      date: '2026-04-07',
      time: '09:00',
      status: 'scheduled',
      type: 'Consultation',
      appointmentMode: 'telemedicine',
    },
  ],
  prescriptions: [
    {
      id: 'rx-1',
      patientId: 'patient-1',
      patientName: 'Pat One',
      doctorId: 'doctor-1',
      doctorName: 'Dr. Alice',
      date: '2026-04-07',
      medications: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'Daily', duration: '5 days' }],
      status: 'active',
    },
  ],
  labTests: [
    {
      id: 'lt-1',
      patientId: 'patient-1',
      patientName: 'Pat One',
      doctorId: 'doctor-1',
      doctorName: 'Dr. Alice',
      testName: 'CBC',
      date: '2026-04-07',
      status: 'requested',
    },
  ],
  imagingScans: [
    {
      id: 'img-1',
      patientId: 'patient-1',
      patientName: 'Pat One',
      doctorId: 'doctor-1',
      doctorName: 'Dr. Alice',
      scanType: 'MRI',
      bodyPart: 'Head',
      date: '2026-04-07',
      status: 'requested',
    },
  ],
  referrals: [
    {
      id: 'ref-1',
      referralType: 'hospital',
      patientId: 'patient-1',
      patientName: 'Pat One',
      fromDoctorId: 'doctor-1',
      fromDoctorName: 'Dr. Alice',
      toDepartmentId: 'cardiology',
      toDepartment: 'Cardiology',
      reason: 'Specialist review',
      date: '2026-04-07',
      status: 'pending',
      lastUpdated: '2026-04-07',
    },
  ],
  inventoryItems: [
    {
      id: 'inv-1',
      name: 'Paracetamol',
      category: 'medication',
      stock: 10,
      unit: 'tabs',
      price: 2,
      reorderLevel: 5,
      status: 'in-stock',
      lastRestocked: '2026-04-01',
      expiryDate: '2026-12-31',
    },
  ],
  ambulanceRequests: [],
  updateInventoryItem: vi.fn(),
  addLabTest: vi.fn(),
  updateLabTest: vi.fn(),
  addImagingScan: vi.fn(),
  updateImagingScan: vi.fn(),
  addReferral: vi.fn(),
  updateReferral: vi.fn(),
};

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({
    user: currentUser,
    getUsers: () => baseUsers,
  }),
}));

vi.mock('@/contexts/useAppData', () => ({
  useAppData: () => mockAppData,
}));

vi.mock('@/contexts/useNotifications', () => ({
  useNotifications: () => ({
    addNotification: vi.fn(),
  }),
}));

vi.mock('@/components/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
    tr: ({ children, ...props }: { children?: React.ReactNode }) => <tr {...props}>{children}</tr>,
    button: ({ children, ...props }: { children?: React.ReactNode }) => <button {...props}>{children}</button>,
  },
}));

describe('provider role smoke tests', () => {
  it.each([
    ['doctor', /clinician workspace/i],
    ['hospital', /hospital coordination/i],
    ['laboratory', /laboratory console/i],
    ['imaging', /imaging center deck/i],
    ['pharmacy', /pharmacy fulfillments/i],
  ] as const)('loads %s dashboard', (role, heading) => {
    currentUser = baseUsers.find((user) => user.role === role) as MockUser;

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardHome />
      </MemoryRouter>,
    );

    expect(screen.getByText(heading)).toBeInTheDocument();
  });

  it.each([
    ['doctor', 'patients', /my patients/i],
    ['doctor', 'imaging-referrals', /imaging referrals/i],
    ['hospital', 'referrals', /hospital referrals/i],
    ['laboratory', 'test-requests', /test requests/i],
    ['imaging', 'scan-requests', /scan requests/i],
    ['pharmacy', 'inventory', /inventory management/i],
  ] as const)('loads %s core page %s', async (role, page, heading) => {
    currentUser = baseUsers.find((user) => user.role === role) as MockUser;

    render(
      <MemoryRouter initialEntries={[`/dashboard/${page}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FeatureWrapper page={page} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
});
