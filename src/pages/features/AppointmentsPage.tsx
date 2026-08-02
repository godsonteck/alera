import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Plus, X, Clock, Inbox, Star, MapPin, AlertCircle, Check, XCircle, Edit2, UserCheck, Video } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { useNotifications } from '@/contexts/useNotifications';
import { type Doctor } from '@/data/mockData';
import { api, type ApiUser } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';
import { normalizeUserRole } from '@/lib/roleUtils';
import { getBookableDoctors } from '@/lib/providerDirectory';
import { buildScheduledIso, getAvailableAppointmentSlots, getVisibleAppointments } from '@/lib/appointmentUtils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { User as AuthUser } from '@/contexts/AuthContext';

type AppointmentFormData = {
  doctorId: string;
  date: string;
  time: string;
  type: string;
  appointmentMode: 'telemedicine' | 'in-person';
};

const AppointmentsPage = () => {
  const { user } = useAuth();
  const { appointments, cancelAppointment, confirmAppointment, rescheduleAppointment, refreshAppData } = useAppData();
  const { addNotification } = useNotifications();
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorUsers, setDoctorUsers] = useState<AuthUser[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [doctorsLoadError, setDoctorsLoadError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AppointmentFormData>({ doctorId: '', date: '', time: '', type: '', appointmentMode: 'telemedicine' });
  const [cancelDialogOpen, setCancelDialogOpen] = useState<string | null>(null);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState<string | null>(null);
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' });
  const [cancellationReason, setCancellationReason] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const effectiveRole = normalizeUserRole(user?.role) ?? user?.role;
  const focusId = searchParams.get('focus');
  const selectedDoctorId = searchParams.get('doctor');
  const visibleAppointments = useMemo(() => getVisibleAppointments(appointments, user), [appointments, user]);
  const filtered = useMemo(
    () => (filter === 'all' ? visibleAppointments : visibleAppointments.filter((appointment) => appointment.status === filter)),
    [filter, visibleAppointments],
  );
  const availableDoctors = useMemo(() => getBookableDoctors(doctorUsers), [doctorUsers]);

  const mapApiDoctorToAuthUser = (doc: ApiUser): AuthUser => {
    const fullName = doc.full_name?.trim() || [doc.first_name, doc.last_name].filter(Boolean).join(' ').trim();
    const [firstName = '', ...lastNameParts] = (fullName || doc.email).split(' ');

    return {
      id: String(doc.id),
      email: doc.email,
      name: fullName || doc.email,
      role: 'doctor',
      avatar: doc.avatar || doc.profile_image_url,
      profile: {
        firstName,
        lastName: lastNameParts.join(' '),
        phone: doc.phone,
        address: doc.address,
        city: doc.city,
        state: doc.state,
        zipCode: doc.zip_code,
        dateOfBirth: doc.date_of_birth ? String(doc.date_of_birth) : undefined,
        bio: doc.bio,
        avatar: doc.avatar || doc.profile_image_url,
        notificationEmail: true,
        notificationSms: false,
        privacyPublicProfile: false,
      },
    };
  };

  useEffect(() => {
    let mounted = true;
    const fetchDoctors = async () => {
      setIsLoadingDoctors(true);
      setDoctorsLoadError(null);
      try {
        const response = await api.getUsers({ role: 'doctor' });
        if (mounted) {
          const docs = (response.users || []).map(mapApiDoctorToAuthUser);
          setDoctorUsers(docs);
        }
      } catch (err) {
        if (mounted) {
          setDoctorsLoadError(handleApiError(err, 'fetch doctors list'));
        }
      } finally {
        if (mounted) setIsLoadingDoctors(false);
      }
    };
    void fetchDoctors();
    return () => { mounted = false; };
  }, []);

  const handleSelectDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setFormData((prev) => ({ ...prev, doctorId: doctor.id, time: '' }));
  };

  const availableSlots = useMemo(() => {
    if (!formData.date || !selectedDoctor) return [];
    return getAvailableAppointmentSlots(appointments, selectedDoctor.id, formData.date);
  }, [formData.date, selectedDoctor, appointments]);

  const handleBook = async () => {
    if (!selectedDoctor || !formData.date || !formData.time || !formData.type) {
      setBookingError('Please complete all required appointment coordinates.');
      return;
    }
    setBookingLoading(true);
    setBookingError(null);
    try {
      const scheduledIso = buildScheduledIso(formData.date, formData.time);
      await api.createAppointment({
        doctor_id: selectedDoctor.id,
        patient_id: user?.id,
        appointment_date: scheduledIso,
        appointment_type: formData.type,
        appointment_mode: formData.appointmentMode,
      });

      addNotification({
        title: 'Consultation Scheduled',
        message: `Consultation with ${selectedDoctor.name} confirmed for ${formData.date} at ${formData.time}.`,
        type: 'appointment',
        priority: 'medium',
        audience: 'personal',
      });

      await refreshAppData();
      setShowForm(false);
      setSelectedDoctor(null);
      setFormData({ doctorId: '', date: '', time: '', type: '', appointmentMode: 'telemedicine' });
    } catch (err) {
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Plus, X, Clock, Inbox, Star, MapPin, AlertCircle, Check, XCircle, Edit2, UserCheck, Video } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { useNotifications } from '@/contexts/useNotifications';
import { type Doctor } from '@/data/mockData';
import { api, type ApiUser } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';
import { normalizeUserRole } from '@/lib/roleUtils';
import { getBookableDoctors } from '@/lib/providerDirectory';
import { buildScheduledIso, getAvailableAppointmentSlots, getVisibleAppointments } from '@/lib/appointmentUtils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { User as AuthUser } from '@/contexts/AuthContext';

type AppointmentFormData = {
  doctorId: string;
  date: string;
  time: string;
  type: string;
  appointmentMode: 'telemedicine' | 'in-person';
};

const AppointmentsPage = () => {
  const { user } = useAuth();
  const { appointments, cancelAppointment, confirmAppointment, rescheduleAppointment, refreshAppData } = useAppData();
  const { addNotification } = useNotifications();
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorUsers, setDoctorUsers] = useState<AuthUser[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [doctorsLoadError, setDoctorsLoadError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AppointmentFormData>({ doctorId: '', date: '', time: '', type: '', appointmentMode: 'telemedicine' });
  const [cancelDialogOpen, setCancelDialogOpen] = useState<string | null>(null);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState<string | null>(null);
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' });
  const [cancellationReason, setCancellationReason] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const effectiveRole = normalizeUserRole(user?.role) ?? user?.role;
  const focusId = searchParams.get('focus');
  const selectedDoctorId = searchParams.get('doctor');
  const visibleAppointments = useMemo(() => getVisibleAppointments(appointments, user), [appointments, user]);
  const filtered = useMemo(
    () => (filter === 'all' ? visibleAppointments : visibleAppointments.filter((appointment) => appointment.status === filter)),
    [filter, visibleAppointments],
  );
  const availableDoctors = useMemo(() => getBookableDoctors(doctorUsers), [doctorUsers]);

  const mapApiDoctorToAuthUser = (doc: ApiUser): AuthUser => {
    const fullName = doc.full_name?.trim() || [doc.first_name, doc.last_name].filter(Boolean).join(' ').trim();
    const [firstName = '', ...lastNameParts] = (fullName || doc.email).split(' ');

    return {
      id: String(doc.id),
      email: doc.email,
      name: fullName || doc.email,
      role: 'doctor',
      avatar: doc.avatar || doc.profile_image_url,
      profile: {
        firstName,
        lastName: lastNameParts.join(' '),
        phone: doc.phone,
        address: doc.address,
        city: doc.city,
        state: doc.state,
        zipCode: doc.zip_code,
        dateOfBirth: doc.date_of_birth ? String(doc.date_of_birth) : undefined,
        bio: doc.bio,
        avatar: doc.avatar || doc.profile_image_url,
        notificationEmail: true,
        notificationSms: false,
        privacyPublicProfile: false,
      },
    };
  };

  useEffect(() => {
    let mounted = true;
    const fetchDoctors = async () => {
      setIsLoadingDoctors(true);
      setDoctorsLoadError(null);
      try {
        const response = await api.getUsers({ role: 'doctor' });
        if (mounted) {
          const docs = (response.users || []).map(mapApiDoctorToAuthUser);
          setDoctorUsers(docs);
        }
      } catch (err) {
        if (mounted) {
          setDoctorsLoadError(handleApiError(err, 'fetch doctors list'));
        }
      } finally {
        if (mounted) setIsLoadingDoctors(false);
      }
    };
    void fetchDoctors();
    return () => { mounted = false; };
  }, []);

  const handleSelectDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setFormData((prev) => ({ ...prev, doctorId: doctor.id, time: '' }));
  };

  const availableSlots = useMemo(() => {
    if (!formData.date || !selectedDoctor) return [];
    return getAvailableAppointmentSlots(appointments, selectedDoctor.id, formData.date);
  }, [formData.date, selectedDoctor, appointments]);

  const handleBook = async () => {
    if (!selectedDoctor || !formData.date || !formData.time || !formData.type) {
      setBookingError('Please complete all required appointment coordinates.');
      return;
    }
    setBookingLoading(true);
    setBookingError(null);
    try {
      const scheduledIso = buildScheduledIso(formData.date, formData.time);
      await api.createAppointment({
        doctor_id: selectedDoctor.id,
        patient_id: user?.id,
        appointment_date: scheduledIso,
        appointment_type: formData.type,
        appointment_mode: formData.appointmentMode,
      });

      addNotification({
        title: 'Consultation Scheduled',
        message: `Consultation with ${selectedDoctor.name} confirmed for ${formData.date} at ${formData.time}.`,
        type: 'appointment',
        priority: 'medium',
        audience: 'personal',
      });

      await refreshAppData();
      setShowForm(false);
      setSelectedDoctor(null);
      setFormData({ doctorId: '', date: '', time: '', type: '', appointmentMode: 'telemedicine' });
    } catch (err) {
      setBookingError(handleApiError(err, 'book appointment'));
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="alera-feature space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[var(--text-high)]">Appointments</h1>
            <span className="text-xs bg-[var(--surface-secondary)] text-[var(--brand-primary)] border border-[var(--border)] px-2 py-0.5 rounded-full font-semibold">
              {filtered.length} {filtered.length === 1 ? 'Appointment' : 'Appointments'}
            </span>
          </div>
          <p className="text-xs text-[var(--text-medium)] mt-1">
            Book, schedule, and view your doctor appointments and telehealth visits.
          </p>
        </div>

        {effectiveRole === 'patient' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors shadow-xs"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showForm ? 'Cancel' : '+ Book Appointment'}</span>
          </button>
        )}
      </div>

      {/* Booking Form Surface */}
      {showForm && (
        <div className="p-5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl shadow-sm space-y-4">
          <span className="text-sm font-bold text-[var(--text-high)] block border-b border-[var(--border)] pb-3">
            Book New Appointment
          </span>

          {!selectedDoctor ? (
            <div className="space-y-3">
              <span className="text-xs text-[var(--text-medium)] font-medium">Choose a doctor or specialist:</span>
              {isLoadingDoctors ? (
                <div className="py-6 text-center text-xs text-[var(--text-medium)]">Loading available doctors...</div>
              ) : availableDoctors.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-medium)]">No doctors are currently available.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {availableDoctors.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleSelectDoctor(doc)}
                      className="p-3.5 bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[var(--brand-primary)] rounded-lg cursor-pointer transition-all hover:shadow-xs space-y-1"
                    >
                      <div className="font-bold text-xs text-[var(--text-high)]">{doc.name}</div>
                      <div className="text-xs text-[var(--brand-primary)] font-medium">{doc.specialty}</div>
                      <div className="text-[11px] text-[var(--text-medium)]">${doc.consultationFee} Fee | {doc.experience} yrs experience</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-[var(--surface-secondary)] border border-[var(--brand-primary)]/40 rounded-lg">
                <div>
                  <div className="font-bold text-xs text-[var(--text-high)]">{selectedDoctor.name}</div>
                  <div className="text-xs text-[var(--text-medium)]">{selectedDoctor.specialty} • ${selectedDoctor.consultationFee}</div>
                </div>
                <button onClick={() => setSelectedDoctor(null)} className="text-[var(--text-medium)] hover:text-[var(--text-high)] p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-xs text-[var(--text-medium)] font-medium block mb-1">Appointment Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  >
                    <option value="">Select type</option>
                    <option value="Initial Consultation">Initial Consultation</option>
                    <option value="Follow-up">Follow-up Visit</option>
                    <option value="Specialist Review">Specialist Review</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[var(--text-medium)] font-medium block mb-1">Visit Mode</label>
                  <select
                    value={formData.appointmentMode}
                    onChange={(e) => setFormData({ ...formData, appointmentMode: e.target.value as 'telemedicine' | 'in-person' })}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  >
                    <option value="telemedicine">Video Call (Telehealth)</option>
                    <option value="in-person">In-Person at Clinic</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[var(--text-medium)] font-medium block mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--text-medium)] font-medium block mb-1">Time Slot</label>
                  <select
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    disabled={!formData.date}
                  >
                    <option value="">Select time</option>
                    {availableSlots.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>

              {bookingError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-500 font-medium">
                  {bookingError}
                </div>
              )}

              <button
                onClick={() => void handleBook()}
                disabled={bookingLoading || !formData.type || !formData.date || !formData.time}
                className="w-full bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white font-bold py-2.5 rounded-lg transition-colors text-xs shadow-xs disabled:opacity-50"
              >
                {bookingLoading ? 'Booking appointment...' : 'Confirm Appointment'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'scheduled', 'in-progress', 'completed', 'cancelled'].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filter === st
                ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white font-semibold shadow-xs'
                : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--text-medium)] hover:text-[var(--text-high)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            {st === 'all' ? 'All Appointments' : st.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Appointment Records List */}
      {filtered.length === 0 ? (
        <div className="p-10 text-center bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-medium)]">
          No appointments found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((apt) => (
            <div
              key={apt.id}
              className={`p-4 bg-[var(--surface-elevated)] border rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-all shadow-xs ${
                focusId === apt.id ? 'border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]' : 'border-[var(--border)]'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg text-[var(--brand-primary)] mt-0.5">
                  {apt.appointmentMode === 'telemedicine' ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-bold text-[var(--text-high)] text-xs flex items-center gap-2">
                    <span>{apt.type}</span>
                    <span className="text-[10px] text-[var(--brand-primary)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded-full border border-[var(--border)] capitalize font-medium">
                      {apt.appointmentMode}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-medium)] mt-1">
                    {effectiveRole === 'doctor' ? `Patient: ${apt.patientName}` : `Doctor: ${apt.doctorName}`}
                  </div>
                  <div className="text-[11px] text-[var(--text-medium)] mt-0.5">
                    Date & Time: {apt.date} at {apt.time}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-center">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border capitalize ${
                  apt.status === 'completed'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                    : apt.status === 'cancelled'
                    ? 'bg-red-500/10 border-red-500/30 text-red-500'
                    : 'bg-sky-500/10 border-sky-500/30 text-sky-500'
                }`}>
                  {apt.status}
                </span>

                {effectiveRole === 'doctor' && apt.status === 'scheduled' && (
                  <button
                    onClick={() => confirmAppointment(apt.id)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                  >
                    Confirm
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;
