import React, { useState, useEffect } from "react";
import {
  Zap,
  AlertTriangle,
  Heart,
  Activity,
  Clock,
  X,
  CheckCircle2,
  ShieldAlert
} from "lucide-react";

interface EmergencyLockdownProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber?: string;
  patientName?: string;
}

export const EmergencyLockdownOverlay: React.FC<EmergencyLockdownProps> = ({
  isOpen,
  onClose,
  bedNumber = "ICU-14",
  patientName = "Eleanor Vance (#89201)"
}) => {
  const [cprSeconds, setCprSeconds] = useState(142); // 2 min 22 sec CPR cycle
  const [activeInterventions, setActiveInterventions] = useState<string[]>([
    "Epinephrine 1mg IV (09:02)",
    "Airway Secured (09:00)"
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCprSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleAddIntervention = (name: string) => {
    const timeStr = new Date().toLocaleTimeString("en-US", { hour12: false });
    setActiveInterventions((prev) => [`${name} (${timeStr})`, ...prev]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-[#030406] text-[#ECEEF2] font-mono flex flex-col justify-between p-4 sm:p-6 overflow-hidden">
      {/* Top High-Acuity Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-red-500/50 pb-4 bg-red-950/30 p-4 rounded-[2px]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-600 text-white rounded-[2px] animate-pulse">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-base sm:text-lg font-bold tracking-widest text-red-400">
                LEVEL 5 EMERGENCY RESUSCITATION LOCKDOWN
              </span>
              <span className="text-xs bg-red-600 text-white font-bold px-2 py-0.5 rounded-[2px]">
                0ms DELAY MODE
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Target Patient: <span className="font-bold text-white">{patientName}</span> | Bed: <span className="font-bold text-white">{bedNumber}</span>
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex items-center gap-2 text-xs bg-[#151922] hover:bg-slate-800 border border-[#2F3542] px-3 py-1.5 rounded-[2px] transition-colors"
        >
          <X className="w-4 h-4" />
          <span>EXIT LOCKDOWN</span>
        </button>
      </div>

      {/* Center 32px Tabular Monospaced Waveform Readouts */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-4">
        {/* Heart Rate / Rhythm */}
        <div className="p-4 bg-[#0B0F17] border-2 border-red-500/60 rounded-[2px] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold text-red-400 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-red-500 animate-ping" /> HEART RATE
            </span>
            <span className="text-red-400 font-mono font-bold">VFIB / TACH</span>
          </div>
          <div className="text-4xl sm:text-5xl font-black font-mono text-red-400 tracking-tight">
            148 <span className="text-sm font-normal text-slate-400">BPM</span>
          </div>
          <div className="h-8 bg-[#150C0C] border border-red-900/40 rounded-[2px] flex items-center px-2">
            <span className="text-[10px] text-red-300 font-mono tracking-widest truncate">
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
            </span>
          </div>
        </div>

        {/* Arterial Blood Pressure */}
        <div className="p-4 bg-[#0B0F17] border-2 border-amber-500/60 rounded-[2px] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-amber-500" /> ARTERIAL LINE BP
            </span>
            <span className="text-amber-400 font-mono font-bold">HYPOTENSIVE</span>
          </div>
          <div className="text-4xl sm:text-5xl font-black font-mono text-amber-400 tracking-tight">
            82/44 <span className="text-sm font-normal text-slate-400">mmHg</span>
          </div>
          <div className="text-[11px] text-amber-300">
            Mean Arterial Pressure (MAP): <span className="font-bold">56 mmHg</span>
          </div>
        </div>

        {/* SpO2 Saturation */}
        <div className="p-4 bg-[#0B0F17] border-2 border-cyan-500/60 rounded-[2px] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-400" /> SPO2 PULSE OX
            </span>
            <span className="text-cyan-400 font-mono font-bold">HYPOXIA RISK</span>
          </div>
          <div className="text-4xl sm:text-5xl font-black font-mono text-cyan-400 tracking-tight">
            88% <span className="text-sm font-normal text-slate-400">O2</span>
          </div>
          <div className="text-[11px] text-cyan-300">
            High Flow Nasal Cannula (100% FiO2)
          </div>
        </div>

        {/* Active CPR Cycle Timer */}
        <div className="p-4 bg-[#0B0F17] border-2 border-emerald-500/60 rounded-[2px] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-400" /> CPR CYCLE TIMER
            </span>
            <span className="text-emerald-400 font-mono font-bold">CYCLE 2</span>
          </div>
          <div className="text-4xl sm:text-5xl font-black font-mono text-emerald-400 tracking-tight">
            {formatTimer(cprSeconds)}
          </div>
          <button
            onClick={() => setCprSeconds(0)}
            className="w-full text-xs bg-emerald-950 border border-emerald-600/60 text-emerald-300 py-1 rounded-[2px] hover:bg-emerald-900 transition-colors font-bold"
          >
            RESET CPR 2-MIN TIMER
          </button>
        </div>
      </div>

      {/* 1-Touch Emergency Intervention Controls & Log */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Rapid Actions */}
        <div className="md:col-span-2 p-4 bg-[#0F1218] border border-[#252A35] rounded-[2px] space-y-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block border-b border-white/5 pb-2">
            1-Touch Emergency Protocol Triggers
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              onClick={() => handleAddIntervention("Epinephrine 1mg IV Push")}
              className="p-3 bg-red-950/60 hover:bg-red-900/80 border border-red-600/80 text-white rounded-[2px] text-xs font-bold transition-all text-left"
            >
              + Epinephrine 1mg IV
            </button>
            <button
              onClick={() => handleAddIntervention("Amiodarone 300mg IV Bolus")}
              className="p-3 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/80 text-white rounded-[2px] text-xs font-bold transition-all text-left"
            >
              + Amiodarone 300mg IV
            </button>
            <button
              onClick={() => handleAddIntervention("Defibrillation 200J Biphasic")}
              className="p-3 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-600/80 text-white rounded-[2px] text-xs font-bold transition-all text-left"
            >
              ⚡ Defibrillate 200J
            </button>
            <button
              onClick={() => handleAddIntervention("Atropine 1mg IV Push")}
              className="p-3 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-600/80 text-white rounded-[2px] text-xs font-bold transition-all text-left"
            >
              + Atropine 1mg IV
            </button>
            <button
              onClick={() => handleAddIntervention("Endotracheal Intubation Complete")}
              className="p-3 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-600/80 text-white rounded-[2px] text-xs font-bold transition-all text-left"
            >
              + Intubation Secured
            </button>
            <button
              onClick={() => handleAddIntervention("ABG Lab Requisition Placed")}
              className="p-3 bg-[#1F232E] hover:bg-slate-700 border border-[#2F3542] text-white rounded-[2px] text-xs font-bold transition-all text-left"
            >
              + STAT ABG Lab Order
            </button>
          </div>
        </div>

        {/* Resuscitation Log */}
        <div className="p-4 bg-[#0F1218] border border-[#252A35] rounded-[2px] space-y-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block border-b border-white/5 pb-2">
            Active Resuscitation Log
          </span>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {activeInterventions.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs text-slate-200 bg-[#151922] p-2 rounded-[2px] border border-[#252A35]"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
