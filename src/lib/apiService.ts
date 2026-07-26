import { apiClient } from './apiClient';

export interface ApiUser {
  id: string | number;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role: 'patient' | 'provider' | 'pharmacist' | 'admin' | 'super_admin' | 'hospital' | 'laboratory' | 'imaging' | 'ambulance' | 'physiotherapist';
  is_active?: boolean;
  is_verified?: boolean;
  email_verified?: boolean;
  email_verified_at?: string | null;
  avatar?: string;
  profile_image_url?: string;
  created_at?: string;
  last_login?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  date_of_birth?: string;
  bio?: string;
  notification_email?: boolean;
  notification_sms?: boolean;
  privacy_public_profile?: boolean;
  license_number?: string;
  license_state?: string;
  specialty?: string;
  organization_id?: number | null;
  postdicom_api_url?: string;
  has_linked_account?: boolean;
  linked_accounts?: ApiLinkedAccountSummary[];
}

export interface ApiLinkedAccountSummary {
  id: number;
  role: string;
  masked_email?: string | null;
  created_at?: string | null;
  link_type?: string;
}

export interface ApiAuthResponse {
  message: string;
  csrf_token?: string;
  user?: ApiUser;
  needs_registration?: boolean;
  google_data?: {
    email: string;
    first_name: string;
    last_name: string;
    credential: string;
  };
  apple_data?: {
    email: string;
    first_name: string;
    last_name: string;
    credential: string;
  };
}

export interface ApiListResponse<T> {
  items?: T[];
}

export interface StructuredRecordResponse<T = Record<string, unknown>> {
  id: string;
  record_type: string;
  patient_id?: number | null;
  provider_id?: number | null;
  created_by?: number | null;
  appointment_id?: number | null;
  status?: string | null;
  payload: T;
  created_at: string;
  updated_at: string;
}

export interface SystemSettings {
  id: number;
  is_maintenance_mode: boolean;
  maintenance_message: string;
  notification_banner_active: boolean;
  notification_banner_message: string;
  notification_banner_type: string;
  updated_at: string;
}

export interface SystemSettingsUpdate {
  is_maintenance_mode?: boolean;
  maintenance_message?: string;
  notification_banner_active?: boolean;
  notification_banner_message?: string;
  notification_banner_type?: string;
}

export interface GlobalNotificationRequest {
  title: string;
  message: string;
  notification_type?: string;
  action_url?: string;
}

/**
 * Authentication & Account API
 */
export interface SynchronizedHistoryParticipant {
  user_id: number;
  role: string;
  name: string;
}

export interface SynchronizedHistoryCounts {
  appointments: number;
  allergies: number;
  medical_history_entries: number;
  prescriptions: number;
  lab_tests: number;
  imaging_scans: number;
  structured_records: number;
}

export interface SynchronizedHistoryTimelineEntry {
  source: string;
  source_id: string;
  title: string;
  status?: string | null;
  timestamp?: string | null;
  provider_id?: number | null;
  provider_name?: string | null;
  payload: Record<string, unknown>;
}

export interface SynchronizedHistoryResponse {
  patient_id: number;
  access_scope: string;
  has_shared_history_consent: boolean;
  interacting_organizations: SynchronizedHistoryParticipant[];
  counts: SynchronizedHistoryCounts;
  appointments: Record<string, unknown>[];
  allergies: Record<string, unknown>[];
  medical_history: Record<string, unknown>[];
  prescriptions: Record<string, unknown>[];
  lab_tests: Record<string, unknown>[];
  imaging_scans: Record<string, unknown>[];
  structured_records: StructuredRecordResponse[];
  timeline: SynchronizedHistoryTimelineEntry[];
}

