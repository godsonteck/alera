import React, { useMemo, useState } from 'react';
import { Eye, Download, AlertCircle, Check, Clock, DollarSign, CreditCard, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import type { Invoice } from '@/data/mockData';

const BillingPage: React.FC = () => {
  const { user } = useAuth();
  const { invoices, getPatientBalance } = useAppData();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'outstanding' | 'overdue'>('all');

  const patientId = user?.role === 'patient' ? user.id : '';
  const patientInvoices = invoices.filter((inv) => inv.patientId === patientId);
  const totalBalance = getPatientBalance(patientId);

  const filtered = useMemo(() => {
    let result = patientInvoices;
    if (filterStatus === 'paid') result = result.filter((inv) => inv.status === 'paid');
    else if (filterStatus === 'outstanding') result = result.filter((inv) => inv.outstandingAmountGHS > 0 && inv.status !== 'overdue');
    else if (filterStatus === 'overdue') result = result.filter((inv) => inv.status === 'overdue');
    return result.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  }, [patientInvoices, filterStatus]);

  const stats = useMemo(() => ({
    totalInvoices: patientInvoices.length,
    paidAmount: patientInvoices.reduce((sum, inv) => sum + inv.amountPaidGHS, 0),
    outstandingAmount: totalBalance,
  }), [patientInvoices, totalBalance]);

  return (
    <div className="alera-feature space-y-4 text-slate-700">
      {/* Header */}
      <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#0b3d62]">Billing</span>
          <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-mono">
            {patientInvoices.length} INVOICES
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">Invoice history, payment settlements, and outstanding balance reconciliation.</p>
      </div>

      {/* Outstanding Alert */}
      {stats.outstandingAmount > 0 && (
        <div className="p-3 bg-amber-950/40 border border-amber-600/60 rounded-[2px] text-xs text-amber-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Outstanding balance: <strong className="font-bold text-white">GHS {stats.outstandingAmount.toFixed(2)}</strong></span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'TOTAL INVOICES', value: String(stats.totalInvoices), color: 'text-[#ECEEF2]' },
          { label: 'AMOUNT PAID', value: `GHS ${stats.paidAmount.toFixed(2)}`, color: 'text-emerald-400' },
          { label: 'OUTSTANDING', value: `GHS ${stats.outstandingAmount.toFixed(2)}`, color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-center">
            <div className="text-[10px] text-slate-500 uppercase">{s.label}</div>
            <div className={`text-sm font-bold font-mono mt-0.5 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {(['all', 'paid', 'outstanding', 'overdue'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1 rounded-[2px] text-xs font-mono uppercase tracking-wider border transition-colors ${
              filterStatus === st
                ? 'bg-[#151922] border-cyan-500/60 text-cyan-300 font-semibold'
                : 'bg-[#0F1218] border-[#252A35] text-slate-400 hover:text-[#ECEEF2]'
            }`}
          >
            {st === 'outstanding' ? 'PENDING' : st === 'all' ? 'ALL INVOICES' : st}
          </button>
        ))}
      </div>

      {/* Detail or List */}
      {selectedInvoice ? (
        <div className="space-y-3">
          <button onClick={() => setSelectedInvoice(null)} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-200">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to invoice list
          </button>

          <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-sm text-[#ECEEF2]">{selectedInvoice.id}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Issued: {new Date(selectedInvoice.invoiceDate).toLocaleDateString()}</div>
              </div>
              <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase border ${
                selectedInvoice.status === 'paid' ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                : selectedInvoice.status === 'overdue' ? 'bg-red-950/50 border-red-600/60 text-red-400'
                : 'bg-amber-950/50 border-amber-600/60 text-amber-300'
              }`}>
                {selectedInvoice.status}
              </span>
            </div>

            {/* Line Items */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Charges</span>
              {selectedInvoice.lineItems.map((item) => (
                <div key={item.id} className="flex justify-between p-2 bg-[#0F1218] border border-[#252A35] rounded-[2px] text-xs">
                  <span>{item.description} {item.quantity ? `(x${item.quantity})` : ''}</span>
                  <span className="font-bold font-mono">GHS {item.amountGHS.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="p-3 bg-[#0F1218] border border-[#252A35] rounded-[2px] space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span className="font-bold font-mono">GHS {selectedInvoice.totalAmountGHS.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Paid</span><span className="font-bold text-emerald-400 font-mono">GHS {selectedInvoice.amountPaidGHS.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-[#252A35] pt-1.5"><span className="font-bold">Outstanding</span><span className={`font-bold font-mono ${selectedInvoice.outstandingAmountGHS > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>GHS {selectedInvoice.outstandingAmountGHS.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
              No invoices match the current filter criteria.
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => setSelectedInvoice(invoice)}
                  className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] hover:border-cyan-500/50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div>
                    <div className="font-bold text-[#ECEEF2]">{invoice.id}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {new Date(invoice.invoiceDate).toLocaleDateString()} • Due: {new Date(invoice.dueDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold font-mono text-[#ECEEF2]">GHS {invoice.totalAmountGHS.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {invoice.outstandingAmountGHS > 0 ? `GHS ${invoice.outstandingAmountGHS.toFixed(2)} due` : 'Settled'}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${
                      invoice.status === 'paid' ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                      : invoice.status === 'overdue' ? 'bg-red-950/50 border-red-600/60 text-red-400'
                      : 'bg-amber-950/50 border-amber-600/60 text-amber-300'
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BillingPage;
