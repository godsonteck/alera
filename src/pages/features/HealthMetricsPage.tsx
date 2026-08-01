import { useState, useMemo, useEffect } from 'react';
import { Activity, Heart, Thermometer, Wind, Download, Droplets, Plus, AlertCircle, CheckCircle, Inbox, LineChart, Scale, CalendarClock, NotebookPen } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { useNotifications } from '@/contexts/useNotifications';
import { toast } from '@/components/ui/use-toast';
import type { VitalSigns } from '@/data/mockData';

const vitalMetrics = [
  { key: 'heartRate', label: 'Heart Rate', unit: 'bpm', icon: Heart, normalRange: [60, 100] },
  { key: 'systolicBP', label: 'Systolic BP', unit: 'mm Hg', icon: Droplets, normalRange: [90, 120] },
  { key: 'diastolicBP', label: 'Diastolic BP', unit: 'mm Hg', icon: Droplets, normalRange: [60, 80] },
  { key: 'temperature', label: 'Temperature', unit: '°C', icon: Thermometer, normalRange: [36.5, 37.5] },
  { key: 'oxygenLevel', label: 'Oxygen Level', unit: '%', icon: Wind, normalRange: [95, 100] },
  { key: 'weight', label: 'Weight', unit: 'kg', icon: Activity, normalRange: [0, 200] },
];

