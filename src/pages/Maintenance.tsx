import React from 'react';
import { ShieldAlert, RefreshCw, Clock } from 'lucide-react';

interface MaintenancePageProps {
  message?: string;
}

const MaintenancePage: React.FC<MaintenancePageProps> = ({ 
  message = "Alera is currently undergoing scheduled node updates to optimize clinical telemetry. System access will resume shortly." 
}) => {
  return (
    <div className="alera-dark-backdrop min-h-screen text-foreground flex items-center justify-center p-6 font-body">
      <div className="max-w-md w-full bg-card rounded-surface shadow-sm p-8 text-center border border-border">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-acuity-2/20 rounded-full animate-ping opacity-25"></div>
            <div className="relative bg-paper p-4 rounded-full border border-border">
              <ShieldAlert className="h-10 w-10 text-acuity-2" />
            </div>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-foreground font-display mb-2">
          System Node Maintenance
        </h1>
        
        <p className="text-xs text-ink-soft mb-8 leading-relaxed font-light">
          {message}
        </p>
        
        <div className="grid grid-cols-1 gap-3 mb-8">
          <div className="flex items-center gap-3 p-3 bg-paper rounded-control border border-border text-left">
            <Clock className="h-4 w-4 text-ink-soft" />
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft">Estimated Duration</p>
              <p className="text-xs text-foreground font-mono">15-30 Minutes</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-paper rounded-control border border-border text-left">
            <RefreshCw className="h-4 w-4 text-acuity-3 animate-spin" />
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft font-mono">Telemetry Status</p>
              <p className="text-xs text-foreground font-mono">Auto-reconnecting to node...</p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => window.location.reload()}
          className="w-full bg-primary text-primary-foreground font-mono font-bold text-xs uppercase tracking-wider py-3 px-6 rounded-control hover:opacity-90 transition-opacity shadow-sm"
        >
          Re-poll Telemetry Node
        </button>
        
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-[10px] font-mono text-ink-soft uppercase tracking-wider">
            &copy; {new Date().getFullYear()} Alera Healthcare Infrastructure
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
