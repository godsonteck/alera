export type ProfessionalVerificationStatus = 'verified' | 'pending' | 'suspended';
export type VerificationQueueStatus = 'verified' | 'pending' | 'rejected';

export const getProfessionalVerificationStatus = (
  isVerified?: boolean,
  isActive: boolean = true,
): ProfessionalVerificationStatus => {
  if (!isActive) return 'suspended';
  return isVerified ? 'verified' : 'pending';
};

export const getVerificationQueueStatus = (
  isVerified?: boolean,
  isActive: boolean = true,
): VerificationQueueStatus => {
  if (isVerified) return 'verified';
  if (!isActive) return 'rejected';
  return 'pending';
};

export const getVerificationStatusLabel = (
  status: ProfessionalVerificationStatus | VerificationQueueStatus,
): string => {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'pending':
      return 'Pending verification';
    case 'suspended':
      return 'Suspended';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Unknown';
  }
};
