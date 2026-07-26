import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Pill, RotateCw, Inbox, Calendar, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAppData } from '@/contexts/useAppData';
import { useNotifications } from '@/contexts/useNotifications';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const PrescriptionRefillPage = () => {
  const { user } = useAuth();
  const { prescriptions, requestPrescriptionRefill, updatePrescription } = useAppData();
  const { addNotification } = useNotifications();
  const [refillDialogOpen, setRefillDialogOpen] = useState<string | null>(null);
  const [refillNotes, setRefillNotes] = useState('');

  const userPrescriptions = useMemo(
    () => prescriptions.filter((p) => p.patientId === user?.id),
    [prescriptions, user?.id],
  );

  const activePrescriptions = useMemo(
    () => userPrescriptions.filter((p) => p.status === 'active' || p.status === 'dispensed'),
    [userPrescriptions],
  );

  const prescriptionsNeedingRefill = useMemo(() => {
    return activePrescriptions.filter((p) => {
      const refillsUsed = p.refillsUsed || 0;
      const refillsAllowed = p.refillsAllowed || 0;
      return refillsUsed < refillsAllowed;
    });
  }, [activePrescriptions]);

  const prescriptionsOutOfRefills = useMemo(() => {
    return activePrescriptions.filter((p) => {
      const refillsUsed = p.refillsUsed || 0;
      const refillsAllowed = p.refillsAllowed || 0;
      return refillsUsed >= refillsAllowed;
    });
  }, [activePrescriptions]);

  const pendingRefillRequests = useMemo(() => {
    return activePrescriptions.flatMap((p) =>
      (p.refillRequests ?? [])
        .filter((r) => r.status === 'pending')
        .map((r) => ({ ...r, prescription: p })),
    );
  }, [activePrescriptions]);

  const approvedRefillRequests = useMemo(() => {
    return activePrescriptions.flatMap((p) =>
      (p.refillRequests ?? [])
        .filter((r) => r.status !== 'pending')
        .map((r) => ({ ...r, prescription: p })),
    );
  }, [activePrescriptions]);

  const handleRequestRefill = (prescriptionId: string) => {
    requestPrescriptionRefill(prescriptionId);
    addNotification({
      title: 'Refill Request Submitted',
      message: 'Your refill request has been sent to your pharmacy. You will be notified when it is ready.',
      type: 'prescription',
      priority: 'medium',
      audience: 'personal',
    });
    setRefillDialogOpen(null);
    setRefillNotes('');
  };

  const handleApprovRefill = (prescriptionId: string, refillId: string) => {
    updatePrescription(prescriptionId, (p) => ({
      ...p,
      refillRequests: (p.refillRequests ?? []).map((r) =>
        r.id === refillId
          ? { ...r, status: 'approved' as const }
          : r,
      ),
      refillsUsed: ((p.refillsUsed ?? 0) + 1),
    }));
    addNotification({
      title: 'Refill Approved',
      message: 'The prescription refill has been approved and sent to the pharmacy.',
      type: 'prescription',
      priority: 'medium',
      audience: 'personal',
      targetRoles: ['pharmacy'],
    });
  };

  const getMedicationDisplay = (medications: typeof activePrescriptions[0]['medications']) => {
    return medications.map((m) => `${m.name} ${m.dosage}`).join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Prescription Refills</h1>
          <p className="text-muted-foreground mt-1">Manage and request prescription refills</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Active Prescriptions</span>
            <Pill className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{activePrescriptions.length}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card rounded-xl border border-border p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Can Refill</span>
            <RotateCw className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-bold text-success">{prescriptionsNeedingRefill.length}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border border-border p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Pending Requests</span>
            <Clock className="w-4 h-4 text-accent" />
          </div>
          <div className="text-2xl font-bold text-accent">{pendingRefillRequests.length}</div>
        </motion.div>
      </div>

      {/* Pending Refill Requests */}
      {pendingRefillRequests.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-3">Pending Refill Requests ({pendingRefillRequests.length})</h3>
              <div className="space-y-2">
                {pendingRefillRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-blue-100">
                    <div>
                      <div className="text-sm font-medium text-blue-900">{getMedicationDisplay(req.prescription.medications)}</div>
                      <div className="text-xs text-blue-700">Requested on {req.requestDate}</div>
                    </div>
                    {user?.role === 'pharmacy' && (
                      <Button
                        size="sm"
                        onClick={() => handleApprovRefill(req.prescription.id, req.id)}
                        className="gap-1"
                      >
                        <CheckCircle className="w-3 h-3" /> Approve
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Prescriptions Available for Refill */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Prescriptions Available for Refill</h2>
        {prescriptionsNeedingRefill.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground rounded-xl border border-border p-6">
            <RotateCw className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm">No prescriptions available for refill</p>
            <p className="text-xs mt-1">Check back when you need more medication</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {prescriptionsNeedingRefill.map((prescription, idx) => (
              <motion.div
                key={prescription.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card rounded-xl border border-border p-4 hover:border-primary/30 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-card-foreground mb-2">
                      {getMedicationDisplay(prescription.medications)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground mb-3">
                      <div>
                        <span className="font-medium">Prescribed by:</span> {prescription.doctorName}
                      </div>
                      <div>
                        <span className="font-medium">Date:</span> {prescription.date}
                      </div>
                      <div>
                        <span className="font-medium">Refills:</span> {prescription.refillsUsed} / {prescription.refillsAllowed}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span> {prescription.status}
                      </div>
                    </div>
                  </div>
                  <Dialog open={refillDialogOpen === prescription.id} onOpenChange={(open) => setRefillDialogOpen(open ? prescription.id : null)}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 shrink-0">
                        <RotateCw className="w-4 h-4" /> Request Refill
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Request Prescription Refill</DialogTitle>
                        <DialogDescription>
                          Confirm your refill request for {getMedicationDisplay(prescription.medications)}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="p-3 rounded-lg bg-secondary/50 space-y-2">
                          <div className="text-sm">
                            <span className="font-medium">Medication:</span> {getMedicationDisplay(prescription.medications)}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Refills Remaining:</span> {(prescription.refillsAllowed ?? 0) - (prescription.refillsUsed ?? 0)}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Last Dispensed:</span> {prescription.date}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Additional Notes (Optional)</label>
                          <Textarea
                            placeholder="Any additional information for your pharmacist..."
                            value={refillNotes}
                            onChange={(e) => setRefillNotes(e.target.value)}
                            className="mt-2 min-h-20"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => { setRefillDialogOpen(null); setRefillNotes(''); }}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleRequestRefill(prescription.id)}
                          className="gap-1"
                        >
                          <RotateCw className="w-4 h-4" /> Request Refill
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Prescriptions Out of Refills */}
      {prescriptionsOutOfRefills.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Prescriptions Requiring New Prescription</h2>
          <div className="space-y-3">
            {prescriptionsOutOfRefills.map((prescription, idx) => (
              <motion.div
                key={prescription.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"
              >
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-yellow-900 mb-1">
                      {getMedicationDisplay(prescription.medications)}
                    </div>
                    <p className="text-sm text-yellow-800">
                      This prescription has used all available refills. Contact {prescription.doctorName} to request a new prescription.
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Dispensed */}
      {approvedRefillRequests.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Refill History</h2>
          <div className="space-y-2">
            {approvedRefillRequests.slice(0, 5).map((req, idx) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <div className="text-sm">
                    <div className="font-medium">{getMedicationDisplay(req.prescription.medications)}</div>
                    <div className="text-xs text-muted-foreground">{req.requestDate}</div>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success">Dispensed</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionRefillPage;
