import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Dna,
  Activity,
  FileText,
  Pill,
  Sparkles,
  Clock
} from "lucide-react";

interface TimelineEvent {
  id: string;
  timestamp: string;
  date: string;
  type: "genomic" | "scan" | "lab" | "medication" | "clinical";
  title: string;
  category: string;
  summary: string;
  status: "verified" | "flagged" | "pending";
  confidence?: string;
  provider: string;
}

export const PatientGenomeTimeline: React.FC = () => {
  const [filterType, setFilterType] = useState<string>("all");
  const [activeEvent, setActiveEvent] = useState<TimelineEvent | null>(null);

  const events: TimelineEvent[] = [
    {
      id: "evt-1",
      timestamp: "10:42 AM",
      date: "TODAY",
      type: "genomic",
      title: "NGS Whole Genome Variant Analysis",
      category: "Pharmacogenomics",
      summary: "Identified CYP2C19 *2 allele carrier variant. Recommended dosage adjustment for Clopidogrel therapy.",
      status: "flagged",
      confidence: "99.94% Variant Accuracy",
      provider: "Alera BioGenomics Hub"
    },
    {
      id: "evt-2",
      timestamp: "08:15 AM",
      date: "TODAY",
      type: "scan",
      title: "3D Cardiac Volumetric MRI",
      category: "Radiology & Imaging",
      summary: "Left Ventricular Ejection Fraction (LVEF) 64%. Zero myocardial scar tissue detected.",
      status: "verified",
      confidence: "Volumetric AI Segmented",
      provider: "Dr. Aris Thorne • Metro Health"
    },
    {
      id: "evt-3",
      timestamp: "YESTERDAY",
      date: "JUL 25, 2026",
      type: "lab",
      title: "Comprehensive Metabolic & Lipid Biomarkers",
      category: "Clinical Pathology",
      summary: "Hs-CRP: 0.8 mg/L (Optimal). HbA1c: 5.2%. ApoB: 65 mg/dL. All inflammatory markers nominal.",
      status: "verified",
      confidence: "Automated Immunoassay",
      provider: "Central BioPath Labs"
    },
    {
      id: "evt-4",
      timestamp: "JUL 20, 2026",
      date: "JUL 20, 2026",
      type: "medication",
      title: "Precision Micro-Dose Protocol Initiated",
      category: "Therapeutics",
      summary: "CoQ10 Ubiquinol 200mg/day + Rosuvastatin 5mg alternate days. Smart Dispense verification active.",
      status: "verified",
      confidence: "Adherence Telemetry: 100%",
      provider: "Apex Pharmacy Network"
    },
    {
      id: "evt-5",
      timestamp: "JUL 10, 2026",
      date: "JUL 10, 2026",
      type: "clinical",
      title: "Comprehensive Biometric Intake & Baseline",
      category: "Preventive Care",
      summary: "Full continuous telemetry sensor onboarding. Baseline VO2 Max: 48.5 mL/kg/min.",
      status: "verified",
      confidence: "Multi-Sensor Calibrated",
      provider: "Dr. Elena Rostova"
    }
  ];

  const filteredEvents = filterType === "all" ? events : events.filter(e => e.type === filterType);

  const getTypeIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "genomic": return Dna;
      case "scan": return Activity;
      case "lab": return FileText;
      case "medication": return Pill;
      default: return Sparkles;
    }
  };

  const getTypeColor = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "genomic": return "text-purple-400 border-purple-500/40 bg-purple-500/10";
      case "scan": return "text-cyan-400 border-cyan-500/40 bg-cyan-500/10";
      case "lab": return "text-teal-400 border-teal-500/40 bg-teal-500/10";
      case "medication": return "text-amber-400 border-amber-500/40 bg-amber-500/10";
      default: return "text-blue-400 border-blue-500/40 bg-blue-500/10";
    }
  };

  return (
    <div className="phoenix-card rounded-2xl p-6 border border-white/10 bg-[#090D14]/80 text-white shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <Dna className="w-5 h-5 text-purple-400 animate-pulse" />
            <h3 className="text-lg font-semibold tracking-tight text-white font-display">
              Patient Genome & Clinical Timeline
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Continuous temporal axis of diagnostic scans, genetic markers, and micro-dose protocols.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {["all", "genomic", "scan", "lab", "medication"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono capitalize transition-all border ${
                filterType === t
                  ? "bg-purple-500/20 border-purple-500/50 text-purple-300 font-semibold"
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:border-white/20"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 relative pl-6 border-l border-white/10 space-y-6">
        {filteredEvents.map((evt, idx) => {
          const Icon = getTypeIcon(evt.type);
          const colorClasses = getTypeColor(evt.type);
          const isSelected = activeEvent?.id === evt.id;

          return (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="relative group cursor-pointer"
              onClick={() => setActiveEvent(isSelected ? null : evt)}
            >
              <div
                className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-[#090D14] flex items-center justify-center transition-all ${
                  evt.status === "flagged"
                    ? "border-amber-400 text-amber-400 shadow-lg shadow-amber-400/40"
                    : "border-cyan-400 text-cyan-400"
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-current" />
              </div>

              <div
                className={`p-4 rounded-xl border transition-all ${
                  isSelected
                    ? "bg-white/10 border-cyan-400/50 shadow-xl"
                    : "bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/[0.07]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-md border ${colorClasses}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                        {evt.category}
                      </span>
                      <h4 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                        {evt.title}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{evt.date} • {evt.timestamp}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans mt-2">
                  {evt.summary}
                </p>

                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                  <div className="text-slate-400 flex items-center gap-1.5">
                    <span>{evt.provider}</span>
                  </div>

                  {evt.confidence && (
                    <span className="text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      {evt.confidence}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default PatientGenomeTimeline;
