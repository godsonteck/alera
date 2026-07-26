import React, { useMemo, useState } from 'react';
import { AlertCircle, Bell, CheckCircle2, Clock, Search, Send, Calendar, Video, MapPin } from 'lucide-react';
import { useAppData } from '@/contexts/useAppData';
import { useAuth } from '@/contexts/useAuth';
import { toast } from '@/components/ui/use-toast';
import type { Appointment } from '@/data/mockData';

export const SmartAppointmentRemindersPage: React.FC = () => {
  const { appointments, generateAppointmentReminders, sendReminder, acknowledgeReminder, getPatientReminders, getReminderByAppointment } = useAppData();
  const { user } = useAuth();
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set());
  const [selectedReminders, setSelectedReminders] = useState<Set<'24h' | '1h' | '15m'>>(new Set(['24h', '1h']));
  const [activeTab, setActiveTab] = useState<'generate' | 'manage'>('generate');
  const [searchQuery, setSearchQuery] = useState('');

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.date);
      return aptDate > now && apt.status !== 'cancelled' && (user?.role === 'doctor' || apt.patientId === user?.id) && getReminderByAppointment(apt.id).length === 0;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [appointments, user, getReminderByAppointment]);

  const patientReminders = useMemo(() => user?.role === 'doctor' ? [] : getPatientReminders(user?.id || ''), [user, getPatientReminders]);
  const filteredPatientReminders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patientReminders;
    return patientReminders.filter((r) => {
      const a = appointments.find((item) => item.id === r.appointmentId);
      return Boolean(a && (a.doctorName.toLowerCase().includes(q) || a.type.toLowerCase().includes(q) || r.reminderType.toLowerCase().includes(q)));
    });
  }, [appointments, patientReminders, searchQuery]);

  const handleSelectAppointment = (id: string) => {
    const next = new Set(selectedAppointments);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    setSelectedAppointments(next);
  };

  const handleToggleReminder = (type: '24h' | '1h' | '15m') => {
    const next = new Set(selectedReminders);
    if (next.has(type)) { next.delete(type); } else { next.add(type); }
    setSelectedReminders(next);
  };

  const handleGenerateReminders = () => {
    selectedAppointments.forEach((id) => generateAppointmentReminders(id, Array.from(selectedReminders) as ('24h' | '1h' | '15m')[]));
    setSelectedAppointments(new Set());
    setActiveTab('manage');
    toast({ title: 'Reminders deployed', description: `Schedules created for ${selectedAppointments.size} events.` });
  };

  const handleResendReminder = (id: string) => {
    sendReminder(id, 'email');
    toast({ title: 'Reminder retransmitted', description: 'Notification sent via email interface.' });
  };

  const handleAcknowledgeReminder = (id: string) => {
    acknowledgeReminder(id, user?.id || '');
    toast({ title: 'Notification acknowledged', description: 'Reminder marked as seen in matrix.' });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-cyan-950/40 border-cyan-600/60 text-cyan-400';
      case 'sent': return 'bg-emerald-950/40 border-emerald-600/60 text-emerald-400';
      case 'acknowledged': return 'bg-[#151922] border-[#2F3542] text-slate-400';
      case 'failed': return 'bg-red-950/40 border-red-600/60 text-red-400';
      default: return 'bg-[#151922] border-[#252A35] text-slate-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-2.5 h-2.5" />;
      case 'sent': return <Send className="w-2.5 h-2.5" />;
      case 'acknowledged': return <CheckCircle2 className="w-2.5 h-2.5" />;
      case 'failed': return <AlertCircle className="w-2.5 h-2.5" />;
      default: return null;
    }
  };

  const getReminderTypeLabel = (type: string) => {
    switch (type) {
      case '24h': return 'T-MINUS 24 HOURS';
      case '1h': return 'T-MINUS 01 HOURS';
      case '15m': return 'T-MINUS 15 MINS';
      default: return type;
    }
  };

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Smart Notification Matrix</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Configure automated alert schedules for clinical appointments.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('generate')} className={`px-4 py-2 rounded-[2px] text-xs font-bold tracking-wider uppercase transition-colors border ${activeTab === 'generate' ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-400' : 'bg-[#0F1218] border-[#252A35] text-slate-500 hover:text-slate-300'}`}>
            GENERATE SCHEDULES
          </button>
          <button onClick={() => setActiveTab('manage')} className={`px-4 py-2 rounded-[2px] text-xs font-bold tracking-wider uppercase transition-colors border ${activeTab === 'manage' ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-400' : 'bg-[#0F1218] border-[#252A35] text-slate-500 hover:text-slate-300'}`}>
            ACTIVE ALERTS [{patientReminders.length}]
          </button>
        </div>
      </div>

      {activeTab === 'generate' && (
        <div className="grid md:grid-cols-[1fr_2fr] gap-4">
          <div className="bg-[#090D14] border border-[#252A35] rounded-[4px] p-4 flex flex-col h-fit gap-4">
            <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">TIME HORIZONS</span>
            <div className="space-y-2">
              {(['24h', '1h', '15m'] as const).map((type) => (
                <label key={type} className={`flex items-start gap-3 p-3 rounded-[2px] border cursor-pointer transition-colors ${selectedReminders.has(type) ? 'bg-cyan-950/20 border-cyan-600/40' : 'bg-[#0F1218] border-[#252A35] hover:border-[#2F3542]'}`}>
                  <input type="checkbox" checked={selectedReminders.has(type)} onChange={() => handleToggleReminder(type)} className="mt-0.5 accent-cyan-500" />
                  <div>
                    <div className={`text-[10px] font-bold tracking-wider ${selectedReminders.has(type) ? 'text-cyan-400' : 'text-slate-300'}`}>{getReminderTypeLabel(type)}</div>
                    <div className="text-[9px] text-slate-500 mt-1 uppercase">Automated alert sequence prior to event horizon.</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-[#090D14] border border-[#252A35] rounded-[4px] p-4 flex flex-col h-fit gap-4">
            <div className="flex items-center justify-between border-b border-[#252A35] pb-2">
              <span className="text-xs font-bold uppercase text-slate-400">UNSCHEDULED EVENTS [{upcomingAppointments.length}]</span>
              <button onClick={() => setSelectedAppointments(new Set())} disabled={selectedAppointments.size === 0} className="text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase disabled:opacity-50">
                CLEAR ALL
              </button>
            </div>
            
            {upcomingAppointments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">NO UNSCHEDULED EVENTS LOCATED IN MATRIX.</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                {upcomingAppointments.map((apt) => (
                  <label key={apt.id} className={`flex items-start gap-3 p-3 rounded-[2px] border cursor-pointer transition-colors ${selectedAppointments.has(apt.id) ? 'bg-cyan-950/20 border-cyan-600/40' : 'bg-[#0F1218] border-[#252A35] hover:border-[#2F3542]'}`}>
                    <input type="checkbox" checked={selectedAppointments.has(apt.id)} onChange={() => handleSelectAppointment(apt.id)} className="mt-1 accent-cyan-500" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className={`text-[11px] font-bold uppercase ${selectedAppointments.has(apt.id) ? 'text-cyan-400' : 'text-[#ECEEF2]'}`}>
                          {apt.doctorName} <span className="text-slate-500 mx-1">/</span> {apt.type}
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${apt.status === 'confirmed' ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-400' : 'bg-amber-950/40 border-amber-600/60 text-amber-400'}`}>
                          {apt.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 mt-2 uppercase">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(apt.date).toISOString().split('T')[0]} @ {apt.time}</span>
                        <span className="flex items-center gap-1">{apt.appointmentMode === 'telemedicine' ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />} {apt.appointmentMode === 'telemedicine' ? 'VIRTUAL' : 'IN-PERSON'}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            
            <button
              onClick={handleGenerateReminders}
              disabled={selectedAppointments.size === 0 || selectedReminders.size === 0}
              className="mt-2 w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-3 rounded-[2px] transition-colors uppercase tracking-wider text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:border-[#252A35] disabled:text-slate-500 disabled:hover:bg-[#151922]"
            >
              <Bell className="w-4 h-4" /> COMMIT SCHEDULE ({selectedAppointments.size})
            </button>
          </div>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="QUERY ALERT MATRIX..."
              className="w-full h-10 pl-8 pr-3 rounded-[2px] border border-[#252A35] bg-[#090D14] text-[#ECEEF2] text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {filteredPatientReminders.length === 0 ? (
            <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
              NO ACTIVE ALERTS LOCATED.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {Array.from(new Set(filteredPatientReminders.map(r => r.appointmentId))).map(aptId => {
                const reminders = filteredPatientReminders.filter(r => r.appointmentId === aptId);
                const apt = appointments.find(a => a.id === aptId);
                return (
                  <div key={aptId} className="bg-[#090D14] border border-[#252A35] rounded-[4px] overflow-hidden">
                    <div className="p-3 border-b border-[#252A35] bg-[#0F1218] flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-bold text-[#ECEEF2] uppercase">{apt?.doctorName || 'UNKNOWN'} / {apt?.type || 'EVENT'}</div>
                        <div className="text-[9px] text-slate-500 font-mono mt-1">
                          {apt ? `${new Date(apt.date).toISOString().split('T')[0]} @ ${apt.time}` : 'TBD'}
                        </div>
                      </div>
                      {apt?.appointmentMode && <span className="px-1.5 py-0.5 bg-[#151922] border border-[#2F3542] text-slate-300 text-[9px] font-bold uppercase rounded-[2px] whitespace-nowrap">{apt.appointmentMode === 'telemedicine' ? 'VIRTUAL' : 'ON-SITE'}</span>}
                    </div>
                    <div className="p-3 space-y-2">
                      {reminders.map(r => (
                        <div key={r.id} className="p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-[#ECEEF2]">{getReminderTypeLabel(r.reminderType)}</span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[8px] font-bold uppercase border ${getStatusStyle(r.status)}`}>
                                {getStatusIcon(r.status)} {r.status}
                              </span>
                            </div>
                            <div className="text-[9px] text-slate-500 uppercase">
                              VECTOR: {r.notificationMethod}
                              {r.sentAt && <span className="ml-2 font-mono">TX: {new Date(r.sentAt).toISOString().replace('T', ' ').slice(0, 16)}</span>}
                              {r.acknowledgedAt && <span className="ml-2 font-mono">ACK: {new Date(r.acknowledgedAt).toISOString().replace('T', ' ').slice(0, 16)}</span>}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            {r.status === 'failed' && <button onClick={() => handleResendReminder(r.id)} className="px-2 py-1 bg-[#151922] border border-[#2F3542] text-slate-300 hover:bg-slate-800 hover:text-white text-[9px] font-bold uppercase rounded-[2px] transition-colors">RETRANSMIT</button>}
                            {r.status === 'sent' && r.patientId === user?.id && <button onClick={() => handleAcknowledgeReminder(r.id)} className="px-2 py-1 bg-cyan-950/40 border border-cyan-600/60 text-cyan-400 hover:bg-cyan-900/60 text-[9px] font-bold uppercase rounded-[2px] transition-colors">ACKNOWLEDGE</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-cyan-950/10 border border-cyan-900/40 rounded-[4px] text-[10px] text-cyan-500/80 uppercase leading-relaxed flex gap-3">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-cyan-500" />
        <div>
          <span className="font-bold text-cyan-400 block mb-1">SYSTEM DIRECTIVE: AUTOMATED HORIZONS</span>
          • Alerts trigger at configured T-MINUS intervals automatically.<br/>
          • Multi-vector transmission supported (APP, EMAIL, SMS).<br/>
          • Manual ACKNOWLEDGE required to clear dashboard stack.<br/>
          • System monitors telemetry for failed transmissions to enable RETRANSMIT protocols.
        </div>
      </div>
    </div>
  );
};
