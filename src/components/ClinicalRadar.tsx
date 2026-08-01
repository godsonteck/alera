import React, { useState } from "react";
import {
  Radio,
  Ambulance
} from "lucide-react";

interface TriageCase {
  id: string;
  patientId: string;
  acuity: 1 | 2 | 3 | 4;
  condition: string;
  eta: string;
  vitals: string;
  bay: string;
}

export const ClinicalRadar: React.FC = () => {
  const triageCases: TriageCase[] = [
    {
      id: "case-901",
      patientId: "PAT-8802",
      acuity: 1,
      condition: "Acute STEMI / Cardiac Shock",
      eta: "IN TRANSIT (3 MIN)",
      vitals: "HR 132 • BP 85/50 • SpO2 88%",
      bay: "Resuscitation Bay 01"
    },
    {
      id: "case-902",
      patientId: "PAT-4419",
      acuity: 2,
      condition: "Polytrauma / Inter-facility Transport",
      eta: "ARRIVED",
      vitals: "HR 105 • BP 115/75 • SpO2 96%",
      bay: "Trauma Suite B"
    },
    {
      id: "case-903",
      patientId: "PAT-1104",
      acuity: 3,
      condition: "Severe Respiratory Distress",
      eta: "ARRIVED",
      vitals: "HR 92 • BP 128/82 • SpO2 93%",
      bay: "Observation Bay 04"
    }
  ];

  const getAcuityBadge = (acuity: TriageCase["acuity"]) => {
    switch (acuity) {
      case 1:
        return "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse";
      case 2:
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case 3:
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      default:
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    }
  };

  return (
    <div className="phoenix-card rounded-2xl p-6 border border-white/10 bg-[#090D14]/80 text-white shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white font-display">
              Care acuity overview
            </h3>
            <p className="text-xs text-slate-400">A quick look at incoming cases and bed readiness.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-semibold">
            1 CRITICAL IN-BOUND
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-center">
        <div className="lg:col-span-6 relative aspect-square max-w-sm mx-auto flex items-center justify-center p-4 border border-white/10 rounded-full bg-[#030508]/80 overflow-hidden">
          <div className="absolute inset-4 rounded-full border border-cyan-500/20" />
          <div className="absolute inset-16 rounded-full border border-cyan-500/15" />
          <div className="absolute inset-28 rounded-full border border-cyan-500/10" />

          <div className="absolute w-full h-[1px] bg-cyan-500/20" />
          <div className="absolute h-full w-[1px] bg-cyan-500/20" />

          <div className="absolute inset-0 origin-center animate-radar-sweep pointer-events-none">
            <div className="w-1/2 h-1/2 bg-gradient-to-tr from-cyan-500/30 to-transparent origin-bottom-right rounded-tl-full" />
          </div>

          <div className="relative z-10 w-8 h-8 rounded-full bg-rose-500/30 border border-rose-400 flex items-center justify-center text-rose-300">
            <Ambulance className="w-4 h-4 animate-bounce" />
          </div>

          <div className="absolute top-12 left-20 w-3 h-3 rounded-full bg-rose-500 animate-ping shadow-lg shadow-rose-500" />
          <div className="absolute bottom-20 right-16 w-3 h-3 rounded-full bg-amber-400 shadow-lg shadow-amber-400" />
          <div className="absolute top-28 right-24 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400" />
        </div>

        <div className="lg:col-span-6 space-y-3">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
            Active high-acuity cases
          </div>

          {triageCases.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl border border-white/5 bg-white/5 hover:border-white/20 transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getAcuityBadge(item.acuity)}`}>
                    Level {item.acuity} Acuity
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-300">
                    {item.patientId}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-rose-400 font-semibold">{item.eta}</span>
              </div>

              <div className="text-sm font-semibold text-white">{item.condition}</div>
              <div className="text-xs font-mono text-cyan-300 mt-1">{item.vitals}</div>

              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-white/5 pt-1.5">
                <span>Assigned: {item.bay}</span>
                <button className="text-cyan-400 hover:underline">Prepare Bay &rarr;</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClinicalRadar;
