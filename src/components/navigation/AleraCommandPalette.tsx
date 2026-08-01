import React, { useEffect, useState } from 'react';
import { Activity, FlaskConical, Pill, ScanLine, Search, Users, X, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type CommandItem = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  href: string;
};

const commands: CommandItem[] = [
  { id: 'patients', category: 'Records', title: 'Open patient directory', subtitle: 'Search and open patient records', icon: Users, href: '/dashboard/patients' },
  { id: 'appointments', category: 'Care', title: 'Review appointments', subtitle: 'View scheduled and pending visits', icon: Activity, href: '/dashboard/appointments' },
  { id: 'prescriptions', category: 'Care', title: 'Review prescriptions', subtitle: 'Open the prescription queue', icon: Pill, href: '/dashboard/prescriptions' },
  { id: 'laboratory', category: 'Diagnostics', title: 'Review lab requests', subtitle: 'Open laboratory orders and results', icon: FlaskConical, href: '/dashboard/lab-results' },
  { id: 'imaging', category: 'Diagnostics', title: 'Review imaging requests', subtitle: 'Open imaging referrals and reports', icon: ScanLine, href: '/dashboard/imaging' },
  { id: 'emergency', category: 'Operations', title: 'Open emergency requests', subtitle: 'Review active dispatch requests', icon: Zap, href: '/dashboard/requests' },
];

export const AleraCommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const filtered = commands.filter((command) =>
    `${command.title} ${command.subtitle} ${command.category}`.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => setSelectedIndex(0), [query, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % Math.max(filtered.length, 1));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((index) => (index - 1 + filtered.length) % Math.max(filtered.length, 1));
      }
      if (event.key === 'Enter' && filtered[selectedIndex]) {
        navigate(filtered[selectedIndex].href);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, isOpen, navigate, onClose, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-4 pt-24 backdrop-blur-md">
      <div className="w-full max-w-2xl overflow-hidden rounded-[4px] border border-[#252A35] bg-[#090D14] font-mono shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[#252A35] bg-[#0F1218] px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-cyan-400" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspaces" className="w-full bg-transparent text-sm text-[#ECEEF2] placeholder:text-slate-500 focus:outline-none" />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-[#ECEEF2]" aria-label="Close command palette"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-96 space-y-1 overflow-y-auto p-2">
          {filtered.map((item, index) => {
            const Icon = item.icon;
            return <button key={item.id} onMouseEnter={() => setSelectedIndex(index)} onClick={() => { navigate(item.href); onClose(); }} className={`flex w-full items-start gap-3 rounded-[4px] border p-3 text-left ${index === selectedIndex ? 'border-cyan-500/50 bg-[#151922]' : 'border-transparent hover:bg-[#0F1218]'}`}>
              <Icon className="mt-0.5 h-4 w-4 text-cyan-400" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#ECEEF2]">{item.title}</span><span className="mt-0.5 block text-[11px] text-slate-400">{item.subtitle}</span></span>
              <span className="text-[10px] text-slate-500">{item.category}</span>
            </button>;
          })}
          {!filtered.length && <p className="py-8 text-center text-xs text-slate-500">No matching workspaces found.</p>}
        </div>
      </div>
    </div>
  );
};
