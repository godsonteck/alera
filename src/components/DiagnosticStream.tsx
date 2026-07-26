import React, { useState, useEffect } from "react";
import {
  Activity,
  Heart,
  Zap,
  TrendingUp,
  Radio
} from "lucide-react";

export const DiagnosticStream: React.FC = () => {
  const [heartRate, setHeartRate] = useState(72);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeartRate(prev => 70 + Math.floor(Math.random() * 5));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const metrics = [
    { label: "Heart Rate", value: `${heartRate} BPM`, sub: "Sinus Rhythm", color: "text-rose-400 border-rose-500/30", icon: Heart },
    { label: "Oxygen SpO2", value: "99%", sub: "Ambient Room Air", color: "text-cyan-400 border-cyan-500/30", icon: Activity },
    { label: "Blood Pressure", value: "118 / 76", sub: "Mean Arterial: 90", color: "text-teal-400 border-teal-500/30", icon: Zap },
    { label: "Blood Glucose", value: "94 mg/dL", sub: "Fasting Baseline", color: "text-purple-400 border-purple-500/30", icon: TrendingUp },
  ];

  return (
    <div className="phoenix-card rounded-2xl p-6 border border-white/10 bg-[#090D14]/80 text-white shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white font-display">
              Continuous Vital Telemetry Stream
            </h3>
            <p className="text-xs text-slate-400">Sub-second precision sensor sync via Alera Medical Core.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono text-emerald-400 font-semibold uppercase">LIVE SENSOR ONLINE</span>
        </div>
      </div>

      <div className="my-6 relative h-24 w-full bg-[#030508] rounded-xl border border-white/10 overflow-hidden flex items-center p-2">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:16px_16px]" />

        <svg className="w-full h-full relative z-10" viewBox="0 0 600 100" preserveAspectRatio="none">
          <path
            d="M 0 50 L 80 50 L 90 20 L 100 80 L 110 10 L 120 70 L 130 50 L 250 50 L 260 15 L 270 85 L 280 10 L 290 75 L 300 50 L 450 50 L 460 20 L 470 80 L 480 10 L 490 70 L 500 50 L 600 50"
            fill="none"
            stroke="#00F2FE"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute top-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-cyan-400/30 to-cyan-400/80 animate-scanline pointer-events-none" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="p-3.5 rounded-xl border border-white/5 bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-slate-400">{m.label}</span>
                <Icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <div className="text-xl font-bold font-mono text-white tracking-tight">{m.value}</div>
              <div className="text-[10px] font-mono text-slate-400 mt-1">{m.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DiagnosticStream;
