import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import ImagingPage from '@/pages/features/ImagingPage';

const {
  addImagingScanMock,
  updateImagingScanMock,
  refreshAppDataMock,
  addNotificationMock,
  uploadImagingResultsMock,
  deleteImagingScanMock,
  updateImagingScanApiMock,
} = vi.hoisted(() => ({
  addImagingScanMock: vi.fn(),
  updateImagingScanMock: vi.fn(),
  refreshAppDataMock: vi.fn(() => Promise.resolve()),
  addNotificationMock: vi.fn(),
  uploadImagingResultsMock: vi.fn(() => Promise.resolve({})),
  deleteImagingScanMock: vi.fn(() => Promise.resolve({})),
  updateImagingScanApiMock: vi.fn(() => Promise.resolve({})),
}));

let currentUser: {
  id: string;
  email: string;
  name: string;
  role: 'doctor' | 'imaging';
} | null = null;

const users = [
  { id: 'doctor-1', email: 'doctor@alera.local', name: 'Dr. Alice', role: 'doctor', isVerified: true, isActive: true },
  { id: 'patient-1', email: 'patient@alera.local', name: 'Pat One', role: 'patient', isVerified: true, isActive: true },
  { id: 'img-center', email: 'imaging@alera.local', name: 'Precision Imaging', role: 'imaging', isVerified: true, isActive: true },
];

let imagingScans: Array<{
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  centerId?: string;
  destinationProviderName?: string;
  scanType: 'MRI';
  bodyPart?: string;
  clinicalIndication?: string;
  date: string;
  status: 'requested' | 'in-progress' | 'completed' | 'cancelled';
  results?: string;
}> = [];

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({
    user: currentUser,
    getUsers: () => users,
  }),
}));

vi.mock('@/contexts/useAppData', () => ({
  useAppData: () => ({
    appointments: [
      {
        id: 'apt-1',
        patientId: 'patient-1',
        patientName: 'Pat One',
        doctorId: 'doctor-1',
        doctorName: 'Dr. Alice',
        date: '2026-04-09',
        time: '09:00',
        status: 'scheduled',
        type: 'Consultation',
        appointmentMode: 'telemedicine',
      },
    ],
    imagingScans,
    addImagingScan: addImagingScanMock,
    updateImagingScan: updateImagingScanMock,
    refreshAppData: refreshAppDataMock,
  }),
}));

vi.mock('@/contexts/useNotifications', () => ({
  useNotifications: () => ({
    addNotification: addNotificationMock,
  }),
}));

vi.mock('@/lib/apiService', () => ({
  api: {
    imaging: {
      uploadImagingResults: uploadImagingResultsMock,
      deleteImagingScan: deleteImagingScanMock,
      updateImagingScan: updateImagingScanApiMock,
    },
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}));

describe('ImagingPage', () => {
  beforeEach(() => {
    currentUser = null;
    imagingScans = [];
    addImagingScanMock.mockClear();
    updateImagingScanMock.mockClear();
    refreshAppDataMock.mockClear();
    addNotificationMock.mockClear();
    uploadImagingResultsMock.mockClear();
    deleteImagingScanMock.mockClear();
    updateImagingScanApiMock.mockClear();
  });

  it('passes the selected imaging center and clinical indication when a doctor orders a scan', async () => {
    currentUser = { id: 'doctor-1', email: 'doctor@alera.local', name: 'Dr. Alice', role: 'doctor' };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ImagingPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /ORDER IMAGING STUDY/i }));
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.change(comboboxes[0], { target: { value: 'patient-1' } });
    fireEvent.change(comboboxes[1], { target: { value: 'img-center' } });
    fireEvent.change(comboboxes[2], { target: { value: 'MRI' } });
    fireEvent.change(screen.getByPlaceholderText(/Thorax \/ Chest/i), { target: { value: 'Head' } });
    fireEvent.click(screen.getByRole('button', { name: /DISPATCH RADIOLOGY REQUISITION/i }));

    await waitFor(() => {
      expect(addImagingScanMock).toHaveBeenCalledWith(expect.objectContaining({
        patientId: 'patient-1',
        centerId: 'img-center',
        scanType: 'MRI',
        bodyPart: 'Head',
      }));
    });
  });

  it('submits findings through the app data context', async () => {
    currentUser = { id: 'img-center', email: 'imaging@alera.local', name: 'Precision Imaging', role: 'imaging' };
    imagingScans = [
      {
        id: 'scan-1',
        patientId: 'patient-1',
        patientName: 'Pat One',
        doctorId: 'doctor-1',
        doctorName: 'Dr. Alice',
        centerId: 'img-center',
        destinationProviderName: 'Precision Imaging',
        scanType: 'MRI',
        bodyPart: 'Head',
        clinicalIndication: 'Headaches',
        date: '2026-04-09',
        status: 'in-progress',
      },
    ];

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ImagingPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /PUBLISH DICOM/i }));
    fireEvent.change(screen.getByPlaceholderText(/Enter radiology findings/i), { target: { value: 'No acute intracranial abnormality.' } });

    fireEvent.click(screen.getByRole('button', { name: /PUBLISH DICOM STUDY/i }));

    await waitFor(() => {
      expect(updateImagingScanMock).toHaveBeenCalledWith('scan-1', expect.any(Function));
    });
  });

  it('filters the imaging worklist by search term and status', async () => {
    currentUser = { id: 'img-center', email: 'imaging@alera.local', name: 'Precision Imaging', role: 'imaging' };
    imagingScans = [
      {
        id: 'scan-1',
        patientId: 'patient-1',
        patientName: 'Pat One',
        doctorId: 'doctor-1',
        doctorName: 'Dr. Alice',
        centerId: 'img-center',
        destinationProviderName: 'Precision Imaging',
        scanType: 'MRI',
        bodyPart: 'Head',
        clinicalIndication: 'Headaches',
        date: '2026-04-09',
        status: 'requested',
      },
      {
        id: 'scan-2',
        patientId: 'patient-1',
        patientName: 'Jordan Case',
        doctorId: 'doctor-1',
        doctorName: 'Dr. Alice',
        centerId: 'img-center',
        destinationProviderName: 'Precision Imaging',
        scanType: 'MRI',
        bodyPart: 'Spine',
        clinicalIndication: 'Back pain',
        date: '2026-04-08',
        status: 'completed',
      },
    ];

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ImagingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Pat One/i)).toBeInTheDocument();
    expect(screen.getByText(/Jordan Case/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search study or patient.../i), { target: { value: 'Jordan' } });

    await waitFor(() => {
      expect(screen.queryByText(/Pat One/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Jordan Case/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^REQUESTED$/i }));

    await waitFor(() => {
      expect(screen.getByText(/No matching PACS radiology studies found./i)).toBeInTheDocument();
    });
  });
});
