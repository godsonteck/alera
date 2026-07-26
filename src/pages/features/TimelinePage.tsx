import { useMemo, useState } from 'react';
import { Calendar, FlaskConical, ScanLine, Pill, Heart, Inbox, Clock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';

type EventType = 'appointment' | 'prescription' | 'lab_test' | 'imaging';

const iconMap: Record<EventType, React.ReactNode> = {
  appointment: <Heart className="w-3.5 h-3.5" />,
  prescription: <Pill className="w-3.5 h-3.5" />,
  lab_test: <FlaskConical className="w-3.5 h-3.5" />,
  imaging: <ScanLine className="w-3.5 h-3.5" />,
};

const colorMap: Record<EventType, string> = {
  appointment: 'text-cyan-400 bg-cyan-950 border-cyan-800',
  prescription: 'text-purple-400 bg-purple-950 border-purple-800',
  lab_test: 'text-emerald-400 bg-emerald-950 border-emerald-800',
  imaging: 'text-amber-400 bg-amber-950 border-amber-800',
};

const TimelinePage = () => {
  const { user } = useAuth();
  const { appointments, prescriptions, labTests, imagingScans } = useAppData();
  const [searchParams] = useSearchParams();
  const [selectedFilter, setSelectedFilter] = useState<EventType | 'all'>('all');
  const isSupportedRole = user?.role === 'patient' || user?.role === 'doctor';
  const focusedPatientId = searchParams.get('patient');

  const timelineEvents = useMemo(() => {
    const events: {
      id: string;
      type: EventType;
      title: string;
      description: string;
      date: string;
      time?: string;
      status: string;
    }[] = [];

    appointments.forEach(apt => {
      const matchesRole = isSupportedRole && (user.role === 'patient' ? apt.patientId === user.id : apt.doctorId === user.id);
      const matchesFocusedPatient = !focusedPatientId || apt.patientId === focusedPatientId;
      if (matchesRole && matchesFocusedPatient) {
        events.push({
          id: apt.id,
          type: 'appointment',
          title: `${apt.type} — ${user.role === 'patient' ? apt.doctorName : apt.patientName}`,
          description: `${apt.appointmentMode === 'telemedicine' ? 'Telemedicine' : 'In-Person'}`,
          date: apt.date,
          time: apt.time,
          status: apt.status,
        });
      }
    });

    prescriptions.forEach(rx => {
      const matchesRole = isSupportedRole && (user.role === 'patient' ? rx.patientId === user.id : rx.doctorId === user.id);
      const matchesFocusedPatient = !focusedPatientId || rx.patientId === focusedPatientId;
      if (matchesRole && matchesFocusedPatient) {
        events.push({
          id: rx.id,
          type: 'prescription',
          title: `Rx: ${rx.medications[0]?.name || 'Medication'}`,
          description: `${rx.medications[0]?.dosage || 'N/A'} — ${rx.status}`,
          date: rx.date,
          status: rx.status,
        });
      }
    });

    labTests.forEach(test => {
      const matchesRole = isSupportedRole && (user.role === 'patient' ? test.patientId === user.id : test.doctorId === user.id);
      const matchesFocusedPatient = !focusedPatientId || test.patientId === focusedPatientId;
      if (matchesRole && matchesFocusedPatient) {
        events.push({
          id: test.id,
          type: 'lab_test',
          title: `Assay: ${test.testName}`,
          description: `${test.status}${test.results ? ' — Results available' : ''}`,
          date: test.date,
          status: test.status,
        });
      }
    });

    imagingScans.forEach(scan => {
      const matchesRole = isSupportedRole && (user.role === 'patient' ? scan.patientId === user.id : scan.doctorId === user.id);
      const matchesFocusedPatient = !focusedPatientId || scan.patientId === focusedPatientId;
      if (matchesRole && matchesFocusedPatient) {
        events.push({
          id: scan.id,
          type: 'imaging',
          title: `DICOM: ${scan.scanType}${scan.bodyPart ? ` (${scan.bodyPart})` : ''}`,
          description: `${scan.status}${scan.results ? ' — Findings published' : ''}`,
          date: scan.date,
          status: scan.status,
        });
      }
    });

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments, focusedPatientId, imagingScans, isSupportedRole, labTests, prescriptions, user]);

  const filteredEvents = useMemo(() => {
    if (selectedFilter === 'all') return timelineEvents;
    return timelineEvents.filter(e => e.type === selectedFilter);
  }, [timelineEvents, selectedFilter]);

  if (!isSupportedRole) {
    return (
      <div className="p-8 bg-[#090D14] border border-[#252A35] rounded-[4px] text-center font-mono text-xs text-slate-500">
        Temporal clinical timeline is restricted to patient and clinician role nodes.
      </div>
    );
  }

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header Bar */}
      <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Temporal Clinical Continuum</span>
          <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-mono">
            {filteredEvents.length} EVENTS RECORDED
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {focusedPatientId && user?.role === 'doctor'
            ? 'Focused longitudinal history for selected patient node.'
            : 'Complete chronological medical event timeline across all clinical vectors.'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        {(['all', 'appointment', 'prescription', 'lab_test', 'imaging'] as const).map(filter => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`px-3 py-1 rounded-[2px] text-xs font-mono uppercase tracking-wider border transition-colors ${
              selectedFilter === filter
                ? 'bg-[#151922] border-cyan-500/60 text-cyan-300 font-semibold'
                : 'bg-[#0F1218] border-[#252A35] text-slate-400 hover:text-[#ECEEF2]'
            }`}
          >
            {filter === 'all' ? 'ALL VECTORS' : filter === 'lab_test' ? 'LAB ASSAYS' : filter.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Timeline Events */}
      {filteredEvents.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          No clinical events recorded in this temporal vector.
        </div>
      ) : (
        <div className="relative">
          {/* Vertical Connector Line */}
          <div className="absolute left-[15px] top-4 bottom-4 w-px bg-[#252A35]" />

          <div className="space-y-1.5">
            {filteredEvents.map((event) => (
              <div key={event.id} className="relative flex items-start gap-3 pl-1">
                {/* Timeline Dot */}
                <div className={`relative z-10 w-7 h-7 rounded-[2px] flex items-center justify-center border ${colorMap[event.type]}`}>
                  {iconMap[event.type]}
                </div>

                {/* Event Card */}
                <div className="flex-1 p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] hover:border-cyan-500/30 transition-colors text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-[#ECEEF2]">{event.title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{event.description}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${
                      event.status === 'completed' || event.status === 'active' || event.status === 'dispensed'
                        ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                        : event.status === 'cancelled'
                        ? 'bg-red-950/50 border-red-600/60 text-red-400'
                        : 'bg-[#151922] border-[#2F3542] text-slate-400'
                    }`}>
                      {event.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {event.time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {event.time}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelinePage;
