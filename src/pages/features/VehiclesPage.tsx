import { useState, useMemo } from 'react';
import { Ambulance, Wrench, Users, Fuel, AlertCircle, CheckCircle, Download, Inbox, Activity, Clock, Zap, Plus, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { toast } from '@/components/ui/use-toast';
import type { AmbulanceVehicle } from '@/data/mockData';

const VehiclesPage = () => {
  const { user } = useAuth();
  const { ambulances, addAmbulance, updateAmbulance, deleteAmbulance } = useAppData();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'callSign' | 'fuel' | 'maintenance'>('callSign');
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    callSign: '', plateNumber: '', type: 'Type-B' as AmbulanceVehicle['type'], fuel: 100, crew: '', equipment: '', nextMaintenanceDate: '',
  });

  const isAmbulance = user?.role === 'ambulance';

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = ambulances.filter((v) => {
      const matchStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchSearch = !q || v.callSign.toLowerCase().includes(q) || v.plateNumber.toLowerCase().includes(q) || v.crew.some(m => m.name.toLowerCase().includes(q)) || v.equipment.some(e => e.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
    return rows.sort((l, r) => {
      if (sortBy === 'fuel') return r.fuel - l.fuel;
      if (sortBy === 'maintenance') return (l.nextMaintenanceDate ? new Date(l.nextMaintenanceDate).getTime() : Number.MAX_SAFE_INTEGER) - (r.nextMaintenanceDate ? new Date(r.nextMaintenanceDate).getTime() : Number.MAX_SAFE_INTEGER);
      return l.callSign.localeCompare(r.callSign);
    });
  }, [ambulances, searchQuery, sortBy, statusFilter]);

  const stats = useMemo(() => {
    return {
      totalVehicles: ambulances.length,
      available: ambulances.filter(v => v.status === 'available').length,
      dispatched: ambulances.filter(v => ['dispatched', 'in-transit', 'on-scene'].includes(v.status)).length,
      maintenance: ambulances.filter(v => v.status === 'maintenance').length,
      averageFuel: ambulances.length > 0 ? (ambulances.reduce((sum, v) => sum + v.fuel, 0) / ambulances.length).toFixed(0) : '0',
    };
  }, [ambulances]);

  const handleUpdateStatus = (vehicleId: string, newStatus: AmbulanceVehicle['status']) => {
    updateAmbulance(vehicleId, prev => ({ ...prev, status: newStatus }));
    toast({ title: 'Vehicle status updated', description: `Status changed to ${newStatus}.` });
  };

  const handleRefuel = (vehicleId: string) => {
    updateAmbulance(vehicleId, prev => ({ ...prev, fuel: 100 }));
    toast({ title: 'Vehicle refueled', description: 'Fuel index reset to 100%.' });
  };

  const handleCreateVehicle = () => {
    if (!newVehicle.callSign.trim() || !newVehicle.plateNumber.trim()) { toast({ title: 'Validation fault', description: 'Call sign and plate number required.', variant: 'destructive' }); return; }
    addAmbulance({
      id: `amb-${crypto.randomUUID()}`, callSign: newVehicle.callSign.trim(), plateNumber: newVehicle.plateNumber.trim(),
      type: newVehicle.type, status: 'available', fuel: Math.max(0, Math.min(100, newVehicle.fuel)),
      crew: newVehicle.crew.split(',').map(m => m.trim()).filter(Boolean).map((m, i) => ({ name: m, role: i === 0 ? 'driver' : 'paramedic' })),
      equipment: newVehicle.equipment.split(',').map(e => e.trim()).filter(Boolean),
      nextMaintenanceDate: newVehicle.nextMaintenanceDate || undefined, lastMaintenanceDate: new Date().toISOString(),
    });
    setNewVehicle({ callSign: '', plateNumber: '', type: 'Type-B', fuel: 100, crew: '', equipment: '', nextMaintenanceDate: '' });
    setShowCreate(false);
    toast({ title: 'Vehicle registered', description: 'Fleet matrix updated.' });
  };

  const handleExportFleet = () => {
    if (filtered.length === 0) { toast({ title: 'Export fault', description: 'No fleet data to export.', variant: 'destructive' }); return; }
    const csv = [['Call Sign', 'Plate Number', 'Type', 'Status', 'Fuel', 'Crew', 'Equipment', 'Next Maintenance'].join(','), ...filtered.map(v => [v.callSign, v.plateNumber, v.type, v.status, String(v.fuel), v.crew.map(m => `${m.name} (${m.role})`).join('; '), v.equipment.join('; '), v.nextMaintenanceDate ?? ''].map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `fleet-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
    toast({ title: 'Export secure', description: 'Fleet matrix saved as CSV.' });
  };

  if (!isAmbulance) {
    return (
      <div className="p-8 bg-[#090D14] border border-[#252A35] rounded-[4px] text-center font-mono text-xs text-slate-500 flex flex-col items-center gap-2">
        <AlertCircle className="w-6 h-6 text-red-500" />
        <span>RESTRICTED ACCESS: AMBULANCE COMMAND ONLY</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Fleet Management Matrix</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Global oversight of ambulance fleet telemetry and dispatch readiness.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors uppercase tracking-wider">
            {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showCreate ? 'CANCEL' : 'ADD UNIT'}</span>
          </button>
          <button onClick={handleExportFleet} className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-[#2F3542] text-slate-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors uppercase tracking-wider">
            <Download className="w-4 h-4" /> EXPORT
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">Register Fleet Unit</span>
          
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Call Sign *</label>
              <input value={newVehicle.callSign} onChange={(e) => setNewVehicle(cur => ({...cur, callSign: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-bold" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Plate Number *</label>
              <input value={newVehicle.plateNumber} onChange={(e) => setNewVehicle(cur => ({...cur, plateNumber: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Vehicle Classification</label>
              <select value={newVehicle.type} onChange={(e) => setNewVehicle(cur => ({...cur, type: e.target.value as AmbulanceVehicle['type']}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] uppercase">
                <option value="Type-A">TYPE-A</option><option value="Type-B">TYPE-B</option><option value="Type-C">TYPE-C</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Fuel Index (%)</label>
              <input type="number" min="0" max="100" value={newVehicle.fuel} onChange={(e) => setNewVehicle(cur => ({...cur, fuel: Number(e.target.value)}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Assigned Crew</label>
              <input value={newVehicle.crew} onChange={(e) => setNewVehicle(cur => ({...cur, crew: e.target.value}))} placeholder="Comma separated..." className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Onboard Equipment</label>
              <input value={newVehicle.equipment} onChange={(e) => setNewVehicle(cur => ({...cur, equipment: e.target.value}))} placeholder="Comma separated..." className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Next Maintenance Schedule</label>
              <input type="date" value={newVehicle.nextMaintenanceDate} onChange={(e) => setNewVehicle(cur => ({...cur, nextMaintenanceDate: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
          </div>
          
          <button onClick={handleCreateVehicle} className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs">
            COMMIT VEHICLE DATA
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-center flex flex-col justify-center">
          <div className="text-[9px] text-slate-500 uppercase font-bold">TOTAL UNITS</div>
          <div className="text-xl font-bold font-mono text-[#ECEEF2] mt-0.5">{stats.totalVehicles}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-emerald-600/40 rounded-[2px] text-center flex flex-col justify-center">
          <div className="text-[9px] text-emerald-500 uppercase font-bold flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" /> STANDBY</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{stats.available}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-cyan-600/40 rounded-[2px] text-center flex flex-col justify-center">
          <div className="text-[9px] text-cyan-500 uppercase font-bold flex items-center justify-center gap-1"><Activity className="w-3 h-3" /> ACTIVE</div>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">{stats.dispatched}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-red-600/40 rounded-[2px] text-center flex flex-col justify-center">
          <div className="text-[9px] text-red-500 uppercase font-bold flex items-center justify-center gap-1"><Wrench className="w-3 h-3" /> OFFLINE</div>
          <div className="text-xl font-bold font-mono text-red-400 mt-0.5">{stats.maintenance}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-center flex flex-col justify-center">
          <div className="text-[9px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1"><Fuel className="w-3 h-3" /> MEAN FUEL</div>
          <div className="text-xl font-bold font-mono text-[#ECEEF2] mt-0.5">{stats.averageFuel}%</div>
        </div>
      </div>

      {ambulances.some(v => v.fuel < 25) && (
        <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-[2px] text-[10px] text-red-500/80 uppercase leading-relaxed flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-1">CRITICAL FUEL ALERT</span>
            {ambulances.filter(v => v.fuel < 25).length} UNIT(S) REPORTING FUEL INDEX BELOW 25%. INITIATE REFUEL PROTOCOL.
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="QUERY FLEET..."
            className="w-full h-8 pl-8 pr-3 rounded-[2px] border border-[#252A35] bg-[#090D14] text-[#ECEEF2] text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'callSign' | 'fuel' | 'maintenance')} className="h-8 px-2 rounded-[2px] border border-[#252A35] bg-[#090D14] text-xs text-[#ECEEF2] uppercase font-bold tracking-wider">
          <option value="callSign">SORT: ID</option><option value="fuel">SORT: FUEL</option><option value="maintenance">SORT: MAINTENANCE</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 px-2 rounded-[2px] border border-[#252A35] bg-[#090D14] text-xs text-[#ECEEF2] uppercase font-bold tracking-wider">
          <option value="all">ALL STATUS</option><option value="available">STANDBY</option><option value="in-transit">IN TRANSIT</option><option value="on-scene">ON SCENE</option><option value="returning">RETURNING</option><option value="maintenance">MAINTENANCE</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          NO FLEET DATA LOCATED
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((vehicle) => {
            const isSelected = selectedVehicle === vehicle.id;
            return (
              <div
                key={vehicle.id}
                onClick={() => setSelectedVehicle(isSelected ? null : vehicle.id)}
                className={`p-4 bg-[#090D14] border rounded-[2px] cursor-pointer transition-colors ${isSelected ? 'border-cyan-500/60' : 'border-[#252A35]'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 border rounded-[2px] ${
                      vehicle.status === 'available' ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-400'
                      : vehicle.status === 'maintenance' ? 'bg-red-950/40 border-red-600/60 text-red-400'
                      : 'bg-cyan-950/40 border-cyan-600/60 text-cyan-400'
                    }`}>
                      <Ambulance className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-[#ECEEF2]">{vehicle.callSign}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">PLATE: {vehicle.plateNumber}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${
                      vehicle.status === 'available' ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                      : vehicle.status === 'maintenance' ? 'bg-red-950/50 border-red-600/60 text-red-400'
                      : 'bg-cyan-950/50 border-cyan-600/60 text-cyan-300'
                    }`}>
                      {vehicle.status}
                    </span>
                    <div className="text-[10px] text-slate-500 font-mono mt-1 uppercase">{vehicle.type}</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1"><Fuel className="w-3 h-3" /> FUEL</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-[#0F1218] rounded-full overflow-hidden">
                        <div className={`h-full ${vehicle.fuel > 50 ? 'bg-emerald-500' : vehicle.fuel > 25 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${vehicle.fuel}%` }} />
                      </div>
                      <span className="font-mono text-[#ECEEF2] text-[10px]">{vehicle.fuel}%</span>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-[#252A35] space-y-3">
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><Users className="w-3 h-3" /> CREW</span>
                      {vehicle.crew.length > 0 ? vehicle.crew.map((m, i) => (
                        <div key={i} className="text-[10px] text-[#ECEEF2]">{m.name} <span className="text-slate-500 uppercase">[{m.role}]</span></div>
                      )) : <div className="text-[10px] text-slate-600">UNASSIGNED</div>}
                    </div>

                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><Wrench className="w-3 h-3" /> EQUIPMENT</span>
                      <div className="flex flex-wrap gap-1">
                        {vehicle.equipment.length > 0 ? vehicle.equipment.map((eq, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-[#0F1218] border border-[#252A35] text-slate-300 text-[9px] uppercase rounded-[2px] flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> {eq}</span>
                        )) : <div className="text-[10px] text-slate-600">NONE</div>}
                      </div>
                    </div>

                    {vehicle.nextMaintenanceDate && (
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><Clock className="w-3 h-3" /> MAINTENANCE SCHEDULE</span>
                        <div className="text-[10px] font-mono text-cyan-400">{vehicle.nextMaintenanceDate}</div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      {vehicle.status === 'available' && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(vehicle.id, 'maintenance'); }} className="px-2 py-1 bg-amber-950/40 border border-amber-600/60 text-amber-400 text-[9px] font-bold uppercase rounded-[2px] flex-1">OFFLINE</button>
                          {vehicle.fuel < 80 && <button onClick={(e) => { e.stopPropagation(); handleRefuel(vehicle.id); }} className="px-2 py-1 bg-cyan-950/40 border border-cyan-600/60 text-cyan-400 text-[9px] font-bold uppercase rounded-[2px] flex-1">REFUEL</button>}
                        </>
                      )}
                      {vehicle.status === 'maintenance' && (
                        <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(vehicle.id, 'available'); }} className="px-2 py-1 bg-emerald-950/40 border border-emerald-600/60 text-emerald-400 text-[9px] font-bold uppercase rounded-[2px] flex-1">ONLINE</button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); deleteAmbulance(vehicle.id); }} className="px-2 py-1 bg-red-950/40 border border-red-600/60 text-red-400 text-[9px] font-bold uppercase rounded-[2px] flex-none"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VehiclesPage;
