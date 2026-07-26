import type { User } from '@/contexts/AuthContext';
import type { Appointment, Doctor } from '@/data/mockData';
import { normalizeUserRole } from '@/lib/roleUtils';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

export const parseAppointmentDateTime = (date: string, time: string) => new Date(`${date}T${time}:00`);

/** Build ISO UTC string from local date (yyyy-mm-dd) and time (HH:mm). */
export const buildScheduledIso = (dateStr: string, timeStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mmRaw] = timeStr.split(':');
  const mm = mmRaw ?? '0';
  const dt = new Date(y, (m || 1) - 1, d || 1, Number(hh) || 0, Number(mm) || 0, 0, 0);
  return dt.toISOString();
};

export const getVisibleAppointments = (appointments: Appointment[], user?: Pick<User, 'id' | 'role'> | null) => {
  if (!user) return [];
  const role = normalizeUserRole(user.role) ?? user.role;
  if (role === 'doctor') {
    return appointments.filter((appointment) => appointment.doctorId === user.id);
  }
  return appointments.filter((appointment) => appointment.patientId === user.id);
};

export const getAvailableAppointmentSlots = (
  doctor: Doctor,
  date: string,
  appointments: Appointment[],
  now = new Date(),
) => {
  if (!date) return [];

  const selectedDate = new Date(`${date}T00:00:00`);
  const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const doctorSchedule = doctor.availableHours.find((schedule) => schedule.dayOfWeek === dayOfWeek);

  if (!doctorSchedule) return [];

  const selectedDoctorBookings = new Set(
    appointments
      .filter((appointment) => (
        appointment.doctorId === doctor.id &&
        appointment.date === date &&
        appointment.status !== 'cancelled'
      ))
      .map((appointment) => appointment.time),
  );

  const [startHour, startMin] = doctorSchedule.startTime.split(':').map(Number);
  const [endHour, endMin] = doctorSchedule.endTime.split(':').map(Number);
  const current = new Date(selectedDate);
  const endTime = new Date(selectedDate);
  current.setHours(startHour, startMin, 0, 0);
  endTime.setHours(endHour, endMin, 0, 0);
  const isToday = selectedDate.toDateString() === now.toDateString();
  const slots: string[] = [];

  while (current < endTime) {
    const slot = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;
    const isPastSlot = isToday && current <= now;

    if (!isPastSlot && !selectedDoctorBookings.has(slot)) {
      slots.push(slot);
    }

    current.setMinutes(current.getMinutes() + doctor.slotDuration);
  }

  return slots;
};

export const getAppointmentDiffMs = (date: string, time: string, now = new Date()) =>
  parseAppointmentDateTime(date, time).getTime() - now.getTime();

export const isWithinNext24Hours = (date: string, time: string, now = new Date()) => {
  const diff = getAppointmentDiffMs(date, time, now);
  return diff > 0 && diff <= ONE_DAY_MS;
};

export const isWithinNextHour = (date: string, time: string, now = new Date()) => {
  const diff = getAppointmentDiffMs(date, time, now);
  return diff > 0 && diff <= ONE_HOUR_MS;
};

export const getAppointmentTimeUntilLabel = (date: string, time: string, now = new Date()) => {
  const diff = getAppointmentDiffMs(date, time, now);

  if (diff <= 0) return 'Past';
  if (diff < ONE_HOUR_MS) return `${Math.round(diff / (60 * 1000))}m`;
  if (diff < ONE_DAY_MS) return `${Math.round(diff / ONE_HOUR_MS)}h`;
  return `${Math.round(diff / ONE_DAY_MS)}d`;
};
