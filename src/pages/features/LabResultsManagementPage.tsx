import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  FileText,
  FlaskConical,
  Inbox,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import type { LabTest } from '@/data/mockData';
import { getVisibleLabTests } from '@/lib/recordVisibility';

const LabResultsManagementPage: React.FC = () => {
  const { user } = useAuth();
  const { labTests, updateLabTest, isLoading } = useAppData();
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [pendingDeleteTestId, setPendingDeleteTestId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'requested' | 'in-progress' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [resultDraft, setResultDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [uploadingTestId, setUploadingTestId] = useState<string | null>(null);

  const canManage = user?.role === 'laboratory';
  const visibleTests = useMemo(() => {
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      return labTests;
    }
    return getVisibleLabTests(labTests, user);
  }, [labTests, user]);

  const filteredTests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return visibleTests
      .filter((test) => {
        const matchesStatus = filterStatus === 'all' || test.status === filterStatus;
        const matchesQuery =
          !normalizedQuery ||
          test.testName.toLowerCase().includes(normalizedQuery) ||
          test.patientName.toLowerCase().includes(normalizedQuery) ||
          test.doctorName.toLowerCase().includes(normalizedQuery) ||
          (test.destinationProviderName || '').toLowerCase().includes(normalizedQuery);
        return matchesStatus && matchesQuery;
      })
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  }, [filterStatus, searchQuery, visibleTests]);

  const selectedTest = useMemo(
    () => filteredTests.find((test) => test.id === selectedTestId) ?? visibleTests.find((test) => test.id === selectedTestId) ?? null,
    [filteredTests, selectedTestId, visibleTests],
  );

  const stats = useMemo(
    () => ({
      total: visibleTests.length,
      requested: visibleTests.filter((test) => test.status === 'requested').length,
      inProgress: visibleTests.filter((test) => test.status === 'in-progress').length,
      completed: visibleTests.filter((test) => test.status === 'completed').length,
    }),
    [visibleTests],
  );

  const resetDrafts = () => {
    setResultDraft('');
    setNotesDraft('');
  };

  const openTest = (test: LabTest) => {
    setSelectedTestId(test.id);
    setResultDraft(test.results || '');
    setNotesDraft(test.notes || '');
  };

  const handleStatusChange = (testId: string, status: LabTest['status']) => {
    updateLabTest(testId, (test) => ({ ...test, status }));
    toast({
      title: 'Status updated',
      description: `This lab request is now marked as ${status.replace('-', ' ')}.`,
    });
  };

  const handleSaveResult = () => {
    if (!selectedTest) return;
    if (!resultDraft.trim()) {
      toast({
        title: 'Result required',
        description: 'Enter the result summary before marking this test complete.',
        variant: 'destructive',
      });
      return;
    }

    updateLabTest(selectedTest.id, (test) => ({
      ...test,
      status: 'completed',
      results: resultDraft.trim(),
      notes: notesDraft.trim() || undefined,
    }));
    toast({
      title: 'Result published',
      description: `${selectedTest.testName} for ${selectedTest.patientName} is now marked as completed.`,
    });
  };

  const handleFileUpload = (testId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Unsupported file type',
        description: 'Upload a PDF, JPEG, or PNG document.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Choose a file smaller than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingTestId(testId);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      updateLabTest(testId, (test) => ({
        ...test,
        documentUrl: dataUrl,
        notes: `${notesDraft.trim() || test.notes || ''}`.trim() || undefined,
      }));
      setUploadingTestId(null);
      toast({
        title: 'Attachment added',
        description: `${file.name} is now linked to this lab result in the current workspace.`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDocument = (testId: string) => {
    updateLabTest(testId, (test) => ({
      ...test,
      documentUrl: undefined,
    }));
    setPendingDeleteTestId(null);
    toast({
      title: 'Attachment removed',
      description: 'The linked lab document was removed from this workspace record.',
    });
  };

  const getStatusBadge = (status: LabTest['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700';
      case 'in-progress':
        return 'bg-sky-50 text-sky-700';
      case 'requested':
        return 'bg-amber-50 text-amber-700';
      case 'cancelled':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (!user || (user.role !== 'laboratory' && user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Lab Result Operations</h1>
        <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-border bg-card py-14 text-muted-foreground shadow-sm">
          <FlaskConical className="mb-3 h-10 w-10" />
          <p className="text-sm">You don't have access to this lab operations workspace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(145deg,_#ffffff_0%,_#f7fbff_60%,_#f4fbfa_100%)] p-8 shadow-sm"
      >
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-sky-700">
              <FlaskConical className="h-4 w-4" />
              Lab result operations
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">Result uploads and completion queue</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Process incoming requests, draft result summaries, and attach documents from one workspace built for the laboratory flow.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Total queue', value: isLoading ? '...' : stats.total, tone: 'bg-slate-100 text-slate-700' },
                { label: 'Requested', value: isLoading ? '...' : stats.requested, tone: 'bg-amber-50 text-amber-700' },
                { label: 'In progress', value: isLoading ? '...' : stats.inProgress, tone: 'bg-sky-50 text-sky-700' },
                { label: 'Completed', value: isLoading ? '...' : stats.completed, tone: 'bg-emerald-50 text-emerald-700' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                  <div className={`inline-flex rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${item.tone}`}>
                    {item.label}
                  </div>
                  <div className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Workspace note</p>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">Attachment behavior</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  File attachments are currently stored as browser-backed workspace data. They are suitable for local workflow demos, not final production archiving.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">Best use</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Use this page to move requests through requested, in-progress, and completed states while preparing result summaries for the care team.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <AlertDialog open={Boolean(pendingDeleteTestId)} onOpenChange={(open) => { if (!open) setPendingDeleteTestId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attached document?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the linked lab attachment from the current workspace record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => (pendingDeleteTestId ? handleDeleteDocument(pendingDeleteTestId) : undefined)}
            >
              Delete document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Worklist</h2>
              <p className="mt-1 text-sm text-slate-500">Filter and open the next test request that needs action.</p>
            </div>
            <div className="grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search patient, doctor, test, or laboratory..."
                  className="h-11 w-full rounded-2xl border border-input bg-background pl-10 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(['all', 'requested', 'in-progress', 'completed', 'cancelled'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={filterStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus(status)}
                    className="whitespace-nowrap capitalize"
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {filteredTests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Inbox className="mb-2 h-8 w-8" />
                <p className="text-sm">{visibleTests.length === 0 ? 'No lab requests yet' : 'No requests match your current filters'}</p>
              </div>
            ) : (
              filteredTests.map((test, index) => (
                <motion.button
                  key={test.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => openTest(test)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedTestId === test.id
                      ? 'border-primary bg-primary/[0.04] shadow-sm'
                      : 'border-slate-200 bg-white hover:border-primary/20 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{test.testName}</div>
                      <div className="mt-1 text-sm text-slate-600">{test.patientName}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        Ordered by {test.doctorName} • {test.date}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getStatusBadge(test.status)}`}>
                        {test.status}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
          {selectedTest ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{selectedTest.testName}</h2>
                  <p className="mt-1 text-sm text-slate-600">{selectedTest.patientName}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Ordered by {selectedTest.doctorName}
                    {selectedTest.destinationProviderName ? ` • ${selectedTest.destinationProviderName}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManage && selectedTest.status === 'requested' ? (
                    <Button variant="outline" onClick={() => handleStatusChange(selectedTest.id, 'in-progress')}>
                      Start processing
                    </Button>
                  ) : null}
                  {canManage && selectedTest.status !== 'cancelled' && selectedTest.status !== 'completed' ? (
                    <Button variant="outline" onClick={() => handleStatusChange(selectedTest.id, 'cancelled')}>
                      Cancel request
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{selectedTest.status}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ordered date</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{selectedTest.date}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Attachment</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{selectedTest.documentUrl ? 'Attached' : 'None yet'}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-800">Result summary</label>
                  <textarea
                    value={resultDraft}
                    onChange={(event) => setResultDraft(event.target.value)}
                    rows={5}
                    placeholder="Enter the test result summary..."
                    className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    disabled={!canManage}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-800">Operational notes</label>
                  <textarea
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    rows={4}
                    placeholder="Add any internal notes or patient-facing context..."
                    className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    disabled={!canManage}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Attachment</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Upload a PDF or image for this result. This remains browser-backed workspace data for now.
                    </p>
                  </div>
                  {canManage ? (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50">
                      <Upload className="h-4 w-4" />
                      {uploadingTestId === selectedTest.id ? 'Uploading...' : 'Upload document'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(event) => handleFileUpload(selectedTest.id, event)}
                        disabled={uploadingTestId === selectedTest.id}
                        className="hidden"
                      />
                    </label>
                  ) : null}
                </div>

                {selectedTest.documentUrl ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={selectedTest.documentUrl} target="_blank" rel="noopener noreferrer">
                      <Button className="gap-2">
                        <Download className="h-4 w-4" />
                        View document
                      </Button>
                    </a>
                    {canManage ? (
                      <Button variant="destructive" size="sm" onClick={() => setPendingDeleteTestId(selectedTest.id)} className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs text-slate-500">
                    <FileText className="h-3.5 w-3.5" />
                    No attachment linked yet
                  </div>
                )}
              </div>

              {selectedTest.results ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <CheckCircle className="h-4 w-4" />
                    Current published result
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-emerald-900">{selectedTest.results}</p>
                </div>
              ) : null}

              {canManage ? (
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleSaveResult} className="gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Mark complete and save
                  </Button>
                  <Button variant="outline" onClick={resetDrafts}>
                    Reset drafts
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-14 text-center text-muted-foreground">
              <Clock className="mb-3 h-10 w-10" />
              <p className="text-sm">Choose a lab request from the worklist to review or complete it.</p>
            </div>
          )}
        </section>
      </div>

      <div className="rounded-[1.75rem] border border-info/20 bg-info/5 px-5 py-4 text-sm text-info">
        This workspace now describes its attachment handling honestly: uploads are linked for workflow continuity, but production-grade backend document archiving still needs to be completed.
      </div>
    </div>
  );
};

export default LabResultsManagementPage;
