import React, { useMemo, useState } from 'react';
import { AlertCircle, BarChart3, Download, Eye, TrendingUp, Users, Clock, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { useAppData } from '@/contexts/useAppData';

const AdminBillingDashboard: React.FC = () => {
  const { providerPricing, invoices, getAllBillingRecords } = useAppData();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'providers' | 'billing' | 'audit'>('overview');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const allRecords = getAllBillingRecords();

  const stats = useMemo(() => ({
    totalProviders: new Set(providerPricing.map((p) => p.providerId)).size,
    totalPricingServices: providerPricing.length,
    totalInvoices: invoices.length,
    totalIssued: invoices.reduce((sum, inv) => sum + inv.totalAmountGHS, 0),
    totalCollected: invoices.reduce((sum, inv) => sum + inv.amountPaidGHS, 0),
    totalOutstanding: invoices.reduce((sum, inv) => sum + inv.outstandingAmountGHS, 0),
    overdueBills: invoices.filter((inv) => inv.status === 'overdue').length,
  }), [providerPricing, invoices]);

  const providers = useMemo(() => Array.from(new Set(providerPricing.map((p) => p.providerId))).map((id) => {
    const pricing = providerPricing.filter((p) => p.providerId === id);
    return { id, name: pricing[0]?.providerName || id, totalServices: pricing.length, avgPrice: pricing.reduce((sum, p) => sum + p.priceGHS, 0) / pricing.length, pricing };
  }), [providerPricing]);

  const providerRecords = useMemo(() => selectedProvider ? allRecords.filter((r) => r.affectedProviderId === selectedProvider) : allRecords, [selectedProvider, allRecords]);
  const overdueInvoices = useMemo(() => invoices.filter((inv) => inv.status === 'overdue').sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()), [invoices]);
  const collectionRate = stats.totalIssued > 0 ? ((stats.totalCollected / stats.totalIssued) * 100).toFixed(1) : '0';

  return (
    <div className="alera-feature space-y-6 text-slate-800">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-[#0b3d62]">Billing</h1>
        <p className="mt-1 text-sm text-slate-600">Review providers, invoices, pricing, and payment activity.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-center">
          <div className="text-[9px] text-slate-500 font-bold flex items-center justify-center gap-1"><Users className="w-3 h-3" /> Active providers</div>
          <div className="text-xl font-bold font-mono text-[#ECEEF2] mt-0.5">{stats.totalProviders}</div>
          <div className="text-[9px] text-slate-600 mt-1">{stats.totalPricingServices} services listed</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-cyan-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-cyan-500 font-bold flex items-center justify-center gap-1"><BarChart3 className="w-3 h-3" /> Total invoiced</div>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">₵{stats.totalIssued.toFixed(0)}</div>
          <div className="text-[9px] text-cyan-700 mt-1 uppercase">{stats.totalInvoices} TRANSACTIONS</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-emerald-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-emerald-500 font-bold flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" /> Collected</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">₵{stats.totalCollected.toFixed(0)}</div>
          <div className="text-[9px] text-emerald-700 mt-1 uppercase">{collectionRate}% CAPTURE RATE</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-red-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-red-500 font-bold flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Outstanding</div>
          <div className="text-xl font-bold font-mono text-red-400 mt-0.5">₵{stats.totalOutstanding.toFixed(0)}</div>
          <div className="text-[9px] text-red-700 mt-1 uppercase">{stats.overdueBills} DELINQUENT ITEMS</div>
        </div>
      </div>

      {stats.overdueBills > 0 && (
        <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-[2px] text-[10px] text-red-500/80 uppercase leading-relaxed flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" />
          <div>
            <span className="font-bold text-red-700 block mb-1">Overdue invoices need attention</span>
            {stats.overdueBills} invoices are overdue. Review their outstanding balances and follow up as needed.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(['overview', 'providers', 'billing', 'audit'] as const).map((tab) => (
          <button key={tab} onClick={() => { setSelectedTab(tab); setSelectedProvider(null); }} className={`px-3 py-1.5 rounded-[2px] text-[10px] font-bold tracking-wider uppercase transition-colors border ${selectedTab === tab ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-400' : 'bg-[#0F1218] border-[#252A35] text-slate-500 hover:text-slate-300 hover:border-slate-600'}`}>
            {tab === 'billing' ? 'Invoices & pricing' : tab}
          </button>
        ))}
      </div>

      <div className="bg-[#090D14] border border-[#252A35] rounded-[4px] p-4">
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            <span className="text-xs font-bold text-slate-600 block border-b border-[#252A35] pb-2">Summary</span>
            <div className="grid md:grid-cols-3 gap-2">
              <div className="p-4 bg-[#0F1218] border border-[#252A35] rounded-[2px]">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">TOTAL INVOICED VOLUME</div>
                <div className="text-2xl font-bold font-mono text-[#ECEEF2]">₵{stats.totalIssued.toFixed(2)}</div>
              </div>
              <div className="p-4 bg-emerald-950/10 border border-emerald-900/30 rounded-[2px]">
                <div className="text-[10px] text-emerald-600 font-bold mb-1">Collected</div>
                <div className="text-2xl font-bold font-mono text-emerald-500">₵{stats.totalCollected.toFixed(2)}</div>
              </div>
              <div className="p-4 bg-red-950/10 border border-red-900/30 rounded-[2px]">
                <div className="text-[10px] text-red-600 font-bold mb-1">Outstanding</div>
                <div className="text-2xl font-bold font-mono text-red-500">₵{stats.totalOutstanding.toFixed(2)}</div>
              </div>
            </div>

            {overdueInvoices.length > 0 && (
              <div className="mt-6">
                <span className="text-xs font-bold uppercase text-red-400 flex items-center gap-2 border-b border-red-900/40 pb-2 mb-3"><AlertTriangle className="w-4 h-4" /> PRIORITY ACTION REQD: DELINQUENT TRANSACTIONS</span>
                <div className="space-y-2">
                  {overdueInvoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="p-3 bg-red-950/20 border border-red-900/40 rounded-[2px] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-red-300 font-mono text-[11px]">{invoice.id}</div>
                        <div className="text-[10px] text-red-500/80 uppercase mt-1">ENTITY: {invoice.patientName} <span className="mx-2">|</span> DUE: {new Date(invoice.dueDate).toISOString().split('T')[0]}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-bold text-red-400 font-mono">₵{invoice.outstandingAmountGHS.toFixed(2)}</div>
                        <div className="text-[9px] text-red-600 uppercase mt-1">LATE: {Math.ceil((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))} DAYS</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'providers' && (
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-600 block border-b border-[#252A35] pb-2">Providers</span>
            {providers.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No providers found.</div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {providers.map((provider) => (
                  <div key={provider.id} onClick={() => { setSelectedProvider(provider.id); setSelectedTab('billing'); }} className="p-4 bg-[#0F1218] border border-[#252A35] rounded-[2px] cursor-pointer hover:border-cyan-600/40 transition-colors flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#ECEEF2] text-xs uppercase">{provider.name}</div>
                      <div className="text-[9px] text-slate-500 uppercase mt-1 font-mono">ID: {provider.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-cyan-400 font-mono">{provider.totalServices} services</div>
                      <div className="text-[9px] text-slate-500 uppercase mt-1">MEAN: ₵{provider.avgPrice.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'billing' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#252A35] pb-2">
              <span className="text-xs font-bold text-slate-600">Invoices and pricing: {selectedProvider ? providers.find(p => p.id === selectedProvider)?.name || 'Unknown provider' : 'All providers'}</span>
              {selectedProvider && <button onClick={() => setSelectedProvider(null)} className="text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase">CLEAR FILTER</button>}
            </div>

            <div className="border border-[#252A35] rounded-[2px] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0F1218] border-b border-[#252A35]">
                  <tr>
                    <th className="px-3 py-2 font-bold text-slate-600">Provider</th>
                    <th className="px-3 py-2 font-bold text-slate-600">Service</th>
                    <th className="px-3 py-2 font-bold text-slate-600">Type</th>
                    <th className="px-3 py-2 font-bold text-slate-600 text-right">Price (GHS)</th>
                    <th className="px-3 py-2 font-bold text-slate-600">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252A35]">
                  {(selectedProvider ? providers.find(p => p.id === selectedProvider)?.pricing || [] : providerPricing).map(pricing => (
                    <tr key={pricing.id} className="hover:bg-[#0F1218]">
                      <td className="px-3 py-2 font-bold text-[#ECEEF2] uppercase text-[10px]">{pricing.providerName}</td>
                      <td className="px-3 py-2 text-slate-300 uppercase text-[10px]">{pricing.serviceDescription}</td>
                      <td className="px-3 py-2 text-slate-500 uppercase text-[9px]">{pricing.serviceType}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-cyan-400">{(pricing.priceGHS || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono text-slate-500 text-[10px]">{new Date(pricing.lastUpdated).toISOString().split('T')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedProvider && (
              <div className="mt-6 space-y-3">
                <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">LINKED TRANSACTIONS</span>
                <div className="space-y-2">
                  {invoices.slice(0, 5).map(inv => (
                    <div key={inv.id} className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#ECEEF2] font-mono text-[11px]">{inv.id}</div>
                        <div className="text-[10px] text-slate-500 uppercase mt-1">ENTITY: {inv.patientName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-cyan-400 font-mono">₵{inv.totalAmountGHS.toFixed(2)}</div>
                        <div className={`text-[9px] uppercase font-bold mt-1 ${inv.status === 'paid' ? 'text-emerald-500' : inv.status === 'overdue' ? 'text-red-500' : 'text-amber-500'}`}>{inv.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#252A35] pb-2">
              <span className="text-xs font-bold uppercase text-slate-400">FINANCIAL EVENT LOG</span>
              <button className="text-[10px] font-bold text-slate-500 hover:text-slate-300 flex items-center gap-1 uppercase"><Download className="w-3 h-3" /> EXPORT DUMP</button>
            </div>
            
            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
              {providerRecords.length === 0 ? (
                <div className="p-8 text-center text-[10px] text-slate-500 uppercase border border-[#252A35] rounded-[2px]">NO EVENTS LOGGED.</div>
              ) : (
                providerRecords.slice(0, 30).map(record => (
                  <div key={record.id} className="p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] flex items-start gap-3">
                    <Clock className="w-3.5 h-3.5 text-slate-600 mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">{record.action.replace(/-/g, ' ')}</span>
                        {record.amountGHS && <span className="font-mono text-[10px] font-bold text-[#ECEEF2]">₵{record.amountGHS.toFixed(2)}</span>}
                      </div>
                      <div className="text-[9px] text-slate-400 uppercase mt-1 truncate">{record.details}</div>
                      <div className="text-[9px] text-slate-600 font-mono mt-1">TX: {new Date(record.timestamp).toISOString().replace('T', ' ').slice(0, 19)} | OP: {record.actionByName.toUpperCase()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBillingDashboard;
