import React from "react";
import { cn } from "@/lib/utils";

export type SignalType = "critical" | "urgent" | "stable" | "info";

interface SignalIndicatorProps {
  type: SignalType;
  label: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const SignalIndicator: React.FC<SignalIndicatorProps> = ({
  type,
  label,
  sublabel,
  size = "md",
  className,
}) => {
  const signalColors = {
    critical: "bg-red-500 text-red-700 border-red-200",
    urgent: "bg-amber-500 text-amber-800 border-amber-200",
    stable: "bg-[#4a785c] text-[#2f6b4f] border-[#8fd0af]",
    info: "bg-[#0b3d62] text-[#0b3d62] border-sky-200",
  };

  const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  };

  return (
    <div className={cn("inline-flex items-center gap-2 text-xs", className)}>
      <span
        className={cn(
          "rounded-full inline-block shrink-0 transition-transform duration-300",
          dotSizes[size],
          signalColors[type].split(" ")[0]
        )}
        aria-hidden="true"
      />
      <span className={cn("font-medium tracking-wide", signalColors[type].split(" ")[1])}>
        {label}
      </span>
      {sublabel && (
        <span className="text-slate-500 text-[10px]">
          {sublabel}
        </span>
      )}
    </div>
  );
};

interface MetricDisplayProps {
  label: string;
  value: string | number;
  unit?: string;
  context?: string;
  signal?: SignalType;
  signalLabel?: string;
  trend?: "up" | "down" | "stable";
  className?: string;
}

export const MetricDisplay: React.FC<MetricDisplayProps> = ({
  label,
  value,
  unit,
  context,
  signal,
  signalLabel,
  trend,
  className,
}) => {
  return (
    <div className={cn("flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-600 font-sans">
          {label}
        </span>
        {signal && signalLabel && (
          <SignalIndicator type={signal} label={signalLabel} size="sm" />
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono tracking-tight text-[#0b3d62]">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-mono text-slate-500">
            {unit}
          </span>
        )}
      </div>

      {context && (
        <div className="flex items-center gap-1 text-[11px] text-slate-500 border-t border-slate-100 pt-1.5 mt-0.5">
          {trend === "up" && <span className="text-[#D94444]">▲</span>}
          {trend === "down" && <span className="text-[#34B578]">▼</span>}
          {trend === "stable" && <span className="text-[#8D929E]">►</span>}
          <span>{context}</span>
        </div>
      )}
    </div>
  );
};

interface AleraSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 1 | 2 | 3;
  children: React.ReactNode;
}

export const AleraSurface: React.FC<AleraSurfaceProps> = ({
  level = 1,
  children,
  className,
  ...props
}) => {
  const levelClasses = {
    1: "alera-surface-1",
    2: "alera-surface-2",
    3: "alera-surface-3",
  };

  return (
    <div className={cn(levelClasses[level], className)} {...props}>
      {children}
    </div>
  );
};

interface InstrumentGaugeProps {
  label: string;
  min: number;
  max: number;
  current: number;
  unit: string;
  lowThreshold?: number;
  highThreshold?: number;
  className?: string;
}

export const InstrumentGauge: React.FC<InstrumentGaugeProps> = ({
  label,
  min,
  max,
  current,
  unit,
  lowThreshold,
  highThreshold,
  className,
}) => {
  const percentage = Math.min(100, Math.max(0, ((current - min) / (max - min)) * 100));
  
  let signalState: SignalType = "stable";
  if (highThreshold && current >= highThreshold) signalState = "critical";
  else if (lowThreshold && current <= lowThreshold) signalState = "urgent";

  const barColors = {
    critical: "bg-[#D94444]",
    urgent: "bg-[#E8A317]",
    stable: "bg-[#2BB5A0]",
    info: "bg-[#4A8FD4]",
  };

  return (
    <div className={cn("space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="flex justify-between items-center text-xs">
        <span className="font-sans font-medium text-slate-600 text-[11px]">
          {label}
        </span>
        <span className="font-mono font-semibold text-[#0b3d62]">
          {current} <span className="text-slate-500 text-[10px]">{unit}</span>
        </span>
      </div>

      <div className="relative h-2 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
        {/* Threshold Markers */}
        {lowThreshold && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#E8A317]/60 z-10"
            style={{ left: `${((lowThreshold - min) / (max - min)) * 100}%` }}
          />
        )}
        {highThreshold && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#D94444]/60 z-10"
            style={{ left: `${((highThreshold - min) / (max - min)) * 100}%` }}
          />
        )}

        {/* Current Bar */}
        <div
          className={cn("h-full transition-all duration-500 ease-out", barColors[signalState])}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] font-mono text-slate-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};
