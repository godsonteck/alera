import { useState, useMemo } from 'react';
import { Heart, Search, Star, Clock, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { getBookableDoctors } from '@/lib/providerDirectory';

const DoctorsPage = () => {
  const { getUsers, user } = useAuth();
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
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header Bar */}
      <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Clinical Specialist Registry</span>
              <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-mono">
                {filtered.length} NODES INDEXED
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Verified clinician directory with real-time availability status, specialty mappings, and consultation scheduling.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clinician by name or specialty..."
            className="w-full bg-[#0F1218] border border-[#252A35] focus:border-cyan-500 rounded-[2px] pl-9 pr-3 py-2 text-xs text-[#ECEEF2] placeholder:text-slate-600 focus:outline-none"
          />
        </div>

        {/* Specialty Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {specialties.map((spec) => (
            <button
              key={spec}
              onClick={() => setSelectedSpecialty(spec)}
              className={`px-3 py-1 rounded-[2px] text-xs font-mono uppercase tracking-wider border transition-colors ${
                selectedSpecialty === spec
                  ? 'bg-[#151922] border-cyan-500/60 text-cyan-300 font-semibold'
                  : 'bg-[#0F1218] border-[#252A35] text-slate-400 hover:text-[#ECEEF2]'
              }`}
            >
              {spec === 'all' ? 'ALL SPECIALTIES' : spec}
            </button>
          ))}
        </div>
      </div>

      {/* Doctors Grid */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          No clinician nodes matched the search parameters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((doctor) => (
            <div
              key={doctor.id}
              className="p-3 bg-[#090D14] border border-[#252A35] hover:border-cyan-500/50 rounded-[2px] space-y-2.5 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-[2px] bg-[#151922] border border-[#2F3542] text-cyan-400 flex items-center justify-center">
                    <Heart className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#ECEEF2]">{doctor.name}</div>
                    <div className="text-[10px] text-cyan-400">{doctor.specialty}</div>
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

              <div className="grid grid-cols-3 gap-1 bg-[#0F1218] p-2 rounded-[2px] text-center text-[10px] border border-[#252A35]">
                <div>
                  <span className="text-slate-500 block">EXP</span>
                  <span className="font-bold text-[#ECEEF2]">{doctor.experience}yr</span>
                </div>
                <div>
                  <span className="text-slate-500 block">RATING</span>
                  <span className="font-bold text-cyan-400">{doctor.rating}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">FEE</span>
                  <span className="font-bold text-emerald-400">${doctor.consultationFee}</span>
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

              <button
                onClick={() => navigate(`/dashboard/appointments?doctor=${doctor.id}`)}
                disabled={user?.role !== 'patient'}
                className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-1.5 rounded-[2px] transition-colors uppercase tracking-wider text-[10px] disabled:opacity-30"
              >
                {user?.role === 'patient' ? 'REQUISITION CONSULT' : 'VIEW CLINICIAN'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DoctorsPage;
