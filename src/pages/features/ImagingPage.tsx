import { startTransition, useDeferredValue, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock3, Download, FileImage, FileText, Inbox, Plus, ScanLine, Search, Trash2, Upload, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { useNotifications } from '@/contexts/useNotifications';
import { type ImagingScan } from '@/data/mockData';
import { getDoctorPatients } from '@/lib/patientDirectory';
import { getVisibleImagingScans } from '@/lib/recordVisibility';
import { getReferralDestinationProviders } from '@/lib/referralUtils';
import { normalizeUserRole } from '@/lib/roleUtils';
import { api } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';

const SCAN_TYPES: ImagingScan['scanType'][] = ['X-Ray', 'MRI', 'CT Scan', 'Ultrasound', 'PET Scan', 'DEXA Scan'];

const formatDateTime = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const toDateInputValue = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60_000));
  return local.toISOString().slice(0, 16);
};

interface ImagingPageProps {
  page?: string;
}

const ImagingPage = ({ page }: ImagingPageProps) => {
  const { user, getUsers } = useAuth();
  const { appointments, imagingScans, addImagingScan, updateImagingScan, refreshAppData } = useAppData();
  const { addNotification } = useNotifications();
  const [searchParams] = useSearchParams();
  const [showUpload, setShowUpload] = useState<string | null>(null);
  const [showOrder, setShowOrder] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ImagingScan['status']>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'scheduled' | 'patient' | 'status'>('newest');

  const [orderForm, setOrderForm] = useState({
    patientId: '',
    imagingCenterId: '',
    scanType: 'MRI' as ImagingScan['scanType'],
    bodyPart: '',
    clinicalIndication: '',
  });

  const [uploadForm, setUploadForm] = useState({
    results: '',
    impression: '',
    dicomUrl: '',
    postdicomStudyUrl: '',
    imageFiles: [] as File[],
    reportFile: null as File | null,
  });

  const focusId = searchParams.get('focus');
  const effectiveRole = normalizeUserRole(user?.role) ?? user?.role;
  const currentPage = page ?? (user?.role === 'imaging' ? 'scan-requests' : effectiveRole === 'doctor' ? 'imaging-referrals' : 'imaging');
  const deferredSearch = useDeferredValue(searchTerm);

  const users = getUsers();
  const patientOptions = useMemo(() => getDoctorPatients(users, appointments, user?.id), [appointments, user?.id, users]);
  const imagingCenterOptions = useMemo(() => getReferralDestinationProviders(users, 'imaging'), [users]);
  const visibleScans = useMemo(() => getVisibleImagingScans(imagingScans, user), [imagingScans, user]);

  const filteredScans = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const list = visibleScans.filter((scan) => {
      const matchesStatus = statusFilter === 'all' || scan.status === statusFilter;
      const matchesQuery = !query
        || scan.scanType.toLowerCase().includes(query)
        || (scan.bodyPart || '').toLowerCase().includes(query)
        || scan.patientName.toLowerCase().includes(query)
        || scan.doctorName.toLowerCase().includes(query)
        || (scan.destinationProviderName || '').toLowerCase().includes(query)
        || (scan.results || '').toLowerCase().includes(query)
        || (scan.impression || '').toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'scheduled') return (b.scheduledAt || b.date).localeCompare(a.scheduledAt || a.date);
      if (sortBy === 'patient') return a.patientName.localeCompare(b.patientName);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return b.date.localeCompare(a.date);
    });
  }, [deferredSearch, statusFilter, sortBy, visibleScans]);

  const handleOrder = async () => {
    if (!orderForm.patientId || !orderForm.imagingCenterId || !orderForm.scanType || !user?.id) {
      toast({ title: 'Missing parameters', description: 'Select patient, imaging center, and scan type.', variant: 'destructive' });
      return;
    }
    const patient = patientOptions.find((p) => p.id === orderForm.patientId);
    const center = imagingCenterOptions.find((c) => c.id === orderForm.imagingCenterId);
    if (!patient || !center) return;

    try {
      await api.imaging.orderImagingScan({
        patient_id: Number(orderForm.patientId),
        destination_provider_id: Number(center.id),
        scan_type: orderForm.scanType,
        body_part: orderForm.bodyPart.trim() || undefined,
        clinical_indication: orderForm.clinicalIndication.trim() || undefined,
      });

      addImagingScan({
        id: `img-${Date.now()}`,
        scanType: orderForm.scanType,
        bodyPart: orderForm.bodyPart.trim() || undefined,
        clinicalIndication: orderForm.clinicalIndication.trim() || undefined,
        patientId: patient.id,
        patientName: patient.name,
        doctorId: user.id,
        doctorName: user.name,
        centerId: center.id,
        destinationProviderName: center.name,
        date: new Date().toISOString().split('T')[0],
        status: 'requested',
      });

      addNotification({
        title: 'Imaging Requisitioned',
        message: `${orderForm.scanType} ordered for ${patient.name}.`,
        type: 'result',
        priority: 'high',
        audience: 'personal',
      });

      await refreshAppData();
      setShowOrder(false);
      setOrderForm({ patientId: '', imagingCenterId: '', scanType: 'MRI', bodyPart: '', clinicalIndication: '' });
    } catch (err) {
      toast({ title: 'Order Failed', description: handleApiError(err, 'order scan'), variant: 'destructive' });
    }
  };

  const handleSaveResults = (scanId: string) => {
    updateImagingScan(scanId, (prev) => ({
      ...prev,
      status: 'completed',
      results: uploadForm.results.trim() || prev.results,
      impression: uploadForm.impression.trim() || prev.impression,
      imageUrl: uploadForm.dicomUrl.trim() || prev.imageUrl,
      postdicomStudyUrl: uploadForm.postdicomStudyUrl.trim() || prev.postdicomStudyUrl,
      completedAt: new Date().toISOString(),
    }));

    toast({ title: 'DICOM Study Saved', description: `PACS imaging findings committed.` });
    setShowUpload(null);
    setUploadForm({ results: '', impression: '', dicomUrl: '', postdicomStudyUrl: '', imageFiles: [], reportFile: null });
  };

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">PACS & Lossless DICOM Modality Node</span>
            <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-mono">
              {filteredScans.length} STUDIES QUEUED
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Diagnostic radiology acquisitions, volumetric segmentations, and DICOM study distribution.
          </p>
        </div>

        {effectiveRole === 'doctor' && (
          <button
            onClick={() => setShowOrder(!showOrder)}
            className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors"
          >
            {showOrder ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showOrder ? 'CANCEL REQUISITION' : 'ORDER IMAGING STUDY'}</span>
          </button>
        )}
      </div>

      {/* Order Requisition Surface */}
      {showOrder && (
        <div className="p-4 bg-[#090D14] border border-[#252A35] rounded-[4px] space-y-3">
          <span className="text-xs font-bold uppercase text-slate-400 block border-b border-[#252A35] pb-2">
            Requisition Volumetric Radiology Study
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Target Patient</label>
              <select
                value={orderForm.patientId}
                onChange={(e) => setOrderForm({ ...orderForm, patientId: e.target.value })}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              >
                <option value="">Select Patient</option>
                {patientOptions.map((pt) => (
                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Imaging Center</label>
              <select
                value={orderForm.imagingCenterId}
                onChange={(e) => setOrderForm({ ...orderForm, imagingCenterId: e.target.value })}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              >
                <option value="">Select Center</option>
                {imagingCenterOptions.map((ic) => (
                  <option key={ic.id} value={ic.id}>{ic.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Modality Scan Type</label>
              <select
                value={orderForm.scanType}
                onChange={(e) => setOrderForm({ ...orderForm, scanType: e.target.value as ImagingScan['scanType'] })}
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              >
                {SCAN_TYPES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Anatomical Region</label>
              <input
                type="text"
                value={orderForm.bodyPart}
                onChange={(e) => setOrderForm({ ...orderForm, bodyPart: e.target.value })}
                placeholder="e.g. Thorax / Chest"
                className="w-full bg-[#0F1218] border border-[#252A35] rounded-[2px] p-2 text-[#ECEEF2]"
              />
            </div>
          </div>

          <button
            onClick={() => void handleOrder()}
            className="w-full bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold py-2 rounded-[2px] transition-colors uppercase tracking-wider text-xs"
          >
            DISPATCH RADIOLOGY REQUISITION
          </button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(['all', 'requested', 'in-progress', 'completed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-[2px] text-xs font-mono uppercase tracking-wider border transition-colors ${
                statusFilter === st
                  ? 'bg-[#151922] border-cyan-500/60 text-cyan-300 font-semibold'
                  : 'bg-[#0F1218] border-[#252A35] text-slate-400 hover:text-[#ECEEF2]'
              }`}
            >
              {st === 'all' ? 'ALL STUDIES' : st.replace('-', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search study or patient..."
            className="w-full bg-[#0F1218] border border-[#252A35] focus:border-cyan-500 rounded-[2px] pl-9 pr-3 py-1.5 text-xs text-[#ECEEF2] placeholder:text-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Radiology Studies Grid */}
      {filteredScans.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          No matching PACS radiology studies found.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredScans.map((scan) => (
            <div
              key={scan.id}
              className={`p-3 bg-[#090D14] border rounded-[2px] flex flex-col space-y-2 text-xs ${
                focusId === scan.id ? 'border-cyan-500/80 bg-[#0F1218]' : 'border-[#252A35]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[#151922] border border-[#2F3542] rounded-[2px] text-cyan-400 mt-0.5">
                    <ScanLine className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-[#ECEEF2] flex items-center gap-2">
                      <span>{scan.scanType} {scan.bodyPart ? `(${scan.bodyPart})` : ''}</span>
                      <span className="text-[10px] text-cyan-400/80 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-800/40">
                        {scan.destinationProviderName || 'Imaging Center'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Patient: <strong className="text-white">{scan.patientName}</strong> • Doctor: <strong>{scan.doctorName}</strong>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                      Ordered: {scan.date} {scan.scheduledAt ? `• Scheduled: ${formatDateTime(scan.scheduledAt)}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase border ${
                    scan.status === 'completed'
                      ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-400'
                      : scan.status === 'in-progress'
                      ? 'bg-amber-950/50 border-amber-600/60 text-amber-400'
                      : 'bg-[#151922] border-[#2F3542] text-slate-400'
                  }`}>
                    {scan.status}
                  </span>

                  {user?.role === 'imaging' && scan.status !== 'completed' && (
                    <button
                      onClick={() => { setShowUpload(scan.id); setUploadForm((prev) => ({ ...prev, results: scan.results || '' })); }}
                      className="px-2.5 py-1 bg-cyan-950/60 border border-cyan-600/60 text-cyan-300 text-[10px] font-bold rounded-[2px] hover:bg-cyan-900"
                    >
                      PUBLISH DICOM
                    </button>
                  )}
                </div>
              </div>

              {scan.results && (
                <div className="p-2 bg-[#06080C] border border-[#1F232E] rounded-[2px] text-[11px] text-slate-300">
                  <strong className="text-cyan-400 block text-[10px] uppercase font-mono">RADIOLOGY FINDINGS:</strong>
                  <span>{scan.results}</span>
                </div>
              )}

              {showUpload === scan.id && (
                <div className="p-3 bg-[#0F1218] border border-cyan-500/50 rounded-[2px] space-y-2 mt-2">
                  <span className="text-[10px] font-bold text-cyan-300 uppercase block">Input Volumetric PACS Radiology Findings</span>
                  <textarea
                    value={uploadForm.results}
                    onChange={(e) => setUploadForm({ ...uploadForm, results: e.target.value })}
                    placeholder="Enter radiology findings, volumetric observations, and impression..."
                    className="w-full bg-[#06080C] border border-[#252A35] rounded-[2px] p-2 text-xs text-[#ECEEF2]"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowUpload(null)} className="px-3 py-1 bg-[#151922] text-xs text-slate-400 rounded-[2px]">Cancel</button>
                    <button onClick={() => handleSaveResults(scan.id)} className="px-3 py-1 bg-cyan-950 border border-cyan-600 text-cyan-300 text-xs font-bold rounded-[2px]">PUBLISH DICOM STUDY</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImagingPage;
