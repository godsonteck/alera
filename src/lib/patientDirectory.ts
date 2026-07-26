import type { User } from '@/contexts/AuthContext';
import type { Appointment, LabTest, Prescription } from '@/data/mockData';

export interface PatientOption {
  id: string;
  name: string;
  email?: string;
}

export const getDoctorPatients = (users: User[], appointments: Appointment[], doctorId?: string): PatientOption[] => {
  const patientUsers = users.filter((account) => account.role === 'patient');

  if (!doctorId) {
    return patientUsers
      .map((patient) => ({ id: patient.id, name: patient.name, email: patient.email }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  const patientsById = new Map<string, PatientOption>();

  appointments
    .filter((appointment) => appointment.doctorId === doctorId && appointment.patientId)
    .forEach((appointment) => {
      const matchingUser = patientUsers.find((patient) => patient.id === appointment.patientId);
      patientsById.set(appointment.patientId, {
        id: appointment.patientId,
        name: matchingUser?.name ?? appointment.patientName,
        email: matchingUser?.email,
      });
    });

  if (patientsById.size === 0) {
    patientUsers.forEach((patient) => {
      patientsById.set(patient.id, { id: patient.id, name: patient.name, email: patient.email });
    });
  }

  return Array.from(patientsById.values()).sort((left, right) => left.name.localeCompare(right.name));
};

export interface PatientSummary extends PatientOption {
  lastVisit?: string;
  appointmentCount: number;
  prescriptionCount: number;
  labTestCount: number;
  hasActive: boolean;
}

export const getAccessiblePatients = (
  users: User[],
  appointments: Appointment[],
  prescriptions: Prescription[],
  labTests: LabTest[],
  user?: Pick<User, 'id' | 'role'> | null,
): PatientSummary[] => {
  const patientUsers = users.filter((account) => account.role === 'patient');
  const patientMap = new Map<string, PatientSummary>();

  const ensurePatient = (id: string, fallbackName: string) => {
    if (!patientMap.has(id)) {
      const matchingUser = patientUsers.find((patient) => patient.id === id);
      patientMap.set(id, {
        id,
        name: matchingUser?.name ?? fallbackName,
        email: matchingUser?.email,
        appointmentCount: 0,
        prescriptionCount: 0,
        labTestCount: 0,
        hasActive: false,
      });
    }
    return patientMap.get(id)!;
  };

  const includeAppointment = (appointment: Appointment) => {
    const patient = ensurePatient(appointment.patientId, appointment.patientName);
    patient.appointmentCount += 1;
    if (appointment.status === 'scheduled') {
      patient.hasActive = true;
    }
    if (!patient.lastVisit || appointment.date > patient.lastVisit) {
      patient.lastVisit = appointment.date;
    }
  };

  const includePrescription = (prescription: Prescription) => {
    const patient = ensurePatient(prescription.patientId, prescription.patientName);
    patient.prescriptionCount += 1;
  };

  const includeLabTest = (labTest: LabTest) => {
    const patient = ensurePatient(labTest.patientId, labTest.patientName);
    patient.labTestCount += 1;
  };

  if (user?.role === 'doctor' || user?.role === 'physiotherapist') {
    appointments.filter((appointment) => appointment.doctorId === user.id).forEach(includeAppointment);
    prescriptions.filter((prescription) => prescription.doctorId === user.id).forEach(includePrescription);
    labTests.filter((labTest) => labTest.doctorId === user.id).forEach(includeLabTest);
  } else {
    patientUsers.forEach((patient) => {
      patientMap.set(patient.id, {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        appointmentCount: 0,
        prescriptionCount: 0,
        labTestCount: 0,
        hasActive: false,
      });
    });
    appointments.forEach(includeAppointment);
    prescriptions.forEach(includePrescription);
    labTests.forEach(includeLabTest);
  }

  return Array.from(patientMap.values()).sort((left, right) => {
    if (left.lastVisit && right.lastVisit) {
      return new Date(right.lastVisit).getTime() - new Date(left.lastVisit).getTime();
    }
    if (left.lastVisit) return -1;
    if (right.lastVisit) return 1;
    return left.name.localeCompare(right.name);
  });
};
