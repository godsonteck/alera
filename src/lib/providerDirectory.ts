import type { User } from '@/contexts/AuthContext';
import type { Doctor } from '@/data/mockData';

const defaultAvailability: Doctor['availableHours'] = [
  { dayOfWeek: 'Monday', startTime: '09:00', endTime: '16:00' },
  { dayOfWeek: 'Tuesday', startTime: '09:00', endTime: '16:00' },
  { dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '16:00' },
  { dayOfWeek: 'Thursday', startTime: '09:00', endTime: '16:00' },
  { dayOfWeek: 'Friday', startTime: '09:00', endTime: '14:00' },
];

export const getBookableDoctors = (
  users: User[],
): Doctor[] => {
  const registeredDoctors = users.filter((candidate) => ['doctor', 'physiotherapist'].includes(candidate.role) && candidate.isVerified !== false && candidate.isActive !== false);
  if (registeredDoctors.length === 0) return [];

  return registeredDoctors.map((doctor, index) => ({
    id: doctor.id,
    name: doctor.name,
    specialty: doctor.profile?.bio?.trim() || 'General Practice',
    qualifications: ['Licensed Provider'],
    experience: 5 + index * 2,
    rating: 4.7,
    reviewCount: 0,
    consultationFee: 50,
    status: 'available',
    availableHours: defaultAvailability,
    slotDuration: 30,
    profileImage: doctor.avatar,
  }));
};