export interface OrganizationApiResponse {
  id: number;
  name: string;
  slug: string;
  organization_type: string;
  description?: string | null;
  is_active: boolean;
  created_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PatientPermissionResponse {
  id: string;
  patient_id: number;
  organization_id: number;
  requested_by?: number | null;
  granted_by?: number | null;
  revoked_by?: number | null;
  scope: string[];
  status: string;
  reason?: string | null;
  requested_at?: string | null;
  granted_at?: string | null;
  revoked_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MedicalDocumentApiResponse {
  id: string;
  medical_record_id: string;
  patient_id: number;
  organization_id?: number | null;
  uploaded_by?: number | null;
  file_id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  document_type: string;
  storage_subpath: string;
  description?: string | null;
  is_external: boolean;
  source_system: string;
  source_document_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MedicalRecordApiResponse {
  id: string;
  patient_id: number;
  organization_id?: number | null;
  provider_id?: number | null;
  parent_record_id?: string | null;
  record_type: string;
  category?: string | null;
  title: string;
  summary?: string | null;
  status?: string | null;
  event_time?: string | null;
  source_system: string;
  source_record_id?: string | null;
  source_version?: string | null;
  is_external: boolean;
  is_deleted: boolean;
  sync_status: string;
  payload: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
  documents: MedicalDocumentApiResponse[];
}

export interface UnifiedPatientRecordApiResponse {
  patient_id: number;
  organization_access: OrganizationApiResponse[];
  permissions: PatientPermissionResponse[];
  records: MedicalRecordApiResponse[];
  timeline: MedicalRecordApiResponse[];
  document_count: number;
}

export interface ImagingFileAsset {
  file_id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  upload_time?: string | null;
  download_url?: string | null;
}

export interface ImagingScanApiResponse {
  id: number;
  patient_id: number;
  ordered_by: number;
  destination_provider_id?: number | null;
  destination_provider_name?: string | null;
  processed_by?: number | null;
  scan_type: string;
  body_part?: string | null;
  clinical_indication?: string | null;
  status: string;
  findings?: string | null;
  impression?: string | null;
  report_url?: string | null;
  image_url?: string | null;
  report_file?: ImagingFileAsset | null;
  image_files?: ImagingFileAsset[];
  postdicom_study_id?: string | null;
  postdicom_study_url?: string | null;
  scheduled_at?: string | null;
  ordered_at: string;
  completed_at?: string | null;
  created_at: string;
  patient_name?: string | null;
  ordered_by_name?: string | null;
}

/** Row from `GET /api/admin/users/` (matches backend UserResponse). */
export interface AdminUserRow {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  email_verified?: boolean;
  email_verified_at?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  bio?: string | null;
  profile_image_url?: string | null;
  address?: string | null;
  license_number?: string | null;
  license_state?: string | null;
  specialty?: string | null;
  created_at: string;
  last_login?: string | null;
}

export interface AuditLogEntry {
  id: number;
  user_id?: number | null;
  role?: string | null;
  action: string;
  resource?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  changes?: string | null;
  description?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device_info?: string | null;
  metadata?: Record<string, unknown>;
  reason?: string | null;
  severity: 'info' | 'warning' | 'critical';
  status?: string | null;
  error_message?: string | null;
  request_id?: string | null;
  request_method?: string | null;
  request_path?: string | null;
  duration_ms?: number | null;
  timestamp: string;
  created_at?: string | null;
}

export interface AuditLogListApiResponse {
  total: number;
  items: AuditLogEntry[];
}

export interface AuditSummaryApiResponse {
  period_days: number;
  total_logs: number;
  failed_logins: number;
  critical_events: number;
  top_actions: Array<{ action: string; count: number }>;
  recent_suspicious: AuditLogEntry[];
}

export interface LinkedAccountSummaryResponse {
  id: number;
  role: string;
  masked_email?: string | null;
  created_at?: string | null;
  link_type?: string;
}

export interface LinkedAccountListResponse {
  has_linked_account: boolean;
  linked_accounts: LinkedAccountSummaryResponse[];
}

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

export const authApi = {
  register: async (userData: {
    email: string;
    password: string;
    username: string;
    first_name: string;
    last_name: string;
    role: 'patient' | 'provider' | 'pharmacist' | 'hospital' | 'laboratory' | 'imaging' | 'ambulance' | 'physiotherapist';
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    license_number?: string;
    license_state?: string;
    specialty?: string;
  }) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await apiClient.post<ApiAuthResponse>('/auth/login', { email, password });
    return response.data;
  },

  loginWithGoogle: async (credential: string) => {
    const response = await apiClient.post<ApiAuthResponse>('/auth/oauth/google', { credential });
    return response.data;
  },

  loginWithApple: async (credential: string, firstName?: string, lastName?: string) => {
    const response = await apiClient.post<ApiAuthResponse>('/auth/oauth/apple', {
      credential,
      first_name: firstName,
      last_name: lastName,
    });
    return response.data;
  },

  registerWithGoogle: async (userData: {
    credential: string;
    role: 'patient' | 'provider' | 'pharmacist' | 'hospital' | 'laboratory' | 'imaging' | 'ambulance' | 'physiotherapist';
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    license_number?: string;
    license_state?: string;
    specialty?: string;
  }) => {
    const response = await apiClient.post<ApiAuthResponse>('/auth/oauth/google/register', userData);
    return response.data;
  },

  registerWithApple: async (userData: {
    credential: string;
    role: 'patient' | 'provider' | 'pharmacist' | 'hospital' | 'laboratory' | 'imaging' | 'ambulance' | 'physiotherapist';
    first_name?: string;
    last_name?: string;
    phone?: string;
    license_number?: string;
    license_state?: string;
    specialty?: string;
  }) => {
    const response = await apiClient.post<ApiAuthResponse>('/auth/oauth/apple/register', userData);
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },

  updateProfile: async (userData: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    phone?: string;
    date_of_birth?: string;
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    bio?: string;
    profile_image_url?: string;
    postdicom_api_url?: string;
    postdicom_api_key?: string;
    notification_email?: boolean;
    notification_sms?: boolean;
    privacy_public_profile?: boolean;
    specialization?: string;
  }) => {
    const response = await apiClient.put('/users/me', userData);
    return response.data;
  },

  refreshToken: async () => {
    const response = await apiClient.post<{ message: string; csrf_token: string }>('/auth/refresh');
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await apiClient.post('/auth/change-password', {
      old_password: currentPassword,
      new_password: newPassword,
      confirm_password: newPassword,
    });
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  deleteAccount: async (password: string) => {
    const response = await apiClient.post('/auth/delete-account', { password });
    return response.data;
  },

  requestPasswordReset: async (email: string) => {
    const response = await apiClient.post('/auth/request-password-reset', { email });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string, confirmPassword: string) => {
    const response = await apiClient.post('/auth/reset-password', {
      token,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return response.data;
  },

  verifyEmail: async (token: string) => {
    const response = await apiClient.post('/auth/verify-email', { token });
    return response.data;
  },

  resendVerificationEmail: async () => {
    const response = await apiClient.post('/auth/resend-verification');
    return response.data;
  },
};

// ============================================================================
// USER ENDPOINTS
// ============================================================================

export const usersApi = {
  getCurrentUser: async () => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },

  getDoctors: async () => {
    const response = await apiClient.get<ApiUser[]>('/users/doctors');
    return response.data;
  },

  updateProfile: async (userData: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    phone?: string;
    date_of_birth?: string;
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    bio?: string;
    profile_image_url?: string;
    postdicom_api_url?: string;
    postdicom_api_key?: string;
    notification_email?: boolean;
    notification_sms?: boolean;
    privacy_public_profile?: boolean;
    specialization?: string;
  }) => {
    const response = await apiClient.put('/users/me', userData);
    return response.data;
  },

  getUserById: async (userId: string) => {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  },

  listAllUsers: async (skip: number = 0, limit: number = 100) => {
    const response = await apiClient.get('/users/', { params: { skip, limit } });
    return response.data;
  },

  getAccessibleUsers: async (skip: number = 0, limit: number = 100) => {
    const response = await apiClient.get<ApiUser[]>('/users/accessible', { params: { skip, limit } });
    return response.data;
  },
};

export const accountLinksApi = {
  getMine: async () => {
    const response = await apiClient.get<LinkedAccountListResponse>('/account-links/me');
    return response.data;
  },

  create: async (payload: {
    current_password: string;
    linked_email: string;
    linked_password: string;
  }) => {
    const response = await apiClient.post<LinkedAccountListResponse>('/account-links', payload);
    return response.data;
  },
};

// ============================================================================
// APPOINTMENT ENDPOINTS
// ============================================================================

export const appointmentsApi = {
  /** Matches FastAPI `AppointmentCreate` (patient is always the authenticated user). */
  createAppointment: async (appointmentData: {
    provider_id: number;
    title: string;
    description?: string;
    appointment_type: 'in_person' | 'telehealth' | 'phone';
    scheduled_time: string;
    duration_minutes?: number;
    location?: string;
    notes?: string;
  }) => {
    const response = await apiClient.post('/appointments/', appointmentData);
    return response.data;
  },

  listAppointments: async (skip: number = 0, limit: number = 100) => {
    const response = await apiClient.get('/appointments/', { params: { skip, limit } });
    return response.data;
  },

  getAppointment: async (appointmentId: string | number) => {
    const response = await apiClient.get(`/appointments/${appointmentId}`);
    return response.data;
  },

  updateAppointment: async (
    appointmentId: string | number,
    updateData: {
      title?: string;
      description?: string;
      scheduled_time?: string;
      duration_minutes?: number;
      location?: string;
      notes?: string;
      status?: string;
      cancellation_reason?: string;
    },
  ) => {
    const response = await apiClient.put(`/appointments/${appointmentId}`, updateData);
    return response.data;
  },

  deleteAppointment: async (appointmentId: string | number) => {
    const response = await apiClient.delete(`/appointments/${appointmentId}`);
    return response.data;
  },
};

// ============================================================================
// AMBULANCE ENDPOINTS
// ============================================================================

export const ambulanceApi = {
  createRequest: async (requestData: {
    patient_id?: number;
    location_name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }) => {
    const response = await apiClient.post('/ambulance/', requestData);
    return response.data;
  },

  listRequests: async (skip: number = 0, limit: number = 100) => {
    const response = await apiClient.get('/ambulance/', { params: { skip, limit } });
    return response.data;
  },

  getRequest: async (requestId: string | number) => {
    const response = await apiClient.get(`/ambulance/${requestId}`);
    return response.data;
  },

  updateRequest: async (
    requestId: string | number,
    updateData: {
      status?: string;
      priority?: string;
      assigned_ambulance_id?: number;
      accepted_at?: string;
      dispatched_at?: string;
      arrived_at?: string;
      completed_at?: string;
      location_name?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      description?: string;
    },
  ) => {
    const response = await apiClient.put(`/ambulance/${requestId}`, updateData);
    return response.data;
  },
};

export type LiveLocationSnapshot = {
  user_id: number;
  role: string;
  latitude?: number | null;
  longitude?: number | null;
  last_updated?: string | null;
  sharing_enabled: boolean;
};

export type EmergencyTrackingSnapshot = {
  request_id: number;
  status: string;
  priority: string;
  patient_id?: number | null;
  assigned_ambulance_id?: number | null;
  patient_location?: LiveLocationSnapshot | null;
  ambulance_location?: LiveLocationSnapshot | null;
};

export const liveLocationApi = {
  updateMine: async (payload: { latitude: number; longitude: number; sharing_enabled?: boolean }) => {
    const response = await apiClient.post('/live-locations/me', payload);
    return response.data as LiveLocationSnapshot;
  },

  getMine: async () => {
    const response = await apiClient.get('/live-locations/me');
    return response.data as LiveLocationSnapshot;
  },

  disableMine: async () => {
    const response = await apiClient.post('/live-locations/me/disable');
    return response.data as LiveLocationSnapshot;
  },

  getRequestTracking: async (requestId: string | number) => {
    const response = await apiClient.get(`/live-locations/request/${requestId}`);
    return response.data as EmergencyTrackingSnapshot;
  },
};

// ============================================================================
// PRESCRIPTION ENDPOINTS
// ============================================================================

export const prescriptionsApi = {
  createPrescription: async (prescriptionData: {
    patient_id: number;
    pharmacy_id: number;
    medication_name: string;
    dosage: string;
    dosage_unit: string;
    frequency: string;
    route: string;
    instructions?: string;
    quantity?: number;
    refills?: number;
    start_date: string;
    end_date?: string | null;
  }) => {
    const response = await apiClient.post('/prescriptions/', prescriptionData);
    return response.data;
  },

  listPrescriptions: async (skip: number = 0, limit: number = 100) => {
    const response = await apiClient.get('/prescriptions/', { params: { skip, limit } });
    return response.data;
  },

  getPrescription: async (prescriptionId: string | number) => {
    const response = await apiClient.get(`/prescriptions/${prescriptionId}`);
    return response.data;
  },

  updatePrescription: async (
    prescriptionId: string | number,
    updateData: {
      medication_name?: string;
      dosage?: string;
      dosage_unit?: string;
      frequency?: string;
      route?: string;
      instructions?: string;
      status?: string;
      refills_remaining?: number;
    },
  ) => {
    const response = await apiClient.put(`/prescriptions/${prescriptionId}`, updateData);
    return response.data;
  },

  deletePrescription: async (prescriptionId: string | number) => {
    const response = await apiClient.delete(`/prescriptions/${prescriptionId}`);
    return response.data;
  },
};

// ============================================================================
// ALLERGY ENDPOINTS
// ============================================================================

export const allergiesApi = {
  createAllergy: async (allergyData: {
    patient_id?: number;
    allergen: string;
    allergen_type: string;
    severity: string;
    reaction_description: string;
    onset_date?: string;
    treatment?: string;
  }) => {
    const response = await apiClient.post('/allergies/', allergyData);
    return response.data;
  },

  listAllergies: async (params?: { skip?: number; limit?: number; patient_id?: number }) => {
    const response = await apiClient.get('/allergies/', {
      params: {
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 100,
        patient_id: params?.patient_id,
      },
    });
    return response.data;
  },

  getAllergy: async (allergyId: string | number) => {
    const response = await apiClient.get(`/allergies/${allergyId}`);
    return response.data;
  },

  updateAllergy: async (
    allergyId: string | number,
    updateData: {
      allergen?: string;
      reaction_description?: string;
      severity?: string;
      treatment?: string;
    },
  ) => {
    const response = await apiClient.put(`/allergies/${allergyId}`, updateData);
    return response.data;
  },

  deleteAllergy: async (allergyId: string | number) => {
    const response = await apiClient.delete(`/allergies/${allergyId}`);
    return response.data;
  },

  getPatientAllergies: async (patientId: string | number) => {
    const response = await apiClient.get(`/allergies/patient/${patientId}`);
    return response.data;
  },
};

// ============================================================================
// MEDICAL HISTORY ENDPOINTS (Implicit from user context)
// ============================================================================

export const medicalHistoryApi = {
  listMedicalHistory: async (skip: number = 0, limit: number = 20) => {
    const response = await apiClient.get('/medical-history', { params: { skip, limit } });
    return response.data;
  },

  getMedicalRecord: async (recordId: string) => {
    const response = await apiClient.get(`/medical-history/${recordId}`);
    return response.data;
  },

  getUserMedicalHistory: async (userId: string) => {
    const response = await apiClient.get(`/medical-history/user/${userId}`);
    return response.data;
  },
};

// ============================================================================
// NOTIFICATION ENDPOINTS
// ============================================================================

export const notificationsApi = {
  createNotification: async (notification: {
    title: string;
    message: string;
    notification_type: string;
    related_id?: number;
    related_type?: string;
    action_url?: string;
  }) => {
    const response = await apiClient.post('/notifications/', notification);
    return response.data;
  },

  listNotifications: async (skip: number = 0, limit: number = 20) => {
    const response = await apiClient.get('/notifications', { params: { skip, limit } });
    return response.data;
  },

  getNotification: async (notificationId: string) => {
    const response = await apiClient.get(`/notifications/${notificationId}`);
    return response.data;
  },

  markAsRead: async (notificationId: string) => {
    const response = await apiClient.put(`/notifications/${notificationId}/read`);
    return response.data;
  },

  archiveNotification: async (notificationId: string) => {
    const response = await apiClient.put(`/notifications/${notificationId}/archive`);
    return response.data;
  },

  deleteNotification: async (notificationId: string) => {
    const response = await apiClient.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  deleteAllNotifications: async () => {
    const response = await apiClient.delete('/notifications/');
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await apiClient.put('/notifications/mark-all/read');
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await apiClient.get('/notifications/summary/unread-count');
    return response.data;
  },
};

// ============================================================================
// VIDEO CALL ENDPOINTS
// ============================================================================

export const videoCallsApi = {
  initiateCall: async (callData: {
    patient_id: string;
    provider_id: string;
    scheduled_time?: string;
  }) => {
    const response = await apiClient.post('/telemedicine/video-calls', callData);
    return response.data; // { channel_name, call_token, agora_uid }
  },

  listCalls: async (skip: number = 0, limit: number = 20) => {
    const response = await apiClient.get('/telemedicine/video-calls', { params: { skip, limit } });
    return response.data;
  },

  getCallDetails: async (callId: string) => {
    const response = await apiClient.get(`/telemedicine/video-calls/${callId}`);
    return response.data;
  },

  updateCallStatus: async (
    callId: string,
    updateData: {
      status: 'initiated' | 'ringing' | 'connected' | 'ended' | 'failed';
      call_quality?: string;
      recording_url?: string;
    }
  ) => {
    const response = await apiClient.put(`/telemedicine/video-calls/${callId}`, updateData);
    return response.data;
  },
};

// ============================================================================
// MESSAGING ENDPOINTS
// ============================================================================

export const messagingApi = {
  sendMessage: async (messageData: {
    recipient_id: string;
    subject: string;
    content: string;
    attachment_url?: string;
  }) => {
    const response = await apiClient.post('/telemedicine/messages', messageData);
    return response.data;
  },

  listMessages: async (skip: number = 0, limit: number = 20) => {
    const response = await apiClient.get('/telemedicine/messages', { params: { skip, limit } });
    return response.data;
  },

  getMessage: async (messageId: string) => {
    const response = await apiClient.get(`/telemedicine/messages/${messageId}`);
    return response.data;
  },

  updateMessage: async (
    messageId: string,
    updateData: {
      is_read?: boolean | 'Y' | 'N';
      is_archived?: boolean | 'Y' | 'N';
    }
  ) => {
    const payload = {
      ...updateData,
      is_read:
        updateData.is_read === undefined
          ? undefined
          : updateData.is_read === true
            ? 'Y'
            : updateData.is_read === false
              ? 'N'
              : updateData.is_read,
      is_archived:
        updateData.is_archived === undefined
          ? undefined
          : updateData.is_archived === true
            ? 'Y'
            : updateData.is_archived === false
              ? 'N'
              : updateData.is_archived,
    };
    const response = await apiClient.put(`/telemedicine/messages/${messageId}`, payload);
    return response.data;
  },

  deleteMessage: async (messageId: string) => {
    const response = await apiClient.delete(`/telemedicine/messages/${messageId}`);
    return response.data;
  },
};

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

export const adminApi = {
  getDashboardStats: async () => {
    const response = await apiClient.get('/admin/dashboard/stats');
    return response.data;
  },

  getAppointmentAnalytics: async () => {
    const response = await apiClient.get('/admin/analytics/appointments');
    return response.data;
  },

  getUserAnalytics: async () => {
    const response = await apiClient.get('/admin/analytics/users');
    return response.data;
  },

  listAllUsers: async (skip: number = 0, limit: number = 500) => {
    // Trailing slash matches FastAPI route and avoids redirect quirks with auth headers.
    const response = await apiClient.get<AdminUserRow[]>('/admin/users/', { params: { skip, limit } });
    return response.data;
  },

  deactivateUser: async (userId: string | number) => {
    const response = await apiClient.put(`/admin/users/${userId}/deactivate`);
    return response.data;
  },

  reactivateUser: async (userId: string | number) => {
    const response = await apiClient.put(`/admin/users/${userId}/reactivate`);
    return response.data;
  },

  /** `newRole` is backend role string, e.g. `patient`, `provider`, `pharmacist` (passed as query param). */
  changeUserRole: async (userId: string | number, newRole: string) => {
    const response = await apiClient.put(`/admin/users/${userId}/change-role`, {
      new_role: newRole,
    }, {
      params: { new_role: newRole },
    });
    return response.data;
  },

  getAuditLogs: async (skip: number = 0, limit: number = 100) => {
    const response = await apiClient.get('/admin/audit-logs', { params: { skip, limit } });
    return response.data;
  },

  getSystemHealth: async () => {
    const response = await apiClient.get('/admin/system/health');
    return response.data;
  },

  getAdminNotifications: async () => {
    const response = await apiClient.get('/admin/notifications');
    return response.data;
  },

  getPendingVerifications: async () => {
    const response = await apiClient.get<AdminUserRow[]>('/admin/verifications/pending');
    return response.data;
  },

  listVerifications: async () => {
    const response = await apiClient.get<AdminUserRow[]>('/admin/verifications/');
    return response.data;
  },

  verifyProvider: async (userId: string | number) => {
    const response = await apiClient.put(`/admin/verifications/${userId}/approve`);
    return response.data;
  },

  approveProvider: async (userId: string | number) => {
    const response = await apiClient.put(`/admin/verifications/${userId}/approve`);
    return response.data;
  },

  rejectProvider: async (userId: string | number, reason: string = 'Invalid credentials') => {
    const response = await apiClient.put(`/admin/verifications/${userId}/reject`, undefined, {
      params: { reason },
    });
    return response.data;
  },

  getEcosystemActivity: async (limit: number = 20) => {
    const response = await apiClient.get('/admin/ecosystem/activity', { params: { limit } });
    return response.data;
  },

  getActiveEmergencyDispatch: async () => {
    const response = await apiClient.get('/admin/ops/emergencies/active');
    return response.data;
  },

  // SUPER ADMIN ONLY ENDPOINTS
  createAdmin: async (adminData: {
    email: string;
    username: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role: 'admin' | 'super_admin';
  }) => {
    const response = await apiClient.post('/admin/admins/create', adminData);
    return response.data;
  },

  createUser: async (userData: {
    email: string;
    username: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role: string;
    license_number?: string;
    license_state?: string;
    specialty?: string;
  }) => {
    const response = await apiClient.post('/admin/users/create', userData);
    return response.data;
  },

  deleteUser: async (userId: string | number) => {
    const response = await apiClient.delete(`/admin/users/${userId}`);
    return response.data;
  },

  listAdmins: async (skip: number = 0, limit: number = 100) => {
    const response = await apiClient.get('/admin/admins/', { params: { skip, limit } });
    return response.data;
  },

  getSystemInfo: async () => {
    const response = await apiClient.get('/admin/system/info');
    return response.data;
  },
};

export const auditApi = {
  getLogs: async (params?: {
    skip?: number;
    limit?: number;
    user_id?: number;
    role?: string;
    action?: string;
    resource_type?: string;
    status_filter?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const response = await apiClient.get<AuditLogListApiResponse>('/audit', { params });
    return response.data;
  },

  getSummary: async (days: number = 7) => {
    const response = await apiClient.get<AuditSummaryApiResponse>('/audit/summary/overview', { params: { days } });
    return response.data;
  },

  getUserHistory: async (userId: number, params?: { skip?: number; limit?: number; days?: number }) => {
    const response = await apiClient.get<AuditLogListApiResponse>(`/audit/user/${userId}/history`, { params });
    return response.data;
  },

  exportLogs: async (body: {
    user_id?: number;
    role?: string;
    action?: string;
    resource_type?: string;
    status?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const response = await apiClient.post('/audit/export', body, { responseType: 'blob' });
    return response.data as Blob;
  },

  getSystemSettings: async (): Promise<SystemSettings> => {
    const response = await apiClient.get<SystemSettings>("/admin/system/settings");
    return response.data;
  },

  updateSystemSettings: async (settings: SystemSettingsUpdate): Promise<SystemSettings> => {
    const response = await apiClient.put<SystemSettings>("/admin/system/settings", settings);
    return response.data;
  },

  notifyAllUsers: async (payload: GlobalNotificationRequest): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>("/admin/system/notify-all", payload);
    return response.data;
  },
};

// ============================================================================
// LAB TEST ENDPOINTS
// ============================================================================

export const labTestsApi = {
  createLabTest: async (testData: {
    patient_id: number;
    destination_provider_id: number;
    test_name: string;
    test_code?: string;
    description?: string;
  }) => {
    const response = await apiClient.post('/lab-tests/', testData);
    return response.data;
  },

  listLabTests: async (skip: number = 0, limit: number = 100) => {
    const response = await apiClient.get('/lab-tests/', { params: { skip, limit } });
    return response.data;
  },

  getLabTest: async (id: string | number) => {
    const response = await apiClient.get(`/lab-tests/${id}`);
    return response.data;
  },

  updateLabTest: async (id: string | number, updateData: Record<string, unknown>) => {
    const response = await apiClient.put(`/lab-tests/${id}`, updateData);
    return response.data;
  },

  deleteLabTest: async (id: string | number) => {
    const response = await apiClient.delete(`/lab-tests/${id}`);
    return response.data;
  },
};

// ============================================================================
// IMAGING SCAN ENDPOINTS
// ============================================================================

export const imagingApi = {
  orderImagingScan: async (scanData: {
    patient_id: number;
    destination_provider_id: number;
    scan_type: string;
    body_part?: string;
    clinical_indication?: string;
  }) => {
    const response = await apiClient.post('/imaging/', scanData);
    return response.data;
  },

  listImagingScans: async (skip: number = 0, limit: number = 100) => {
    const response = await apiClient.get('/imaging/', { params: { skip, limit } });
    return response.data;
  },

  getImagingScan: async (id: string | number) => {
    const response = await apiClient.get(`/imaging/${id}`);
    return response.data;
  },

  updateImagingScan: async (id: string | number, updateData: Record<string, unknown>) => {
    const response = await apiClient.put(`/imaging/${id}`, updateData);
    return response.data;
  },

  uploadImagingResults: async (
    id: string | number,
    payload: {
      findings?: string;
      impression?: string;
      status?: string;
      reportFile?: File | null;
      imageFiles?: File[];
    },
  ) => {
    const formData = new FormData();
    if (payload.findings?.trim()) formData.append('findings', payload.findings.trim());
    if (payload.impression?.trim()) formData.append('impression', payload.impression.trim());
    if (payload.status?.trim()) formData.append('status', payload.status.trim());
    if (payload.reportFile) formData.append('report_file', payload.reportFile);
    for (const file of payload.imageFiles ?? []) {
      formData.append('image_files', file);
    }

    const response = await apiClient.post(`/imaging/${id}/results`, formData);
    return response.data;
  },

  deleteImagingScan: async (id: string | number) => {
    const response = await apiClient.delete(`/imaging/${id}`);
    return response.data;
  },
};

export const referralsApi = {
  listReferrals: async (skip: number = 0, limit: number = 200) => {
    const response = await apiClient.get('/referrals/', { params: { skip, limit } });
    return response.data;
  },

  createReferral: async (body: {
    patient_id: number;
    referral_type: 'hospital' | 'laboratory' | 'imaging' | 'pharmacy';
    destination_provider_id: number;
    to_department: string;
    to_department_id?: string;
    reason: string;
    notes?: string;
  }) => {
    const response = await apiClient.post('/referrals/', body);
    return response.data;
  },

  updateReferral: async (referralId: string | number, body: { status?: string; notes?: string }) => {
    const response = await apiClient.put(`/referrals/${referralId}`, body);
    return response.data;
  },
};

// ============================================================================
// STRUCTURED RECORD ENDPOINTS
// ============================================================================

export const recordsApi = {
  listRecords: async <T = Record<string, unknown>>(recordType: string, params?: {
    skip?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get<{ total: number; items: StructuredRecordResponse<T>[] }>('/records/', {
      params: {
        record_type: recordType,
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 100,
      },
    });
    return response.data;
  },

  createRecord: async <T = Record<string, unknown>>(body: {
    id?: string;
    record_type: string;
    patient_id?: number | null;
    provider_id?: number | null;
    created_by?: number | null;
    appointment_id?: number | null;
    status?: string | null;
    payload: T;
  }) => {
    const response = await apiClient.post<StructuredRecordResponse<T>>('/records/', body);
    return response.data;
  },

  updateRecord: async <T = Record<string, unknown>>(recordId: string, body: {
    patient_id?: number | null;
    provider_id?: number | null;
    created_by?: number | null;
    appointment_id?: number | null;
    status?: string | null;
    payload?: T;
  }) => {
    const response = await apiClient.put<StructuredRecordResponse<T>>(`/records/${recordId}`, body);
    return response.data;
  },

  deleteRecord: async (recordId: string) => {
    const response = await apiClient.delete(`/records/${recordId}`);
    return response.data;
  },

  getSynchronizedHistory: async (patientId: string | number) => {
    const response = await apiClient.get<SynchronizedHistoryResponse>(`/records/synchronized-history/${patientId}`);
    return response.data;
  },
};

export const organizationsApi = {
  listOrganizations: async () => {
    const response = await apiClient.get<{ total: number; items: OrganizationApiResponse[] }>('/organizations');
    return response.data;
  },
};

export const patientPermissionsApi = {
  listPermissions: async (patientId?: string | number) => {
    const response = await apiClient.get<{ total: number; items: PatientPermissionResponse[] }>('/patient-permissions', {
      params: patientId ? { patient_id: patientId } : undefined,
    });
    return response.data;
  },

  requestAccess: async (body: {
    patient_id: number;
    organization_id: number;
    scope?: string[];
    reason?: string;
  }) => {
    const response = await apiClient.post<PatientPermissionResponse>('/patient-permissions/request', body);
    return response.data;
  },

  grantAccess: async (body: {
    patient_id: number;
    organization_id: number;
    scope?: string[];
    reason?: string;
  }) => {
    const response = await apiClient.post<PatientPermissionResponse>('/patient-permissions/grant', body);
    return response.data;
  },

  approveAccess: async (permissionId: string, body?: { reason?: string; expires_at?: string | null }) => {
    const response = await apiClient.post<PatientPermissionResponse>(`/patient-permissions/${permissionId}/approve`, body || {});
    return response.data;
  },

  denyAccess: async (permissionId: string, body?: { reason?: string }) => {
    const response = await apiClient.post<PatientPermissionResponse>(`/patient-permissions/${permissionId}/deny`, body || {});
    return response.data;
  },

  revokeAccess: async (permissionId: string, body?: { reason?: string }) => {
    const response = await apiClient.post<PatientPermissionResponse>(`/patient-permissions/${permissionId}/revoke`, body || {});
    return response.data;
  },
};

export const medicalRecordsApi = {
  getUnifiedRecord: async (patientId: string | number) => {
    const response = await apiClient.get<UnifiedPatientRecordApiResponse>(`/medical-records/unified/${patientId}`);
    return response.data;
  },
};

// ============================================================================
// EXPORT ALL APIS
// ============================================================================

export const api = {
  auth: authApi,
  users: usersApi,
  accountLinks: accountLinksApi,
  appointments: appointmentsApi,
  prescriptions: prescriptionsApi,
  allergies: allergiesApi,
  medicalHistory: medicalHistoryApi,
  notifications: notificationsApi,
  videoCalls: videoCallsApi,
  messaging: messagingApi,
  admin: adminApi,
  audit: auditApi,
  labTests: labTestsApi,
  imaging: imagingApi,
  referrals: referralsApi,
  ambulance: ambulanceApi,
  liveLocation: liveLocationApi,
  records: recordsApi,
  organizations: organizationsApi,
  patientPermissions: patientPermissionsApi,
  medicalRecords: medicalRecordsApi,
  getSystemStatus: async (): Promise<Partial<SystemSettings>> => {
    const response = await apiClient.get<Partial<SystemSettings>>("/system/status");
    return response.data;
  },
};
