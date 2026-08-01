import { useState, useMemo } from 'react';
import { Package, Search, AlertTriangle, Check, Download, TrendingDown, DollarSign, Calendar, Inbox, Pill, Zap, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { toast } from '@/components/ui/use-toast';
import type { InventoryItem } from '@/data/mockData';

const InventoryPage = () => {
  const { user } = useAuth();
  const { inventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useAppData();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'value' | 'expiry'>('name');
  const [showCreate, setShowCreate] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '', category: 'medication' as InventoryItem['category'], stock: 0, reorderLevel: 10,
    price: 0, unit: 'packs', expiryDate: '', supplier: '',
  });

  const isPharmacy = user?.role === 'pharmacy';

  const expiringItems = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return inventoryItems.filter(item => {
      if (!item.expiryDate) return false;
      const expiryDate = new Date(item.expiryDate);
      return expiryDate <= thirtyDaysFromNow && expiryDate > today;
    });
  }, [inventoryItems]);

  const expiredItems = useMemo(() => {
    const today = new Date();
    return inventoryItems.filter(item => {
      if (!item.expiryDate) return false;
      return new Date(item.expiryDate) <= today;
    });
  }, [inventoryItems]);

  const filtered = useMemo(() => {
    const rows = inventoryItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
    return [...rows].sort((left, right) => {
      if (sortBy === 'stock') return right.stock - left.stock;
      if (sortBy === 'value') return (right.stock * right.price) - (left.stock * left.price);
      if (sortBy === 'expiry') {
        const leftTime = left.expiryDate ? new Date(left.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        const rightTime = right.expiryDate ? new Date(right.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        return leftTime - rightTime;
      }
      return left.name.localeCompare(right.name);
    });
  }, [inventoryItems, search, categoryFilter, statusFilter, sortBy]);

  const stats = useMemo(() => {
    return {
      totalItems: inventoryItems.length,
      inStock: inventoryItems.filter(i => i.status === 'in-stock').length,
      lowStock: inventoryItems.filter(i => i.status === 'low-stock').length,
      outOfStock: inventoryItems.filter(i => i.status === 'out-of-stock').length,
      totalValue: inventoryItems.reduce((sum, i) => sum + i.stock * i.price, 0),
    };
  }, [inventoryItems]);

  const handleUpdateStock = (item: InventoryItem, newStock: number) => {
    const status = newStock === 0 ? 'out-of-stock' : newStock < item.reorderLevel ? 'low-stock' : 'in-stock';
    updateInventoryItem(item.id, () => ({
      ...item, stock: newStock, lastRestocked: newStock > item.stock ? new Date().toISOString() : item.lastRestocked, status,
    }));
    toast({ title: 'Inventory updated', description: `${item.name} stock is now ${newStock} ${item.unit}.` });
  };

  const handleCreateItem = () => {
    if (!newItem.name.trim() || newItem.price <= 0 || newItem.stock < 0 || newItem.reorderLevel < 0) {
      toast({ title: 'Invalid inventory item', description: 'Check required fields.', variant: 'destructive' });
      return;
    }
    const status: InventoryItem['status'] = newItem.stock === 0 ? 'out-of-stock' : newItem.stock < newItem.reorderLevel ? 'low-stock' : 'in-stock';
    addInventoryItem({
      id: `inv-${crypto.randomUUID()}`, name: newItem.name.trim(), category: newItem.category, stock: newItem.stock,
      reorderLevel: newItem.reorderLevel, price: newItem.price, unit: newItem.unit.trim() || 'packs',
      expiryDate: newItem.expiryDate || undefined, supplier: newItem.supplier.trim() || undefined,
      lastRestocked: new Date().toISOString(), status,
    });
    setNewItem({ name: '', category: 'medication', stock: 0, reorderLevel: 10, price: 0, unit: 'packs', expiryDate: '', supplier: '' });
    setShowCreate(false);
    toast({ title: 'Item saved', description: `${newItem.name.trim()} was added to inventory.` });
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast({ title: 'Nothing to export', description: 'No inventory data is available.', variant: 'destructive' });
      return;
    }
    const rows = filtered.map(item => [item.name, item.category, item.stock, item.unit, item.reorderLevel, item.price.toFixed(2), (item.stock * item.price).toFixed(2), item.status, item.expiryDate ?? '', item.supplier ?? '']);
    const csv = [['Name', 'Category', 'Stock', 'Unit', 'Reorder Level', 'Unit Price', 'Total Value', 'Status', 'Expiry Date', 'Supplier'].join(','), ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export ready', description: 'Inventory saved as CSV.' });
  };

  const categoryIcons = { medication: <Pill className="w-3 h-3" />, supply: <Package className="w-3 h-3" />, equipment: <Zap className="w-3 h-3" /> };

  if (!isPharmacy) {
    return (
      <div className="p-8 bg-[#090D14] border border-red-600/60 rounded-[4px] text-center font-mono text-xs text-red-400 space-y-2">
        <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
        <div className="font-bold uppercase">ACCESS DENIED</div>
        <p className="text-slate-500">Only authorized pharmacy accounts can access inventory.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Pharmacy Logistics Engine</span>
            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-mono">
              {stats.totalItems} ITEMS
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Global ledger for pharmaceutical stock and biomedical equipment.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-emerald-500/60 text-emerald-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors">
            {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showCreate ? 'CANCEL' : 'ADD ITEM'}</span>
          </button>
          <button onClick={handleExportCsv} className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-[#2F3542] text-slate-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors">
            <Download className="w-4 h-4" />
            <span>EXPORT</span>
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-4">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">Log New Inventory Asset</span>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="lg:col-span-2">
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Asset Name *</label>
              <input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Category</label>
              <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value as InventoryItem['category'] })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]">
                <option value="medication">MEDICATION</option><option value="supply">SUPPLY</option><option value="equipment">EQUIPMENT</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Unit Type</label>
              <input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Current Stock *</label>
              <input type="number" value={newItem.stock} onChange={(e) => setNewItem({ ...newItem, stock: Number(e.target.value) })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Reorder Threshold *</label>
              <input type="number" value={newItem.reorderLevel} onChange={(e) => setNewItem({ ...newItem, reorderLevel: Number(e.target.value) })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Unit Price ($) *</label>
              <input type="number" step="0.01" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Expiry date</label>
              <input type="date" value={newItem.expiryDate} onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2] font-mono" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Supplier Tag</label>
              <input value={newItem.supplier} onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })} className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]" />
            </div>
          </div>
          <button onClick={handleCreateItem} className="w-full bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs">
            Save item
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[2px] flex flex-col items-center">
          <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><Check className="w-3 h-3" /> ACTIVE STOCK</div>
          <div className="text-xl font-bold font-mono text-emerald-400">{stats.inStock}</div>
        </div>
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[2px] flex flex-col items-center">
          <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> LOW STOCK</div>
          <div className="text-xl font-bold font-mono text-amber-400">{stats.lowStock}</div>
        </div>
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[2px] flex flex-col items-center">
          <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> OUT OF STOCK</div>
          <div className="text-xl font-bold font-mono text-red-400">{stats.outOfStock}</div>
        </div>
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[2px] flex flex-col items-center">
          <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> ASSET VALUE</div>
          <div className="text-xl font-bold font-mono text-cyan-400">${stats.totalValue.toFixed(0)}</div>
        </div>
      </div>

      {/* Warnings */}
      {(expiredItems.length > 0 || expiringItems.length > 0) && (
        <div className="space-y-2">
          {expiredItems.length > 0 && (
            <div className="p-3 bg-red-950/40 border border-red-600/60 rounded-[2px] text-xs space-y-1 text-red-300">
              <div className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> [CRITICAL] EXPIRED ASSETS DETECTED</div>
              <ul className="pl-6 list-disc text-red-400/80">
                {expiredItems.map(item => <li key={item.id} className="font-mono">{item.name} (Expired: {new Date(item.expiryDate!).toISOString().split('T')[0]})</li>)}
              </ul>
            </div>
          )}
          {expiringItems.length > 0 && (
            <div className="p-3 bg-amber-950/40 border border-amber-600/60 rounded-[2px] text-xs space-y-1 text-amber-300">
              <div className="font-bold flex items-center gap-2"><Calendar className="w-4 h-4" /> [WARN] ASSETS NEARING EXPIRATION T-30</div>
              <ul className="pl-6 list-disc text-amber-400/80">
                {expiringItems.map(item => <li key={item.id} className="font-mono">{item.name} (Expires: {new Date(item.expiryDate!).toISOString().split('T')[0]})</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="QUERY INVENTORY..." className="w-full h-8 pl-8 pr-3 rounded-[2px] border border-[#252A35] bg-[#090D14] text-[#ECEEF2] text-xs placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none" />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-8 px-2 rounded-[2px] border border-[#252A35] bg-[#090D14] text-xs text-[#ECEEF2] uppercase font-bold tracking-wider">
          <option value="all">ALL CAT</option><option value="medication">MEDICATION</option><option value="supply">SUPPLY</option><option value="equipment">EQUIPMENT</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-8 px-2 rounded-[2px] border border-[#252A35] bg-[#090D14] text-xs text-[#ECEEF2] uppercase font-bold tracking-wider">
          <option value="all">ALL STAT</option><option value="in-stock">ACTIVE</option><option value="low-stock">LOW</option><option value="out-of-stock">EMPTY</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'stock' | 'value' | 'expiry')} className="h-8 px-2 rounded-[2px] border border-[#252A35] bg-[#090D14] text-xs text-[#ECEEF2] uppercase font-bold tracking-wider">
          <option value="name">SORT: ID</option><option value="stock">SORT: VOL</option><option value="value">SORT: VAL</option><option value="expiry">SORT: EXP</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          NO MATCHING INVENTORY RECORDS LOCATED
        </div>
      ) : (
        <div className="bg-[#090D14] border border-[#252A35] rounded-[4px] overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#252A35] bg-[#0F1218]">
                <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">ASSET</th>
                <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">TYPE</th>
                <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-center">VOL</th>
                <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-center">R-LVL</th>
                <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-right">UNIT ($)</th>
                <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">EXP</th>
                <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider">STAT</th>
                <th className="px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252A35]">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[#0F1218] transition-colors">
                  <td className="px-3 py-2">
                    <div className="font-bold text-[#ECEEF2]">{item.name}</div>
                    {item.lastRestocked && <div className="text-[9px] text-slate-500 font-mono">RS: {new Date(item.lastRestocked).toISOString().split('T')[0]}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-bold uppercase">
                      {categoryIcons[item.category as keyof typeof categoryIcons]} {item.category}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="font-bold font-mono text-[#ECEEF2]">{item.stock}</div>
                    <div className="text-[9px] text-slate-500 uppercase">{item.unit}</div>
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-slate-400">{item.reorderLevel}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#ECEEF2]">{item.price.toFixed(2)}</td>
                  <td className="px-3 py-2 font-mono text-slate-400 text-[10px]">
                    {item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : 'N/A'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold uppercase border ${
                      item.status === 'in-stock' ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                      : item.status === 'low-stock' ? 'bg-amber-950/50 border-amber-600/60 text-amber-300'
                      : 'bg-red-950/50 border-red-600/60 text-red-400'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right space-x-1">
                    {item.status !== 'in-stock' && (
                      <button onClick={() => handleUpdateStock(item, item.stock + 10)} className="px-1.5 py-0.5 bg-emerald-950/60 border border-emerald-600/60 text-emerald-400 text-[9px] font-bold rounded-[2px] uppercase">+10</button>
                    )}
                    {item.stock > 0 && (
                      <button onClick={() => handleUpdateStock(item, item.stock - 1)} className="px-1.5 py-0.5 bg-amber-950/60 border border-amber-600/60 text-amber-400 text-[9px] font-bold rounded-[2px] uppercase">-1</button>
                    )}
                    <button onClick={() => deleteInventoryItem(item.id)} className="px-1.5 py-0.5 bg-red-950/60 border border-red-600/60 text-red-400 text-[9px] font-bold rounded-[2px] uppercase"><Trash2 className="w-3 h-3 inline-block" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
