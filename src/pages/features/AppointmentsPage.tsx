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
    <div className="alera-feature space-y-4 text-slate-700">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[#0b3d62]">Appointments</span>
            <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-mono">
              {filtered.length} ACTIVE RECORDS
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Manage scheduled patient visits, telemedicine streams, and consultation handoffs.
          </p>
        </div>

        {effectiveRole === 'patient' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showForm ? 'CANCEL REQUISITION' : 'REQUISITION CONSULT'}</span>
          </button>
        )}
      </div>

      {/* Booking Form Surface */}
      {showForm && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">
            New Consultation Requisition
          </span>

          {!selectedDoctor ? (
            <div className="space-y-3">
              <span className="text-[11px] text-slate-500">Select a specialist:</span>
              {isLoadingDoctors ? (
                <div className="py-6 text-center text-xs text-slate-500">Querying clinician registry...</div>
              ) : availableDoctors.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">No specialists are available.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {availableDoctors.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleSelectDoctor(doc)}
                      className="p-3 bg-[#0F1218] border border-[#252A35] hover:border-cyan-500/50 rounded-[2px] cursor-pointer transition-colors space-y-1"
                    >
                      <div className="font-bold text-xs text-[#ECEEF2]">{doc.name}</div>
                      <div className="text-[10px] text-cyan-400">{doc.specialty}</div>
                      <div className="text-[10px] text-slate-400">${doc.consultationFee} Fee | {doc.experience} yrs exp</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#0F1218] border border-cyan-500/40 rounded-[2px]">
                <div>
                  <div className="font-bold text-xs text-cyan-300">{selectedDoctor.name}</div>
                  <div className="text-[10px] text-slate-400">{selectedDoctor.specialty} • ${selectedDoctor.consultationFee}</div>
                </div>
                <button onClick={() => setSelectedDoctor(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Consult Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
                  >
                    <option value="">Select type</option>
                    <option value="Initial Consultation">Initial Consultation</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Specialist Review">Specialist Review</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Mode</label>
                  <select
                    value={formData.appointmentMode}
                    onChange={(e) => setFormData({ ...formData, appointmentMode: e.target.value as 'telemedicine' | 'in-person' })}
                    className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
                  >
                    <option value="telemedicine">Telemedicine Video</option>
                    <option value="in-person">In-Person Clinic</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Target Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Time Slot</label>
                  <select
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
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
                <div className="p-2 bg-red-950/40 border border-red-600/60 rounded-[2px] text-xs text-red-300">
                  {bookingError}
                </div>
              )}

              <button
                onClick={() => void handleBook()}
                disabled={bookingLoading || !formData.type || !formData.date || !formData.time}
                className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs"
              >
                {bookingLoading ? 'Saving appointment...' : 'Confirm appointment'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {['all', 'scheduled', 'in-progress', 'completed', 'cancelled'].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3 py-1 rounded-[2px] text-xs font-mono uppercase tracking-wider border transition-colors ${
              filter === st
                ? 'bg-[#151922] border-cyan-500/60 text-cyan-300 font-semibold'
                : 'bg-[#0F1218] border-[#252A35] text-slate-400 hover:text-[#ECEEF2]'
            }`}
          >
            {st === 'all' ? 'ALL QUEUES' : st.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Appointment Records List */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          No matching appointment records found.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((apt) => (
            <div
              key={apt.id}
              className={`p-3 bg-[#090D14] border rounded-[2px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                focusId === apt.id ? 'border-cyan-500/80 bg-[#0F1218]' : 'border-[#252A35]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#151922] border border-[#2F3542] rounded-[2px] text-cyan-400 mt-0.5">
                  {apt.appointmentMode === 'telemedicine' ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-bold text-[#ECEEF2] flex items-center gap-2">
                    <span>{apt.type}</span>
                    <span className="text-[10px] text-cyan-400/80 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-800/40">
                      {apt.appointmentMode}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {effectiveRole === 'doctor' ? `Patient: ${apt.patientName}` : `Clinician: ${apt.doctorName}`}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    Scheduled: {apt.date} at {apt.time}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase border ${
                  apt.status === 'completed'
                    ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                    : apt.status === 'cancelled'
                    ? 'bg-red-950/50 border-red-600/60 text-red-400'
                    : 'bg-cyan-950/50 border-cyan-600/60 text-cyan-300'
                }`}>
                  {apt.status}
                </span>

                {effectiveRole === 'doctor' && apt.status === 'scheduled' && (
                  <button
                    onClick={() => confirmAppointment(apt.id)}
                    className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-600/60 text-emerald-300 text-[10px] font-bold rounded-[2px] hover:bg-emerald-900"
                  >
                    CONFIRM
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
