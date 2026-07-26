import React from 'react';

export default function CareNetworkGraph({ className = '' }: { className?: string }) {
  // An elegant, structured, architectural system diagram showing connected care nodes
  // cleanly aligned inside a schematic deep charcoal/obsidian container.
  return (
    <div className={`rounded border border-slate-800 bg-slate-950 p-6 text-slate-100 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
          <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">System Topology</span>
        </div>
        <span className="text-[9px] font-mono bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-800">Active Link Map</span>
      </div>

      <div className="space-y-4">
        {/* Central Infrastructure Core */}
        <div className="rounded border border-slate-700 bg-slate-900 p-4 text-center">
          <p className="text-xs font-mono font-bold text-slate-200">ALERA CORE SECURE GATEWAY</p>
          <p className="text-[10px] text-slate-400 mt-1">Multi-Node Authentication & Encryption Layer</p>
        </div>

        {/* Dynamic Topology Connections */}
        <div className="grid grid-cols-2 gap-3 text-left">
          {[
            { role: 'Clinicians', label: 'Doctor Node', active: 'Secure link established', status: 'Ready' },
            { role: 'Labs', label: 'Helix Analytics', active: 'Results channel mapped', status: 'Ready' },
            { role: 'Pharmacies', label: 'Apex Dispensary', active: 'e-Prescription pipeline active', status: 'Ready' },
            { role: 'Emergency', label: 'Ambulance Dispatch', active: 'GPS tracking sync OK', status: 'Ready' },
          ].map((node) => (
            <div key={node.role} className="rounded border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-200">{node.role}</span>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded font-semibold border border-emerald-900/50">{node.status}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{node.label}</p>
              <p className="text-[9px] text-slate-500 font-mono mt-0.5">{node.active}</p>
            </div>
          ))}
        </div>

        {/* Technical Specification Signpost */}
        <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-[9px] font-mono text-slate-500">
          <span>ALERA-NET-v2.6</span>
          <span>PROTOCOL: AES-GCM-256</span>
        </div>
      </div>
    </div>
  );
}
