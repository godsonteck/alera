import React, { useState } from "react";
import {
  Activity,
  HeartPulse,
  Pill,
  FlaskConical,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  UserCheck
} from "lucide-react";

export interface TelemetryPoint {
  time: string;
  hr: number;
  bpSystolic: number;
  bpDiastolic: number;
  spO2: number;
  egfr: number;
  troponin: number;
  vancomycinDose: number;
  note?: string;
  isAnomaly?: boolean;
}

export const SynchronousCareContinuum: React.FC = () => {
  const [zoomLevel, setZoomLevel] = useState<"12h" | "24h" | "7d">("12h");
  const [selectedPoint, setSelectedPoint] = useState<TelemetryPoint | null>(null);
  const [showAiTrace, setShowAiTrace] = useState<boolean>(true);

  // Mock real-time 12-hour biological telemetry stream
  const telemetryStream: TelemetryPoint[] = [
    { time: "02:00", hr: 74, bpSystolic: 122, bpDiastolic: 78, spO2: 98, egfr: 54, troponin: 0.01, vancomycinDose: 500 },
    { time: "04:00", hr: 78, bpSystolic: 128, bpDiastolic: 82, spO2: 97, egfr: 48, troponin: 0.02, vancomycinDose: 0 },
    { time: "06:00", hr: 88, bpSystolic: 134, bpDiastolic: 86, spO2: 95, egfr: 38, troponin: 0.04, vancomycinDose: 500, isAnomaly: true, note: "Subtle eGFR decline flagged by Renal Engine" },
    { time: "08:00", hr: 96, bpSystolic: 142, bpDiastolic: 90, spO2: 94, egfr: 31, troponin: 0.08, vancomycinDose: 0 },
    { time: "10:00", hr: 108, bpSystolic: 154, bpDiastolic: 96, spO2: 92, egfr: 28, troponin: 0.14, vancomycinDose: 250, isAnomaly: true, note: "Dose adjusted: Renal clearance drop to 28 mL/min" },
    { time: "12:00", hr: 94, bpSystolic: 136, bpDiastolic: 84, spO2: 96, egfr: 32, troponin: 0.11, vancomycinDose: 0 }
  ];

  const activePoint = selectedPoint || telemetryStream[4];

  return (
    <div className="w-full bg-[#090D14] border border-[#252A35] rounded-[4px] p-4 font-mono text-[#ECEEF2] space-y-4">
      {/* Top Canvas Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#252A35] pb-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-[2px] text-cyan-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wider text-[#ECEEF2]">
                SYNCHRONOUS CARE CONTINUUM (SCC)
              </span>
              <span className="text-[10px] bg-cyan-950/60 text-cyan-400 border border-cyan-800/60 px-1.5 py-0.2 rounded font-mono">
                LIVE 4D TELEMETRY
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Patient: <span className="text-[#ECEEF2] font-semibold">Eleanor Vance (#89201)</span> | Bed: <span className="text-[#ECEEF2]">ICU-14</span>
            </p>
          </div>
        </div>

        {/* Spatial Zoom & AI Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiTrace(!showAiTrace)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-[2px] border transition-colors ${
              showAiTrace
                ? "bg-purple-950/50 border-purple-500/50 text-purple-300"
                : "bg-[#151922] border-[#2F3542] text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Trace</span>
          </button>

          <div className="flex items-center bg-[#0F1218] border border-[#252A35] rounded-[2px] p-0.5 text-[11px]">
            {(["12h", "24h", "7d"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setZoomLevel(lvl)}
                className={`px-2 py-0.5 rounded-[2px] transition-colors ${
                  zoomLevel === lvl
                    ? "bg-[#1F232E] text-cyan-400 font-semibold border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4D Temporal Telemetry Stream Graph Surface */}
      <div className="relative bg-[#06080C] border border-[#1F232E] rounded-[2px] p-4 space-y-4">
        {/* Baseline Axis Indicators */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 pb-2 border-b border-white/5">
          <span>02:00 (INTAKE)</span>
          <span>06:00 (RENAL DROP)</span>
          <span className="text-amber-400 font-semibold">10:00 (DOSE MODIFICATION)</span>
          <span>12:00 (CURRENT)</span>
        </div>

        {/* Telemetry Curves Representation */}
        <div className="grid grid-cols-6 gap-2">
          {telemetryStream.map((pt, idx) => {
            const isSelected = activePoint.time === pt.time;
            return (
              <div
                key={pt.time}
                onClick={() => setSelectedPoint(pt)}
                className={`p-2.5 rounded-[2px] border cursor-pointer transition-all ${
                  isSelected
                    ? "bg-[#151922] border-cyan-500/60 shadow-lg shadow-cyan-950/20"
                    : pt.isAnomaly
                    ? "bg-[#1A1212] border-amber-500/40 hover:border-amber-500/70"
                    : "bg-[#0B0F17] border-[#1F232E] hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span className="font-semibold text-[#ECEEF2]">{pt.time}</span>
                  {pt.isAnomaly && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">HR:</span>
                    <span className={`font-mono font-semibold ${pt.hr > 100 ? "text-amber-400" : "text-[#ECEEF2]"}`}>
                      {pt.hr} <span className="text-[9px] text-slate-500">bpm</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">BP:</span>
                    <span className="font-mono text-[#ECEEF2]">
                      {pt.bpSystolic}/{pt.bpDiastolic}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">eGFR:</span>
                    <span className={`font-mono font-semibold ${pt.egfr < 30 ? "text-red-400" : pt.egfr < 45 ? "text-amber-400" : "text-emerald-400"}`}>
                      {pt.egfr} <span className="text-[9px] text-slate-500">mL/m</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI Accountability Trace Vector Surface */}
        {showAiTrace && (
          <div className="bg-[#120D1A] border border-purple-500/30 rounded-[2px] p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <div className="text-purple-300 font-semibold flex items-center gap-2">
                  <span>AI PATTERN TRACE DETECTED</span>
                  <span className="text-[10px] bg-purple-950 border border-purple-700/50 px-1.5 py-0.2 rounded text-purple-200">
                    Confidence: 96.4%
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  eGFR fell from 54 to 28 mL/min (48% decline) $\rightarrow$ Vancomycin dose reduced 500mg $\rightarrow$ 250mg IV Q12H.
                </p>
              </div>
            </div>
            <button className="text-[10px] font-mono text-purple-300 bg-purple-900/40 hover:bg-purple-900/70 border border-purple-600/50 px-2.5 py-1 rounded-[2px] transition-colors shrink-0">
              View Data Lineage
            </button>
          </div>
        )}
      </div>

      {/* Selected Timeframe Deep Telemetry Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Vital Signs Card */}
        <div className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/5 pb-1.5">
            <span className="font-semibold text-[#ECEEF2] flex items-center gap-1.5">
              <HeartPulse className="w-3.5 h-3.5 text-rose-400" /> Vital Telemetry
            </span>
            <span>{activePoint.time}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">HEART RATE</span>
              <span className="text-base font-bold font-mono text-[#ECEEF2]">{activePoint.hr} <span className="text-xs font-normal text-slate-400">BPM</span></span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">BLOOD PRESSURE</span>
              <span className="text-base font-bold font-mono text-[#ECEEF2]">{activePoint.bpSystolic}/{activePoint.bpDiastolic}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">SPO2 SATURATION</span>
              <span className="text-base font-bold font-mono text-cyan-400">{activePoint.spO2}%</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">TROPONIN I</span>
              <span className="text-base font-bold font-mono text-amber-400">{activePoint.troponin} <span className="text-xs font-normal text-slate-400">ng/mL</span></span>
            </div>
          </div>
        </div>

        {/* Pharmacological Kinetics Card */}
        <div className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/5 pb-1.5">
            <span className="font-semibold text-[#ECEEF2] flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-purple-400" /> Pharmacological Kinetics
            </span>
            <span>Vancomycin IV</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Active Dosage:</span>
              <span className="font-mono text-[#ECEEF2] font-semibold">{activePoint.vancomycinDose} mg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Renal Clearance:</span>
              <span className={`font-mono font-semibold ${activePoint.egfr < 30 ? "text-red-400" : "text-amber-400"}`}>
                eGFR {activePoint.egfr} mL/min
              </span>
            </div>
            <div className="text-[10px] text-slate-400 bg-[#151922] p-1.5 rounded border border-[#252A35]">
              Pharmacist verified against organ clearance feed.
            </div>
          </div>
        </div>

        {/* Care Team Intent & Audit Envelope Card */}
        <div className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/5 pb-1.5">
            <span className="font-semibold text-[#ECEEF2] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Cryptographic Lineage
            </span>
            <span className="text-[10px] text-slate-500">Hash #7f9a2b</span>
          </div>
          <div className="space-y-1 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Attending: Dr. Sarah Chen (NPI: 1982039)</span>
            </div>
            <p className="text-[10px] text-slate-400 pt-1 border-t border-white/5">
              {activePoint.note || "Routine biological telemetry recording."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
