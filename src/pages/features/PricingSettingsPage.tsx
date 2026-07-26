import React, { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, DollarSign, AlertCircle, Check, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import type { ProviderPricing } from '@/data/mockData';

const PricingSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { providerPricing, setProviderPricing, deleteProviderPricing } = useAppData();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<'all' | ProviderPricing['serviceType']>('all');
  
  const doctorId = user?.role === 'doctor' ? user.id : '';
  const doctorName = user?.name || 'Current Provider';
  
  const myPricing = providerPricing.filter((p) => p.providerId === doctorId);
  const filteredPricing = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return myPricing
      .filter((pricing) => serviceTypeFilter === 'all' || pricing.serviceType === serviceTypeFilter)
      .filter((pricing) => (!q || pricing.serviceDescription.toLowerCase().includes(q) || pricing.serviceType.toLowerCase().includes(q) || (pricing.notes || '').toLowerCase().includes(q)))
      .sort((l, r) => new Date(r.lastUpdated).getTime() - new Date(l.lastUpdated).getTime());
  }, [myPricing, searchQuery, serviceTypeFilter]);
  
  const [formData, setFormData] = useState({
    serviceType: 'consultation' as 'consultation' | 'procedure' | 'test' | 'imaging' | 'follow-up' | 'other',
    serviceDescription: '', priceGHS: 0, notes: '',
  });

  const serviceTypes: Array<'consultation' | 'procedure' | 'test' | 'imaging' | 'follow-up' | 'other'> = ['consultation', 'procedure', 'test', 'imaging', 'follow-up', 'other'];

  const handleAddPrice = () => {
    if (!doctorId) { toast({ title: 'Auth fault', description: 'Provider session missing.', variant: 'destructive' }); return; }
    if (!formData.serviceDescription || formData.priceGHS <= 0) { toast({ title: 'Validation fault', description: 'Description and non-zero price required.', variant: 'destructive' }); return; }

    const normalizedDescription = formData.serviceDescription.trim().toLowerCase();
    const duplicatePricing = myPricing.find((pricing) => (pricing.id !== editingId && pricing.serviceType === formData.serviceType && pricing.serviceDescription.trim().toLowerCase() === normalizedDescription));

    if (duplicatePricing) { toast({ title: 'Duplicate detected', description: 'Service configuration already exists.', variant: 'destructive' }); return; }

    const newPricing: ProviderPricing = {
      id: editingId || `pricing-${Date.now()}`, providerId: doctorId, providerName: doctorName,
      serviceType: formData.serviceType, serviceDescription: formData.serviceDescription, priceGHS: formData.priceGHS,
      lastUpdated: new Date().toISOString().split('T')[0], currency: 'GHS', notes: formData.notes || undefined,
    };

    setProviderPricing(newPricing);
    toast({ title: editingId ? 'Pricing updated' : 'Pricing added', description: 'Service catalog synchronized.' });
    setFormData({ serviceType: 'consultation', serviceDescription: '', priceGHS: 0, notes: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (pricing: ProviderPricing) => {
    setFormData({ serviceType: pricing.serviceType, serviceDescription: pricing.serviceDescription, priceGHS: pricing.priceGHS, notes: pricing.notes || '' });
    setEditingId(pricing.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    deleteProviderPricing(id);
    setPendingDeleteId(null);
    toast({ title: 'Pricing removed', description: 'Service deleted from catalog.' });
  };

  const totalServices = myPricing.length;
  const avgPrice = myPricing.length > 0 ? Math.round(myPricing.reduce((sum, p) => sum + p.priceGHS, 0) / myPricing.length) : 0;

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Service Catalog & Pricing</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Configure clinical service offerings and financial parameters (GHS).</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ serviceType: 'consultation', serviceDescription: '', priceGHS: 0, notes: '' }); }}
          className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors uppercase tracking-wider"
        >
          {showForm && !editingId ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showForm && !editingId ? 'CANCEL' : 'ADD SERVICE'}</span>
        </button>
      </div>

      <AlertDialog open={Boolean(pendingDeleteId)} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent className="bg-[#090D14] border-[#252A35] rounded-[4px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 font-mono font-bold uppercase">PURGE SERVICE CONFIGURATION?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 font-mono text-xs">
              This financial parameter will be permanently removed from the active catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#151922] border-[#2F3542] text-slate-300 font-bold rounded-[2px] hover:bg-slate-800 hover:text-white uppercase text-xs">CANCEL</AlertDialogCancel>
            <AlertDialogAction className="bg-red-950/80 border border-red-600/60 text-red-300 font-bold rounded-[2px] hover:bg-red-900 uppercase text-xs" onClick={() => pendingDeleteId ? handleDelete(pendingDeleteId) : undefined}>
              PURGE DATA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-center">
          <div className="text-[9px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1">TOTAL SERVICES</div>
          <div className="text-xl font-bold font-mono text-[#ECEEF2] mt-0.5">{totalServices}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-cyan-600/40 rounded-[2px] text-center">
          <div className="text-[9px] text-cyan-500 uppercase font-bold flex items-center justify-center gap-1"><DollarSign className="w-3 h-3" /> MEAN VALUE</div>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">GHS {avgPrice}</div>
        </div>
        <div className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-center">
          <div className="text-[9px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1">CURRENCY BASE</div>
          <div className="text-xl font-bold font-mono text-slate-400 mt-0.5">GHS</div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <div className="flex items-center justify-between border-b border-[#252A35] pb-2">
            <span className="text-xs font-bold uppercase text-cyan-400">{editingId ? 'MODIFY CONFIGURATION' : 'NEW SERVICE CONFIGURATION'}</span>
            {editingId && <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>}
          </div>
          
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Service Classification</label>
              <select value={formData.serviceType} onChange={(e) => setFormData(cur => ({...cur, serviceType: e.target.value as ProviderPricing['serviceType']}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] uppercase">
                {serviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Value (GHS) *</label>
              <input type="number" min="0" step="0.01" value={formData.priceGHS} onChange={(e) => setFormData(cur => ({...cur, priceGHS: parseFloat(e.target.value) || 0}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Service Descriptor *</label>
              <input value={formData.serviceDescription} onChange={(e) => setFormData(cur => ({...cur, serviceDescription: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Constraints / Notes</label>
              <input value={formData.notes} onChange={(e) => setFormData(cur => ({...cur, notes: e.target.value}))} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
          </div>
          
          <button onClick={handleAddPrice} className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> COMMIT CONFIGURATION
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="QUERY CATALOG..."
            className="w-full h-8 pl-8 pr-3 rounded-[2px] border border-[#252A35] bg-[#090D14] text-[#ECEEF2] text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <select value={serviceTypeFilter} onChange={(e) => setServiceTypeFilter(e.target.value as 'all' | ProviderPricing['serviceType'])} className="h-8 px-2 rounded-[2px] border border-[#252A35] bg-[#090D14] text-xs text-[#ECEEF2] uppercase font-bold tracking-wider">
          <option value="all">ALL CLASSES</option>
          {serviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="bg-[#090D14] border border-[#252A35] rounded-[4px] overflow-hidden">
        {myPricing.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">
            CATALOG EMPTY. CONFIGURE SERVICES TO BEGIN.
          </div>
        ) : filteredPricing.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">
            NO SERVICES MATCH QUERY PARAMETERS.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#252A35] bg-[#0F1218]">
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">DESCRIPTOR</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">CLASS</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">MODIFIED</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-right">VALUE (GHS)</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-right">OPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252A35]">
                {filteredPricing.map((pricing) => (
                  <tr key={pricing.id} className="hover:bg-[#0F1218] transition-colors">
                    <td className="px-3 py-2">
                      <div className="font-bold text-[#ECEEF2]">{pricing.serviceDescription}</div>
                      {pricing.notes && <div className="text-[10px] text-slate-500 mt-0.5">{pricing.notes}</div>}
                    </td>
                    <td className="px-3 py-2 font-bold text-cyan-400 text-[10px] uppercase">{pricing.serviceType}</td>
                    <td className="px-3 py-2 font-mono text-slate-500 text-[10px]">{pricing.lastUpdated}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-400 font-bold">{pricing.priceGHS.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right space-x-1">
                      <button onClick={() => handleEdit(pricing)} className="px-1.5 py-0.5 bg-[#151922] border border-[#2F3542] text-slate-300 text-[10px] font-bold rounded-[2px] hover:bg-slate-800 transition-colors uppercase"><Edit2 className="w-3 h-3" /></button>
                      <button onClick={() => setPendingDeleteId(pricing.id)} className="px-1.5 py-0.5 bg-red-950/60 border border-red-600/60 text-red-400 text-[10px] font-bold rounded-[2px] hover:bg-red-900 transition-colors uppercase"><Trash2 className="w-3 h-3" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-3 bg-cyan-950/20 border border-cyan-900/40 rounded-[2px] text-[10px] text-cyan-500/80 uppercase leading-relaxed flex gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-1">SYSTEM OVERSIGHT</span>
          All financial configurations are logged by the system matrix. Parameter changes deploy immediately.
        </div>
      </div>
    </div>
  );
};

export default PricingSettingsPage;
