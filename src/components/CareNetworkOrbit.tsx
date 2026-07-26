import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  Heart,
  Activity,
  Shield,
  Zap,
  Microscope,
  Pill,
  PhoneCall,
  Radio
} from "lucide-react";

interface OrbitNode {
  id: string;
  name: string;
  role: string;
  facility: string;
  status: "active" | "telemetry" | "urgent" | "idle";
  distance: number;
  angle: number;
  metrics: string;
  icon: any;
}

export const CareNetworkOrbit: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<OrbitNode | null>(null);

  const nodes: OrbitNode[] = [
    {
      id: "node-1",
      name: "Dr. Aris Thorne",
      role: "Cardiothoracic Surgeon",
      facility: "Metro Health Institute",
      status: "active",
      distance: 1,
      angle: 45,
      metrics: "Live Telemetry • 99.8% Sync",
      icon: Stethoscope
    },
    {
      id: "node-2",
      name: "Genomic BioLab Alpha",
      role: "Molecular Diagnostics",
      facility: "Alera Research Core",
      status: "active",
      distance: 1,
      angle: 165,
      metrics: "Sequencing Complete • NGS-402",
      icon: Microscope
    },
    {
      id: "node-3",
      name: "Apex Pharmacy Network",
      role: "Precision Dispensing",
      facility: "Automated Hub 04",
      status: "idle",
      distance: 2,
      angle: 290,
      metrics: "Auto-Refill Ready",
      icon: Pill
    },
    {
      id: "node-4",
      name: "Trauma ICU Response Unit",
      role: "High-Acuity Emergency",
      facility: "St. Jude Medical",
      status: "urgent",
      distance: 2,
      angle: 120,
      metrics: "Triage Alert • Dispatch Active",
      icon: Activity
    },
    {
      id: "node-5",
      name: "Dr. Elena Rostova",
      role: "Neurology & Brain Analytics",
      facility: "NeuroSync Center",
      status: "telemetry",
      distance: 3,
      angle: 210,
      metrics: "EEG Stream Active",
      icon: Zap
    },
    {
      id: "node-6",
      name: "Central Health Data Vault",
      role: "HIPAA Zero-Knowledge Vault",
      facility: "Alera Sovereign Cloud",
      status: "active",
      distance: 3,
      angle: 340,
      metrics: "256-bit Encrypted",
      icon: Shield
    }
  ];

  const getStatusColor = (status: OrbitNode["status"]) => {
    switch (status) {
      case "active":
        return "text-cyan-400 bg-cyan-500/20 border-cyan-500/50 shadow-cyan-500/30";
      case "urgent":
        return "text-rose-400 bg-rose-500/20 border-rose-500/50 shadow-rose-500/30 animate-pulse";
      case "telemetry":
        return "text-purple-400 bg-purple-500/20 border-purple-500/50 shadow-purple-500/30";
      default:
        return "text-emerald-400 bg-emerald-500/20 border-emerald-500/50 shadow-emerald-500/30";
    }
  };

  return (
    <div className="relative w-full aspect-square max-w-2xl mx-auto flex items-center justify-center p-4">
      {/* Background Orbit Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[40%] h-[40%] rounded-full border border-cyan-500/20 border-dashed animate-[spin_60s_linear_infinite]" />
        <div className="w-[68%] h-[68%] rounded-full border border-white/10 border-dashed animate-[spin_90s_linear_infinite_reverse]" />
        <div className="w-[92%] h-[92%] rounded-full border border-white/5 border-dashed animate-[spin_120s_linear_infinite]" />
        <div className="w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl animate-pulse" />
      </div>

      {/* Central Core Patient Hub */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="relative z-20 flex flex-col items-center justify-center w-28 h-28 rounded-full phoenix-card border border-cyan-400/40 shadow-2xl cursor-pointer bg-[#0A0F1D] text-white"
        onClick={() => setSelectedNode(null)}
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-400 to-teal-300 flex items-center justify-center text-black font-bold shadow-lg shadow-cyan-400/30">
            <Heart className="w-5 h-5 fill-black" />
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
        </div>
        <div className="mt-1.5 text-[11px] font-mono tracking-wider text-cyan-300 font-semibold uppercase">
          ALERA CORE
        </div>
        <div className="text-[9px] text-slate-400 font-mono">Living Patient</div>
      </motion.div>

      {/* Orbiting Nodes */}
      {nodes.map((node) => {
        const rad = (node.angle * Math.PI) / 180;
        const radiusMap: Record<number, number> = { 1: 20, 2: 34, 3: 46 };
        const radiusPct = radiusMap[node.distance] || 30;

        const x = Math.cos(rad) * radiusPct;
        const y = Math.sin(rad) * radiusPct;

        const Icon = node.icon;
        const isSelected = selectedNode?.id === node.id;

        return (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: node.distance * 0.15 }}
            style={{
              left: `calc(50% + ${x}%)`,
              top: `calc(50% + ${y}%)`,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-30"
          >
            <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible pointer-events-none w-px h-px">
              <line
                x1={0}
                y1={0}
                x2={-x * 4}
                y2={-y * 4}
                stroke={isSelected ? "#00F2FE" : "rgba(255,255,255,0.08)"}
                strokeWidth={isSelected ? 2 : 1}
                strokeDasharray={isSelected ? "4 4" : "none"}
              />
            </svg>

            <motion.button
              whileHover={{ scale: 1.15 }}
              onClick={() => setSelectedNode(node)}
              className={`p-3 rounded-full border shadow-xl flex items-center justify-center transition-all ${getStatusColor(
                node.status
              )} ${isSelected ? "ring-4 ring-cyan-400/40 scale-110" : ""}`}
            >
              <Icon className="w-5 h-5" />
            </motion.button>

            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap text-[10px] font-mono tracking-tight font-medium text-slate-300 bg-[#090D14]/90 px-2 py-0.5 rounded border border-white/10 backdrop-blur-md">
              {node.name}
            </div>
          </motion.div>
        );
      })}

      {/* Selected Node Telemetry Detail Modal */}
      <AnimatePresence>
        {selectedNode && (() => {
          const SelectedIcon = selectedNode.icon;
          return (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-4 left-4 right-4 z-40 phoenix-card rounded-xl p-4 border border-cyan-500/30 bg-[#090D14]/95 text-white shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg border ${getStatusColor(selectedNode.status)}`}>
                    <SelectedIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      <span>{selectedNode.name}</span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {selectedNode.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">{selectedNode.role} • {selectedNode.facility}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5"
                >
                  Close
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-300">
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>{selectedNode.metrics}</span>
                </div>
                <button className="flex items-center gap-1 text-xs text-black font-semibold bg-cyan-400 hover:bg-cyan-300 px-3 py-1 rounded-md transition-colors">
                  <PhoneCall className="w-3 h-3" />
                  <span>Connect Live</span>
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default CareNetworkOrbit;
