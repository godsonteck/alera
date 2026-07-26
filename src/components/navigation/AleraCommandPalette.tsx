import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Search,
  HeartPulse,
  Pill,
  FlaskConical,
  ScanLine,
  Zap,
  X,
  Clock
} from "lucide-react";

interface CommandItem {
  id: string;
  category: "Patient Jump" | "Clinical Action" | "Workspace Shift" | "System Control";
  title: string;
  subtitle: string;
  shortcut?: string;
  icon: React.ElementType;
  action: () => void;
}

export const AleraCommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          setQuery("");
          setSelectedIndex(0);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const commands: CommandItem[] = [
    {
      id: "icu-14",
      category: "Patient Jump",
      title: "Jump to ICU Bed 14 — Eleanor Vance",
      subtitle: "Acuity: CRITICAL | HR 118 | SpO2 91% | Arterial Line Active",
      shortcut: "⌘1",
      icon: HeartPulse,
      action: () => {
        navigate("/dashboard/patients");
        onClose();
      }
    },
    {
      id: "stat-troponin",
      category: "Clinical Action",
      title: "Order STAT Troponin I & ECG Bundle",
      subtitle: "Execute high-acuity cardiac biomarker assay requisition",
      shortcut: "⌘T",
      icon: Activity,
      action: () => {
        navigate("/dashboard/lab-referrals");
        onClose();
      }
    },
    {
      id: "shift-handoff",
      category: "Workspace Shift",
      title: "Open 12-Hour Shift Handoff Summary",
      subtitle: "Dual-signature digital handshake log for ICU Ward A",
      shortcut: "⌘H",
      icon: Clock,
      action: () => {
        navigate("/dashboard/timeline");
        onClose();
      }
    },
    {
      id: "med-verification",
      category: "Clinical Action",
      title: "Verify Bedside Medication Pass Queue",
      subtitle: "Vancomycin IV 500mg Q12H due at 09:00",
      shortcut: "⌘M",
      icon: Pill,
      action: () => {
        navigate("/dashboard/prescriptions");
        onClose();
      }
    },
    {
      id: "dicom-viewer",
      category: "Workspace Shift",
      title: "Open Lossless DICOM Chest CT Volumetric Feed",
      subtitle: "Patient #89201 | 1cm Scale Bar Calibrated",
      shortcut: "⌘D",
      icon: ScanLine,
      action: () => {
        navigate("/dashboard/imaging");
        onClose();
      }
    },
    {
      id: "renal-clearance",
      category: "Clinical Action",
      title: "Cross-Correlate Renal Clearance (eGFR) Labs",
      subtitle: "Current eGFR 28 mL/min | Dose Modification Warning",
      shortcut: "⌘R",
      icon: FlaskConical,
      action: () => {
        navigate("/dashboard/lab-results");
        onClose();
      }
    },
    {
      id: "triage-bay",
      category: "Workspace Shift",
      title: "Emergency Department Triage Acuity Board",
      subtitle: "14 Active Admissions | 2 Trauma Arrivals Pending",
      shortcut: "⌘E",
      icon: Zap,
      action: () => {
        navigate("/dashboard/requests");
        onClose();
      }
    }
  ];

  const filtered = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    const handleNav = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleNav);
    return () => window.removeEventListener("keydown", handleNav);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-black/70 backdrop-blur-md transition-opacity">
      <div className="w-full max-w-2xl bg-[#090D14] border border-[#252A35] rounded-[4px] shadow-2xl overflow-hidden font-mono">
        {/* Command Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#252A35] bg-[#0F1218]">
          <Search className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type clinical command or search patient ID..."
            className="w-full bg-transparent text-sm text-[#ECEEF2] placeholder:text-slate-500 focus:outline-none font-mono"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400 bg-[#151922] px-2 py-0.5 rounded border border-[#2F3542]">
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-[#ECEEF2] p-1 rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command Results */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 font-mono">
              No matching clinical commands or patient records found.
            </div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-start gap-3 p-3 rounded-[4px] cursor-pointer transition-colors border ${
                    isSelected
                      ? "bg-[#151922] border-cyan-500/50 text-[#ECEEF2]"
                      : "border-transparent text-slate-300 hover:bg-[#0F1218]"
                  }`}
                >
                  <div
                    className={`p-2 rounded-[2px] mt-0.5 ${
                      isSelected
                        ? "bg-cyan-500/20 text-cyan-400"
                        : "bg-[#1F232E] text-slate-400"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#ECEEF2] truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-cyan-400/80 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40 shrink-0 font-mono">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {item.subtitle}
                    </p>
                  </div>
                  {item.shortcut && (
                    <span className="text-[10px] font-mono text-slate-500 bg-[#151922] px-1.5 py-0.5 rounded border border-[#252A35] shrink-0 self-center">
                      {item.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Command Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#06080C] border-t border-[#252A35] text-[10px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Execute Intent</span>
            <span>ESC Dismiss</span>
          </div>
          <span className="text-cyan-500/80">ALERA CNOS SPEED LAYER</span>
        </div>
      </div>
    </div>
  );
};
