import React from "react";
import { cn } from "@/lib/utils";

export type SignalType = "critical" | "urgent" | "stable" | "info" | "ai";

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
    critical: "bg-[#D94444] text-[#E88A8A] border-[#D94444]/40 signal-glow-critical",
    urgent: "bg-[#E8A317] text-[#E8C460] border-[#E8A317]/40 signal-glow-urgent",
    stable: "bg-[#34B578] text-[#6DD4A0] border-[#34B578]/40 signal-glow-stable",
    info: "bg-[#4A8FD4] text-[#84B5E0] border-[#4A8FD4]/40",
    ai: "bg-[#8F5CC4] text-[#B08CD8] border-[#8F5CC4]/40",
  };

  const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  };

  return (
    <div className={cn("inline-flex items-center gap-2 font-mono text-xs", className)}>
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
        <span className="text-[#5F6370] text-[10px] uppercase tracking-wider">
          [{sublabel}]
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
    <div className={cn("flex flex-col gap-1 p-3 alera-instrument-bezel", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[#8D929E] uppercase tracking-wider font-sans">
          {label}
        </span>
        {signal && signalLabel && (
          <SignalIndicator type={signal} label={signalLabel} size="sm" />
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono tracking-tight text-[#ECEEF2]">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-mono text-[#8D929E]">
            {unit}
          </span>
        )}
      </div>

      {context && (
        <div className="flex items-center gap-1 text-[11px] font-mono text-[#5F6370] border-t border-[#252A35]/60 pt-1.5 mt-0.5">
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
    ai: "bg-[#8F5CC4]",
  };

  return (
    <div className={cn("p-3 alera-instrument-bezel space-y-2", className)}>
      <div className="flex justify-between items-center text-xs">
        <span className="font-sans font-medium text-[#8D929E] tracking-wide uppercase text-[11px]">
          {label}
        </span>
        <span className="font-mono font-semibold text-[#ECEEF2]">
          {current} <span className="text-[#8D929E] text-[10px]">{unit}</span>
        </span>
      </div>

      <div className="relative h-2 bg-[#0F1218] rounded-sm overflow-hidden border border-[#252A35]">
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

      <div className="flex justify-between text-[10px] font-mono text-[#5F6370]">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};