const HealthMetricsPage = () => {
  const { user } = useAuth();
  const { vitalSigns, addVitalSigns } = useAppData();
  const { addNotification } = useNotifications();
  const [showForm, setShowForm] = useState(false);
  const [criticalAlerts, setCriticalAlerts] = useState<Array<{label: string; value: number; unit: string; severity: string}>>([]);
  const [formData, setFormData] = useState({
    heartRate: '', systolicBP: '', diastolicBP: '', temperature: '', oxygenLevel: '', weight: '', notes: '',
  });

  const isPatient = user?.role === 'patient';
  const userVitals = useMemo(() => (isPatient ? vitalSigns.filter((vital) => vital.patientId === user?.id) : []), [isPatient, user?.id, vitalSigns]);
  const sortedVitals = useMemo(() => [...userVitals].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [userVitals]);
  const latestVitals = sortedVitals[0] ?? null;

  const getStatus = (value: number, range: [number, number]) => {
    if (value >= range[0] && value <= range[1]) return 'normal';
    if (Math.abs(value - range[0]) <= 10 || Math.abs(value - range[1]) <= 10) return 'warning';
    return 'critical';
  };

  const insights = useMemo(() => {
    if (!latestVitals) return null;
    const abnormalMetrics = vitalMetrics
      .map((metric) => {
        const rawValue = latestVitals[metric.key as keyof VitalSigns];
        if (typeof rawValue !== 'number') return null;
        return { key: metric.key, label: metric.label, status: getStatus(rawValue, metric.normalRange as [number, number]), value: rawValue, unit: metric.unit };
      })
      .filter((m): m is { key: string; label: string; status: string; value: number; unit: string } => Boolean(m))
      .filter((m) => m.status !== 'normal');
    
    const averageHeartRate = sortedVitals.length > 0 ? sortedVitals.reduce((sum, v) => sum + v.heartRate, 0) / sortedVitals.length : 0;
    const averageOxygenLevel = sortedVitals.length > 0 ? sortedVitals.reduce((sum, v) => sum + v.oxygenLevel, 0) / sortedVitals.length : 0;
    const bmi = latestVitals.weight > 0 ? latestVitals.weight / (1.7 * 1.7) : null;

    return { abnormalMetrics, averageHeartRate, averageOxygenLevel, bmi, latestNote: sortedVitals.find((v) => v.notes?.trim())?.notes?.trim() ?? null };
  }, [latestVitals, sortedVitals]);

  const handleAddVitals = () => {
    if (!formData.heartRate || !formData.systolicBP || !formData.diastolicBP || !formData.temperature || !formData.oxygenLevel || !formData.weight) {
      toast({ title: 'Check your entries', description: 'All health metrics are required.', variant: 'destructive' }); return;
    }

    const hr = Number(formData.heartRate);
    const sbp = Number(formData.systolicBP);
    const dbp = Number(formData.diastolicBP);
    const temp = Number(formData.temperature);
    const oxy = Number(formData.oxygenLevel);
    const w = Number(formData.weight);

    if ([hr, sbp, dbp, temp, oxy, w].some((v) => Number.isNaN(v) || v <= 0)) {
      toast({ title: 'Check your entries', description: 'Numeric values must be greater than zero.', variant: 'destructive' }); return;
    }
    if (dbp >= sbp) {
      toast({ title: 'Check your entries', description: 'Diastolic blood pressure cannot exceed systolic blood pressure.', variant: 'destructive' }); return;
    }

    const alerts = [];
    if (sbp > 180 || dbp > 120) alerts.push({ label: 'Blood Pressure', value: sbp, unit: 'mm Hg', severity: 'critical' });
    if (oxy < 90) alerts.push({ label: 'Oxygen Level', value: oxy, unit: '%', severity: 'critical' });
    if (hr < 40 || hr > 140) alerts.push({ label: 'Heart Rate', value: hr, unit: 'bpm', severity: 'critical' });
    if (temp < 35.5 || temp > 40) alerts.push({ label: 'Temperature', value: temp, unit: '°C', severity: 'critical' });

    if (alerts.length > 0) {
      setCriticalAlerts(alerts);
      addNotification({
        title: 'Important health readings',
        message: `Anomalies found in: ${alerts.map(a => a.label).join(', ')}.`,
        type: 'alert', priority: 'critical', audience: 'personal',
      });
    } else {
      setCriticalAlerts([]);
    }

    addVitalSigns({ id: `vital-${Date.now()}`, patientId: user?.id || '', timestamp: new Date().toISOString(), heartRate: hr, systolicBP: sbp, diastolicBP: dbp, temperature: temp, oxygenLevel: oxy, weight: w, notes: formData.notes.trim() || undefined });
    setFormData({ heartRate: '', systolicBP: '', diastolicBP: '', temperature: '', oxygenLevel: '', weight: '', notes: '' });
    setShowForm(false);
    toast({ title: 'Vitals logged', description: 'Health metrics saved.' });
  };

  const handleExportVitals = () => {
    if (sortedVitals.length === 0) { toast({ title: 'Nothing to export', description: 'No health metrics are available.', variant: 'destructive' }); return; }
    const csv = [['Timestamp', 'Heart Rate', 'Systolic BP', 'Diastolic BP', 'Temperature', 'Oxygen Level', 'Weight', 'Notes'].join(','), ...sortedVitals.map(v => [v.timestamp, String(v.heartRate), String(v.systolicBP), String(v.diastolicBP), String(v.temperature), String(v.oxygenLevel), String(v.weight), v.notes ?? ''].map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `vitals-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
    toast({ title: 'Export ready', description: 'Health metrics saved as CSV.' });
  };

  if (!isPatient) {
    return (
      <div className="p-8 bg-[#090D14] border border-[#252A35] rounded-[4px] text-center font-mono text-xs text-slate-500">
        A patient profile is required to view health metrics.
      </div>
    );
  }

  return (
    <div className="alera-feature space-y-4 text-slate-700">
      {criticalAlerts.length > 0 && (
        <div className="p-3 bg-red-950/40 border border-red-600/60 rounded-[2px] text-[10px] text-red-300 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-red-400 uppercase tracking-wider block mb-1">CRITICAL ANOMALIES DETECTED</div>
            <ul className="list-disc pl-4 space-y-0.5 text-red-300/80 mb-2">
              {criticalAlerts.map((a, i) => <li key={i}>{a.label}: {a.value}{a.unit}</li>)}
            </ul>
            <div className="font-bold">IMMEDIATE MEDICAL INTERVENTION RECOMMENDED.</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-lg font-bold text-[#0b3d62]">Health metrics</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Continuous tracking of patient vital signs and health indices.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors uppercase tracking-wider">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showForm ? 'CANCEL' : 'LOG VITALS'}</span>
          </button>
          <button onClick={handleExportVitals} className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-[#2F3542] text-slate-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors uppercase tracking-wider">
            <Download className="w-4 h-4" /> EXPORT
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <span className="text-base font-semibold text-[#0b3d62] block border-b border-[#252A35] pb-2">Log vitals</span>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Heart Rate (bpm)</label>
              <input type="number" value={formData.heartRate} onChange={e => setFormData(cur => ({...cur, heartRate: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Systolic BP</label>
              <input type="number" value={formData.systolicBP} onChange={e => setFormData(cur => ({...cur, systolicBP: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Diastolic BP</label>
              <input type="number" value={formData.diastolicBP} onChange={e => setFormData(cur => ({...cur, diastolicBP: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Temperature (°C)</label>
              <input type="number" step="0.1" value={formData.temperature} onChange={e => setFormData(cur => ({...cur, temperature: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Oxygen Level (%)</label>
              <input type="number" value={formData.oxygenLevel} onChange={e => setFormData(cur => ({...cur, oxygenLevel: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Weight (kg)</label>
              <input type="number" step="0.1" value={formData.weight} onChange={e => setFormData(cur => ({...cur, weight: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Clinical Notes</label>
              <input value={formData.notes} onChange={e => setFormData(cur => ({...cur, notes: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
          </div>
          
          <button onClick={handleAddVitals} className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs">
            Log vitals
          </button>
        </div>
      )}

      {latestVitals ? (
        <>
          {insights && (
            <div className="grid md:grid-cols-3 gap-2">
              <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px]">
                <div className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1 mb-1"><CalendarClock className="w-3 h-3" /> LAST SYNC</div>
                <div className="font-mono text-cyan-400 text-xs">{new Date(latestVitals.timestamp).toISOString().replace('T', ' ').slice(0, 19)}</div>
                <div className="text-[9px] text-slate-500 uppercase mt-1">{insights.abnormalMetrics.length === 0 ? 'ALL METRICS NOMINAL' : `${insights.abnormalMetrics.length} ANOMALIES DETECTED`}</div>
              </div>
              <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px]">
                <div className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1 mb-1"><Heart className="w-3 h-3" /> GLOBAL MEANS</div>
                <div className="flex justify-between text-xs text-[#ECEEF2] font-mono mt-0.5"><span className="text-slate-400">HR:</span> {insights.averageHeartRate.toFixed(0)} BPM</div>
                <div className="flex justify-between text-xs text-[#ECEEF2] font-mono mt-0.5"><span className="text-slate-400">O2:</span> {insights.averageOxygenLevel.toFixed(0)}%</div>
              </div>
              <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px]">
                <div className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1 mb-1"><Scale className="w-3 h-3" /> INDICES</div>
                <div className="flex justify-between text-xs text-[#ECEEF2] font-mono mt-0.5"><span className="text-slate-400">ENTRIES:</span> {sortedVitals.length}</div>
                <div className="flex justify-between text-xs text-[#ECEEF2] font-mono mt-0.5"><span className="text-slate-400">EST BMI:</span> {insights.bmi ? insights.bmi.toFixed(1) : 'N/A'}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { key: 'heartRate', label: 'HR', value: latestVitals.heartRate, range: [60, 100] as [number, number], icon: Heart, unit: 'BPM' },
              { key: 'systolicBP', label: 'SYS', value: latestVitals.systolicBP, range: [90, 120] as [number, number], icon: Droplets, unit: 'MMHG' },
              { key: 'diastolicBP', label: 'DIA', value: latestVitals.diastolicBP, range: [60, 80] as [number, number], icon: Droplets, unit: 'MMHG' },
              { key: 'temperature', label: 'TEMP', value: latestVitals.temperature, range: [36.5, 37.5] as [number, number], icon: Thermometer, unit: '°C' },
              { key: 'oxygenLevel', label: 'O2', value: latestVitals.oxygenLevel, range: [95, 100] as [number, number], icon: Wind, unit: '%' },
              { key: 'weight', label: 'WGT', value: latestVitals.weight, range: [0, 200] as [number, number], icon: Activity, unit: 'KG' },
            ].map((metric) => {
              const status = getStatus(metric.value, metric.range);
              const Icon = metric.icon;
              return (
                <div key={metric.key} className={`p-3 rounded-[2px] border flex flex-col items-center justify-center text-center ${status === 'normal' ? 'bg-emerald-950/20 border-emerald-900/40' : status === 'warning' ? 'bg-amber-950/20 border-amber-900/40' : 'bg-red-950/20 border-red-900/40'}`}>
                  <div className={`text-[9px] font-bold uppercase mb-1 flex items-center gap-1 tracking-wider ${status === 'normal' ? 'text-emerald-500' : status === 'warning' ? 'text-amber-500' : 'text-red-500'}`}>
                    <Icon className="w-3 h-3" /> {metric.label}
                  </div>
                  <div className={`text-xl font-bold font-mono ${status === 'normal' ? 'text-emerald-400' : status === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>
                    {metric.value.toFixed(metric.key === 'temperature' ? 1 : 0)}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 uppercase">{metric.unit}</div>
                </div>
              );
            })}
          </div>

          <div className="bg-[#090D14] border border-[#252A35] rounded-[4px] overflow-hidden">
            <div className="p-3 border-b border-[#252A35] bg-[#0F1218] flex items-center gap-2">
              <LineChart className="w-4 h-4 text-cyan-400" />
              <span className="text-base font-bold text-[#0b3d62]">Vital history</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#252A35] bg-[#090D14]">
                    <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">TIMESTAMP</th>
                    <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-center">HR</th>
                    <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-center">BP</th>
                    <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-center">TEMP</th>
                    <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-center">O2</th>
                    <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-center">WGT</th>
                    <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-right">STAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252A35]">
                  {sortedVitals.map((vital) => {
                    const hrStatus = getStatus(vital.heartRate, [60, 100]);
                    const bpStatus = getStatus(vital.systolicBP, [90, 120]);
                    const tempStatus = getStatus(vital.temperature, [36.5, 37.5]);
                    const o2Status = getStatus(vital.oxygenLevel, [95, 100]);
                    const isNormal = hrStatus === 'normal' && bpStatus === 'normal' && tempStatus === 'normal' && o2Status === 'normal';

                    return (
                      <tr key={vital.id} className="hover:bg-[#0F1218] transition-colors">
                        <td className="px-3 py-2 font-mono text-slate-400 text-[10px]">{new Date(vital.timestamp).toISOString().replace('T', ' ').slice(0, 16)}</td>
                        <td className="px-3 py-2 text-center font-mono text-[#ECEEF2]">{vital.heartRate}</td>
                        <td className="px-3 py-2 text-center font-mono text-[#ECEEF2]">{vital.systolicBP}/{vital.diastolicBP}</td>
                        <td className="px-3 py-2 text-center font-mono text-[#ECEEF2]">{vital.temperature.toFixed(1)}</td>
                        <td className="px-3 py-2 text-center font-mono text-[#ECEEF2]">{vital.oxygenLevel}%</td>
                        <td className="px-3 py-2 text-center font-mono text-[#ECEEF2]">{vital.weight.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${
                            isNormal ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400' : 'bg-amber-950/50 border-amber-600/60 text-amber-400'
                          }`}>
                            {isNormal ? 'NOMINAL' : 'ANOMALY'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono flex flex-col items-center gap-2">
          <Inbox className="w-6 h-6" />
          <span>No health metrics recorded yet.</span>
        </div>
      )}
    </div>
  );
};

export default HealthMetricsPage;
