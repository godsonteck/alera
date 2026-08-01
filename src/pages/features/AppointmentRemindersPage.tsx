import { useState, useMemo } from 'react';
import { Bell, Clock, CheckCircle, AlertCircle, Download, Send, Calendar, Search, User, Stethoscope, Video, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { useNotifications } from '@/contexts/useNotifications';
import { toast } from '@/components/ui/use-toast';
import type { Appointment } from '@/data/mockData';
import { getAppointmentTimeUntilLabel, isWithinNext24Hours, isWithinNextHour, parseAppointmentDateTime } from '@/lib/appointmentUtils';

const AppointmentRemindersPage = () => {
  const { user } = useAuth();
  const { appointments, updateAppointment } = useAppData();
  const { addNotification } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reminderFilter, setReminderFilter] = useState('all');

  const userAppointments = useMemo(() => {
    if (user?.role === 'doctor') return appointments.filter(apt => apt.doctorId === user.id && apt.status === 'scheduled');
    return appointments.filter(apt => apt.patientId === user?.id && apt.status === 'scheduled');
  }, [appointments, user?.id, user?.role]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return userAppointments.filter(apt => {
      const matchSearch = !q || apt.type.toLowerCase().includes(q) || apt.doctorName.toLowerCase().includes(q) || apt.patientName.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || apt.status === statusFilter;
      if (reminderFilter === 'pending') return matchSearch && matchStatus && (!apt.reminder24hSent || !apt.reminder1hSent);
      if (reminderFilter === 'sent') return matchSearch && matchStatus && (apt.reminder24hSent || apt.reminder1hSent);
      return matchSearch && matchStatus;
    });
  }, [userAppointments, searchQuery, statusFilter, reminderFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => parseAppointmentDateTime(a.date, a.time).getTime() - parseAppointmentDateTime(b.date, b.time).getTime());
  }, [filtered]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: userAppointments.length,
      upcoming24h: userAppointments.filter(apt => isWithinNext24Hours(apt.date, apt.time, now)).length,
      remindersSent: userAppointments.filter(apt => apt.reminder24hSent || apt.reminder1hSent).length,
      pendingReminders: userAppointments.filter(apt => !apt.reminder24hSent && !apt.reminder1hSent).length,
    };
  }, [userAppointments]);

  const handleSend24hReminder = (appointment: Appointment) => {
    if (appointment.reminder24hSent) return;
    addNotification({
      type: 'reminder', title: `T-24H ALARM: ${appointment.type}`,
      message: user?.role === 'doctor' ? `Scheduled encounter with ${appointment.patientName} at ${appointment.time}. Ensure readiness.` : `Scheduled encounter with ${appointment.doctorName} at ${appointment.time}. Standby required.`,
      audience: 'personal', priority: 'medium', targetEmails: user?.email ? [user.email] : [], actionUrl: '/dashboard/appointments', actionLabel: 'View appointments',
    });
    updateAppointment(appointment.id, prev => ({ ...prev, reminder24hSent: true }));
    toast({ title: '24H ALERT TRANSMITTED', description: `Notification injected into stream for ${appointment.type}.` });
  };

  const handleSend1hReminder = (appointment: Appointment) => {
    if (appointment.reminder1hSent) return;
    addNotification({
      type: 'reminder', title: `T-01H ALARM: ${appointment.type}`,
      message: user?.role === 'doctor' ? `Appointment with ${appointment.patientName} starts in 1 hour.` : `Appointment with ${appointment.doctorName} starts in 1 hour.`,
      audience: 'personal', priority: 'high', targetEmails: user?.email ? [user.email] : [], actionUrl: '/dashboard/appointments', actionLabel: 'View appointments',
    });
    updateAppointment(appointment.id, prev => ({ ...prev, reminder1hSent: true }));
    toast({ title: '01H ALERT TRANSMITTED', description: `Notification injected into stream for ${appointment.type}.` });
  };

  const handleExportReminders = () => {
    if (sorted.length === 0) { toast({ title: 'Nothing to export', description: 'No reminders match your filters.', variant: 'destructive' }); return; }
    const csv = [['EVENT', 'DOCTOR', 'PATIENT', 'DATE', 'TIME', 'MODE', '24H_TX', '01H_TX'].join(','), ...sorted.map(a => [a.type, a.doctorName, a.patientName, a.date, a.time, a.appointmentMode, a.reminder24hSent ? 'SENT' : 'PENDING', a.reminder1hSent ? 'SENT' : 'PENDING'].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `alerts-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
    toast({ title: 'Reminders exported', description: 'Reminder list saved locally.' });
  };

  return (
    <div className="alera-feature space-y-4 text-slate-700">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-lg font-bold text-[#0b3d62]">Reminders</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Manage automated clinical event notifications.</p>
        </div>
        <button onClick={handleExportReminders} className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-[#2F3542] text-slate-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors uppercase tracking-wider">
          <Download className="w-4 h-4" /> Export reminders
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-center">
          <div className="text-[9px] text-slate-500 uppercase font-bold">TOTAL SCHEDULED</div>
          <div className="text-xl font-bold font-mono text-[#ECEEF2] mt-0.5">{stats.total}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-amber-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-amber-500 uppercase font-bold flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Next 24 hours</div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">{stats.upcoming24h}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-emerald-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-emerald-500 uppercase font-bold flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" /> Sent</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{stats.remindersSent}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-cyan-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-cyan-500 uppercase font-bold flex items-center justify-center gap-1"><Bell className="w-3 h-3" /> To send</div>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">{stats.pendingReminders}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search reminders"
            className="w-full h-8 pl-8 pr-3 rounded-[2px] border border-[#252A35] bg-[#090D14] text-[#ECEEF2] text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-8 px-2 rounded-[2px] border border-[#252A35] bg-[#090D14] text-xs text-[#ECEEF2] uppercase font-bold tracking-wider">
          <option value="all">ALL EVENTS</option><option value="scheduled">SCHEDULED</option><option value="in-progress">ACTIVE</option><option value="completed">ARCHIVED</option>
        </select>
        <select value={reminderFilter} onChange={e => setReminderFilter(e.target.value)} className="h-8 px-2 rounded-[2px] border border-[#252A35] bg-[#090D14] text-xs text-[#ECEEF2] uppercase font-bold tracking-wider">
          <option value="all">ALL ALERTS</option><option value="pending">PENDING</option><option value="sent">TRANSMITTED</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          NO EVENTS MATCH QUERY PARAMETERS.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((appointment) => {
            const now = new Date();
            const timeUntil = getAppointmentTimeUntilLabel(appointment.date, appointment.time, now);
            const canSend24h = isWithinNext24Hours(appointment.date, appointment.time, now) && !appointment.reminder24hSent;
            const canSend1h = isWithinNextHour(appointment.date, appointment.time, now) && !appointment.reminder1hSent;

            return (
              <div key={appointment.id} className="bg-[#090D14] border border-[#252A35] rounded-[2px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-[#2F3542]">
                <div className="flex gap-4 items-start md:items-center">
                  <div className="hidden md:flex p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] text-cyan-400">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[#ECEEF2] text-xs uppercase tracking-wider">{appointment.type}</h3>
                      <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${appointment.status === 'scheduled' ? 'bg-amber-950/40 border-amber-600/60 text-amber-400' : 'bg-[#151922] border-[#252A35] text-slate-500'}`}>
                        {appointment.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 mt-2 uppercase">
                      <span className="flex items-center gap-1 text-slate-400"><User className="w-3 h-3" /> {user?.role === 'doctor' ? appointment.patientName : appointment.doctorName}</span>
                      <span className="flex items-center gap-1 font-mono text-cyan-400"><Calendar className="w-3 h-3 text-slate-500" /> {appointment.date} @ {appointment.time}</span>
                      <span className="flex items-center gap-1">{appointment.appointmentMode === 'telemedicine' ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />} {appointment.appointmentMode === 'telemedicine' ? 'VIRTUAL' : 'ON-SITE'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:items-end gap-2 shrink-0 border-t md:border-t-0 border-[#252A35] pt-3 md:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-[#151922] border border-[#2F3542] text-cyan-400 font-mono text-[9px] font-bold rounded-[2px] uppercase">
                      In {timeUntil}
                    </span>
                    {(appointment.reminder24hSent || appointment.reminder1hSent) && (
                      <span className="px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-600/60 text-emerald-400 font-mono text-[9px] font-bold rounded-[2px] uppercase flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5" /> TX COMPLETE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canSend24h ? (
                      <button onClick={() => handleSend24hReminder(appointment)} className="px-2 py-1 bg-cyan-950/40 border border-cyan-600/60 text-cyan-400 hover:bg-cyan-900/60 text-[9px] font-bold uppercase rounded-[2px] transition-colors flex items-center gap-1"><Send className="w-2.5 h-2.5" /> TX 24H</button>
                    ) : (
                      <span className={`px-2 py-1 border text-[9px] font-bold uppercase rounded-[2px] flex items-center gap-1 ${appointment.reminder24hSent ? 'bg-emerald-950/20 border-emerald-600/40 text-emerald-500/50' : 'bg-[#151922] border-[#252A35] text-slate-600'}`}><Bell className="w-2.5 h-2.5" /> 24H</span>
                    )}
                    
                    {canSend1h ? (
                      <button onClick={() => handleSend1hReminder(appointment)} className="px-2 py-1 bg-amber-950/40 border border-amber-600/60 text-amber-400 hover:bg-amber-900/60 text-[9px] font-bold uppercase rounded-[2px] transition-colors flex items-center gap-1"><Send className="w-2.5 h-2.5" /> TX 01H</button>
                    ) : (
                      <span className={`px-2 py-1 border text-[9px] font-bold uppercase rounded-[2px] flex items-center gap-1 ${appointment.reminder1hSent ? 'bg-emerald-950/20 border-emerald-600/40 text-emerald-500/50' : 'bg-[#151922] border-[#252A35] text-slate-600'}`}><Bell className="w-2.5 h-2.5" /> 01H</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {stats.pendingReminders > 0 && stats.upcoming24h > 0 && (
        <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-[2px] text-[10px] text-amber-500/80 uppercase leading-relaxed flex items-start gap-2 mt-4">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
          <div>
            <span className="font-bold text-amber-400 block mb-1">SYSTEM ALERT: PENDING HORIZON ALERTS</span>
            {stats.pendingReminders} EVENTS ARE WITHIN 24H HORIZON WITHOUT ALERT TRANSMISSION. MANUAL OVERRIDE AVAILABLE ABOVE OR ENABLE AUTO-TX IN SYSTEM PREFERENCES.
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentRemindersPage;
