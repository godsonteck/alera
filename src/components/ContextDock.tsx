import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Activity,
  Heart,
  ShieldCheck,
  Stethoscope,
  Users,
  Compass,
  Bell,
  Sliders,
  Sparkles,
  ChevronUp,
  Cpu,
  Command,
  ShieldAlert
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import { useNotifications } from "@/contexts/useNotifications";
import { AleraCommandPalette } from "@/components/navigation/AleraCommandPalette";
import { EmergencyLockdownOverlay } from "@/components/emergency/EmergencyLockdownOverlay";

export const ContextDock: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [activeRoleFilter, setActiveRoleFilter] = useState<string>("doctor");

  const navItems = [
    { label: "Overview", path: "/", icon: Compass },
    { label: "Clinical OS", path: "/dashboard", icon: Activity },
    { label: "Care Network", path: "/how-it-works", icon: Users },
    { label: "Trust & Security", path: "/trust", icon: ShieldCheck },
    { label: "Specialist Radar", path: "/who-we-serve", icon: Stethoscope },
  ];

  const rolePresets = [
    { id: "doctor", label: "Physician Telemetry", icon: Stethoscope },
    { id: "patient", label: "Patient Genome", icon: Heart },
    { id: "hospital", label: "Hospital Command", icon: Activity },
    { id: "emergency", label: "Emergency Acuity", icon: Cpu },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Contextual Dock Floating Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4 pointer-events-none font-mono">
        <div className="pointer-events-auto relative">
          <div className="rounded-[4px] p-2 border border-[#252A35] shadow-2xl flex items-center justify-between gap-2 bg-[#090D14]/95 text-[#ECEEF2] backdrop-blur-xl">
            {/* Brand Mark & Quick Selector */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-[2px] hover:bg-[#151922] transition-colors text-left group"
            >
              <div className="w-7 h-7 rounded-[2px] bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-xs font-mono">
                AL
              </div>
              <div className="hidden sm:block">
                <div className="text-[11px] font-mono tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                  <span>CNOS PHOENIX</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {user?.role || "Clinical Command"}
                </div>
              </div>
              <ChevronUp className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
            </button>

            <div className="h-5 w-[1px] bg-[#252A35] hidden sm:block" />

            {/* Core Navigation Items */}
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-medium transition-colors border ${
                      active
                        ? "bg-[#151922] border-cyan-500/40 text-cyan-300 font-semibold"
                        : "border-transparent text-slate-400 hover:text-[#ECEEF2] hover:bg-[#0F1218]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="h-5 w-[1px] bg-[#252A35] hidden md:block" />

            {/* Action Trigger / Command Palette & Emergency Locks */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsCommandOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#151922] border border-[#2F3542] hover:border-cyan-500/50 text-cyan-300 text-xs font-semibold transition-colors"
                title="Global Command Palette (Cmd+K)"
              >
                <Command className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cmd+K</span>
              </button>

              <button
                onClick={() => setIsEmergencyOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[2px] bg-red-950/60 border border-red-600/60 hover:bg-red-900 text-red-300 text-xs font-bold transition-colors"
                title="Level 5 Emergency Resuscitation Lockdown"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">RESUS LOCK</span>
              </button>
            </div>
          </div>

          {/* Expanded Drawer Options */}
          {isExpanded && (
            <div className="absolute bottom-full mb-2 left-0 right-0 rounded-[4px] p-4 border border-[#252A35] shadow-2xl bg-[#090D14] text-[#ECEEF2] font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-[#252A35] mb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
                    Adaptive Workspace Viewport
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">Cmd+K for Command Speed Layer</div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {rolePresets.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = activeRoleFilter === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setActiveRoleFilter(preset.id);
                        navigate(`/dashboard?role=${preset.id}`);
                        setIsExpanded(false);
                      }}
                      className={`p-2.5 rounded-[2px] border text-left transition-colors flex items-center gap-2.5 ${
                        isSelected
                          ? "bg-[#151922] border-cyan-500/60 text-cyan-300"
                          : "bg-[#0F1218] border-[#252A35] text-slate-400 hover:border-slate-700 hover:text-[#ECEEF2]"
                      }`}
                    >
                      <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="text-xs font-medium truncate">{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Command Speed Layer */}
      <AleraCommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />

      {/* Level 5 Emergency Resuscitation Overlay */}
      <EmergencyLockdownOverlay isOpen={isEmergencyOpen} onClose={() => setIsEmergencyOpen(false)} />
    </>
  );
};

export default ContextDock;
