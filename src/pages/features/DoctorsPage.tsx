import { useState, useMemo } from 'react';
import { Heart, Search, Star, Clock, Inbox, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useChat } from '@/contexts/useChat';
import { getBookableDoctors } from '@/lib/providerDirectory';

const DoctorsPage = () => {
  const { getUsers, user } = useAuth();
  const { startVideoCall } = useChat();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const doctors = useMemo(() => getBookableDoctors(getUsers()), [getUsers]);

  const specialties = useMemo(() => ['all', ...new Set(doctors.map(d => d.specialty))], [doctors]);

  const filtered = useMemo(() => {
    return doctors.filter(doctor => {
      const matchesSearch = doctor.name.toLowerCase().includes(search.toLowerCase()) ||
                           doctor.specialty.toLowerCase().includes(search.toLowerCase());
      const matchesSpecialty = selectedSpecialty === 'all' || doctor.specialty === selectedSpecialty;
      return matchesSearch && matchesSpecialty;
    });
  }, [doctors, search, selectedSpecialty]);

  return (
    <div className="space-y-4 text-[var(--text-high)]">
      {/* Header Bar */}
      <div className="p-4 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-[16px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-[var(--text-high)]">Doctor directory</span>
              <span className="text-[10px] bg-[var(--surface-elevated)] text-[var(--text-medium)] border border-[var(--border)] px-1.5 py-0.2 rounded font-mono">
                {filtered.length} clinicians found
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-medium)] mt-0.5">
              Search doctors by name or specialty, then request a consult in a few clicks.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-medium)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search doctor by name or specialty..."
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[var(--brand-primary)] rounded-[12px] pl-9 pr-3 py-2 text-xs text-[var(--text-high)] placeholder:text-[var(--text-medium)] focus:outline-none"
          />
        </div>

        {/* Specialty Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {specialties.map((spec) => (
            <button
              key={spec}
              onClick={() => setSelectedSpecialty(spec)}
              className={`px-3 py-1 rounded-[12px] text-xs font-medium tracking-wide border transition-colors ${
                selectedSpecialty === spec
                  ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
                  : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-medium)] hover:text-[var(--text-high)]'
              }`}
            >
              {spec === 'all' ? 'All specialties' : spec}
            </button>
          ))}
        </div>
      </div>

      {/* Doctors Grid */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center bg-[var(--surface-secondary)] border border-[var(--border)] rounded-[16px] text-xs text-[var(--text-medium)]">
          No clinicians matched the search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((doctor) => (
            <div
              key={doctor.id}
              className="p-3 bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[var(--brand-primary)] rounded-[16px] space-y-2.5 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-[12px] bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--brand-primary)] flex items-center justify-center">
                    <Heart className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[var(--text-high)]">{doctor.name}</div>
                    <div className="text-[10px] text-[var(--text-medium)]">{doctor.specialty}</div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${
                  doctor.status === 'available'
                    ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                    : doctor.status === 'busy'
                    ? 'bg-amber-950/50 border-amber-600/60 text-amber-300'
                    : 'bg-[#151922] border-[#2F3542] text-slate-500'
                }`}>
                  {doctor.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-[var(--surface-elevated)] p-2 rounded-[12px] text-center text-[10px] border border-[var(--border)]">
                <div>
                  <span className="text-[var(--text-medium)] block">EXP</span>
                  <span className="font-bold text-[var(--text-high)]">{doctor.experience}yr</span>
                </div>
                <div>
                  <span className="text-[var(--text-medium)] block">RATING</span>
                  <span className="font-bold text-[var(--text-high)]">{doctor.rating}</span>
                </div>
                <div>
                  <span className="text-[var(--text-medium)] block">FEE</span>
                  <span className="font-bold text-[var(--text-high)]">${doctor.consultationFee}</span>
                </div>
              </div>

              {doctor.availableHours.length > 0 && (
                <div className="text-[10px] text-slate-500 space-y-0.5">
                  {doctor.availableHours.slice(0, 2).map((hours, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{hours.dayOfWeek}: {hours.startTime}–{hours.endTime}</span>
                    </div>
                  ))}
                  {doctor.availableHours.length > 2 && (
                    <span className="text-slate-600">+{doctor.availableHours.length - 2} more</span>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => startVideoCall(doctor.id, doctor.name, 'doctor')}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white font-bold py-1.5 rounded-lg transition-colors text-xs shadow-xs"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Call Doctor</span>
                </button>
                <button
                  onClick={() => navigate(`/dashboard/appointments?doctor=${doctor.id}`)}
                  className="flex-1 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-high)] font-semibold py-1.5 rounded-lg transition-colors text-xs text-center"
                >
                  Book Visit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DoctorsPage;
