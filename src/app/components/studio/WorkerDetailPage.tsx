import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft,
  Phone,
  Calendar,
  Star,
  Palette,
  Scissors,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Package,
  ChevronRight,
  Eye,
  ExternalLink,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { useNavigation } from '../../context/NavigationContext';
import { useSupabase } from '../../context/SupabaseContext';
import { studioService } from '../../services/studioService';
import { studioProductionService } from '../../services/studioProductionService';

// ============================================
// 🎯 TYPES
// ============================================

type DepartmentType = 'Dyeing' | 'Stitching' | 'Handwork';
type JobStatus = 'pending' | 'in_progress' | 'completed';

interface WorkerJob {
  id: string;
  jobCardId: string;
  customerName: string;
  itemDescription: string;
  currentStage: DepartmentType;
  deadline: Date;
  status: JobStatus;
  assignedDate: Date;
  paymentAmount: number;
  isPaid: boolean;
  /** Sale id for opening Studio Sale Detail when viewing this job */
  saleId?: string;
}

interface WorkerDetail {
  id: string;
  name: string;
  phone: string;
  department: DepartmentType;
  rating: number;
  joinedDate: Date;
  
  // Job stats
  activeJobs: number;
  pendingJobs: number;
  completedJobs: number;
  
  // Financial (read-only indicators)
  totalEarnings: number;
  pendingAmount: number;
  
  // Current jobs
  currentJobs: WorkerJob[];
  
  // History
  recentCompletedJobs: WorkerJob[];
}

const mapStageTypeToDept = (t: string): DepartmentType => {
  const s = (t || '').toLowerCase();
  if (s === 'dyer' || s === 'dyeing') return 'Dyeing';
  if (s === 'handwork') return 'Handwork';
  return 'Stitching';
};

// ============================================
// 🎨 HELPER FUNCTIONS
// ============================================

const getDepartmentColor = (dept: DepartmentType) => {
  switch (dept) {
    case 'Dyeing': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'Stitching': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'Handwork': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
  }
};

const getDepartmentIcon = (dept: DepartmentType) => {
  switch (dept) {
    case 'Dyeing': return Palette;
    case 'Stitching': return Scissors;
    case 'Handwork': return Sparkles;
  }
};

const getJobStatusColor = (status: JobStatus) => {
  switch (status) {
    case 'pending': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    case 'in_progress': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/20';
  }
};

const getJobStatusIcon = (status: JobStatus) => {
  switch (status) {
    case 'pending': return Clock;
    case 'in_progress': return AlertTriangle;
    case 'completed': return CheckCircle2;
  }
};

// ============================================
// 🎯 MAIN COMPONENT
// ============================================

interface LedgerEntry {
  id: string;
  amount: number;
  status: string;
  reference_type: string;
  reference_id: string;
  notes: string | null;
  created_at: string;
  paid_at?: string | null;
}

export const WorkerDetailPage: React.FC = () => {
  const { setCurrentView, setSelectedWorkerId, selectedWorkerId, setSelectedStudioSaleId } = useNavigation();
  const { companyId } = useSupabase();
  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!companyId || !selectedWorkerId) {
      setWorker(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await studioService.getWorkerDetail(companyId, selectedWorkerId);
      if (!data) {
        setWorker(null);
        return;
      }
      const w = data.worker;
      const mapDept = (tt?: string) => mapStageTypeToDept(tt || w.worker_type || '');
      const stageIds = [...data.currentStages.map((s) => s.id), ...data.recentCompletedStages.map((s) => s.id)];
      const ledgerStatus = stageIds.length > 0
        ? await studioProductionService.getLedgerStatusForStages(stageIds)
        : {};
      const currentJobs: WorkerJob[] = data.currentStages.map((s) => ({
        id: s.id,
        jobCardId: s.production_no || '—',
        customerName: s.customer_name || '—',
        itemDescription: s.stage_type,
        currentStage: mapDept(s.stage_type),
        deadline: s.expected_completion_date ? new Date(s.expected_completion_date) : new Date(),
        status: s.status as JobStatus,
        assignedDate: new Date(),
        paymentAmount: s.cost,
        isPaid: ledgerStatus[s.id] === 'paid',
        saleId: s.sale_id,
      }));
      const recentCompletedJobs: WorkerJob[] = data.recentCompletedStages.map((s) => ({
        id: s.id,
        jobCardId: s.production_no || '—',
        customerName: '—',
        itemDescription: s.stage_type,
        currentStage: mapDept(s.stage_type),
        deadline: s.completed_at ? new Date(s.completed_at) : new Date(),
        status: 'completed',
        assignedDate: new Date(),
        paymentAmount: s.cost,
        isPaid: ledgerStatus[s.id] === 'paid',
      }));
      setWorker({
        id: w.id!,
        name: w.name,
        phone: w.phone || '',
        department: mapDept(w.worker_type),
        rating: typeof (w as any).rating === 'number' ? (w as any).rating : 4.5,
        joinedDate: (w as any).created_at ? new Date((w as any).created_at) : new Date(),
        activeJobs: w.activeJobs ?? 0,
        pendingJobs: w.pendingJobs ?? 0,
        completedJobs: w.completedJobs ?? 0,
        totalEarnings: w.totalEarnings ?? 0,
        pendingAmount: w.pendingAmount ?? 0,
        currentJobs,
        recentCompletedJobs,
      });
    } catch (e) {
      console.error('[WorkerDetailPage] load error', e);
      setWorker(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedWorkerId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const loadLedger = useCallback(async () => {
    if (!companyId || !selectedWorkerId) return;
    setLedgerLoading(true);
    try {
      const entries = await studioService.getWorkerLedgerEntries(companyId, selectedWorkerId);
      setLedgerEntries(entries);
    } catch (e) {
      console.error('[WorkerDetailPage] ledger load error', e);
      setLedgerEntries([]);
    } finally {
      setLedgerLoading(false);
    }
  }, [companyId, selectedWorkerId]);

  useEffect(() => {
    if (ledgerOpen && selectedWorkerId) loadLedger();
  }, [ledgerOpen, selectedWorkerId, loadLedger]);

  const handleGoBack = () => {
    setSelectedWorkerId?.(undefined);
    setCurrentView('studio-workflow');
  };

  const handleGoToAccounting = () => {
    setSelectedWorkerId?.(undefined);
    setCurrentView('accounting');
    // TODO: pass worker filter when accounting supports it
  };

  const handleViewJob = (job: WorkerJob) => {
    if (job.saleId && setSelectedStudioSaleId) {
      setSelectedStudioSaleId(job.saleId);
      setCurrentView('studio-sale-detail-new');
    } else {
      setCurrentView('studio-dashboard-new');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#111827]">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!selectedWorkerId || !worker) {
    return (
      <div className="min-h-screen bg-[#111827] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Worker not found</p>
          <Button onClick={handleGoBack} className="bg-blue-600 hover:bg-blue-500">
            <ArrowLeft size={18} className="mr-2" />
            Back to Workers
          </Button>
        </div>
      </div>
    );
  }

  const DeptIcon = getDepartmentIcon(worker.department);

  return (
    <div className="min-h-screen bg-[#111827] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft size={18} className="mr-2" />
                Back to Workers
              </Button>
              <div className="h-6 w-px bg-gray-700" />
              <h1 className="text-xl font-bold text-white">Worker Detail</h1>
            </div>
            
            <Button
              onClick={handleGoToAccounting}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
            >
              <ExternalLink size={16} />
              View in Accounting
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        
        {/* Worker Summary */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl">
                {worker.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{worker.name}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Phone size={14} />
                    {worker.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    Joined {format(worker.joinedDate, 'MMM dd, yyyy')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star size={14} className="text-yellow-400 fill-yellow-400" />
                    {worker.rating.toFixed(1)} Rating
                  </span>
                </div>
                <div className="mt-3">
                  <Badge variant="outline" className={getDepartmentColor(worker.department)}>
                    <DeptIcon size={14} className="mr-1" />
                    {worker.department} Department
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-gray-800">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Active Jobs</p>
              <p className="text-3xl font-bold text-yellow-400">{worker.activeJobs}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Pending Jobs</p>
              <p className="text-3xl font-bold text-orange-400">{worker.pendingJobs}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Completed</p>
              <p className="text-3xl font-bold text-green-400">{worker.completedJobs}</p>
            </div>
            <div className="text-center border-l border-gray-800">
              <p className="text-gray-400 text-sm mb-1">Total Due Amount</p>
              <p className={`text-2xl font-bold ${worker.pendingAmount > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                {worker.pendingAmount > 0 ? `Rs ${worker.pendingAmount.toLocaleString()}` : 'Cleared'}
              </p>
            </div>
            <div className="text-center border-l border-gray-800">
              <p className="text-gray-400 text-sm mb-1">Total Earnings</p>
              <p className="text-2xl font-bold text-blue-400">
                Rs {worker.totalEarnings.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Total Due / Payment Snapshot (ledger-driven) */}
        {worker.pendingAmount > 0 && (
          <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-400 font-semibold text-sm mb-1">Total Due Amount (Payable)</p>
                <p className="text-3xl font-bold text-white">
                  Rs {worker.pendingAmount.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Ledger-driven: unpaid payable entries. Pay via Accounting → Worker Payments.
                </p>
              </div>
              <Button
                onClick={handleGoToAccounting}
                className="bg-orange-600 hover:bg-orange-500 text-white gap-2"
              >
                View in Accounting
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* View Full Ledger: Payable & Paid entries */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setLedgerOpen((o) => !o)}
            className="w-full p-6 border-b border-gray-800 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="text-cyan-400" size={20} />
              View Full Ledger
            </h3>
            {ledgerOpen ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
          </button>
          {ledgerOpen && (
            <div className="p-4">
              {ledgerLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-blue-500" />
                </div>
              ) : ledgerEntries.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">No ledger entries yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-950/50 border-b border-gray-800">
                      <tr>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Reference</th>
                        <th className="px-4 py-3 font-medium text-right">Amount</th>
                        <th className="px-4 py-3 font-medium text-center">Status</th>
                        <th className="px-4 py-3 font-medium">Paid At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {ledgerEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-800/30">
                          <td className="px-4 py-3 text-gray-300">
                            {entry.created_at ? format(new Date(entry.created_at), 'dd MMM yyyy HH:mm') : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {entry.reference_type === 'studio_production_stage' ? 'Stage' : entry.reference_type} {entry.reference_id?.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-white">
                            Rs {entry.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className={entry.status === 'paid' ? 'bg-green-500/20 text-green-400 border-green-700' : 'bg-orange-500/20 text-orange-400 border-orange-700'}>
                              {entry.status === 'paid' ? 'Paid' : 'Payable'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {entry.paid_at ? format(new Date(entry.paid_at), 'dd MMM yyyy') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Current Jobs Section */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="text-yellow-400" size={20} />
                  Current Active Jobs
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {worker.currentJobs.length} jobs currently in progress
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-950/50 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3 font-medium">Job Card</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Item Description</th>
                  <th className="px-6 py-3 font-medium">Deadline</th>
                  <th className="px-6 py-3 font-medium text-right">Payment</th>
                  <th className="px-6 py-3 font-medium text-center">Status</th>
                  <th className="px-6 py-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {worker.currentJobs.map((job) => {
                  const StatusIcon = getJobStatusIcon(job.status);
                  const daysUntilDeadline = Math.ceil(
                    (job.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );

                  return (
                    <tr key={job.id} className="group hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-mono text-blue-400 font-medium">{job.jobCardId}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Assigned {format(job.assignedDate, 'MMM dd')}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white font-medium">{job.customerName}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-300">{job.itemDescription}</p>
                        <Badge variant="outline" className={`${getDepartmentColor(job.currentStage)} mt-1`}>
                          {job.currentStage}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white">{format(job.deadline, 'MMM dd, yyyy')}</p>
                        <p className={`text-xs mt-1 ${
                          daysUntilDeadline < 3 ? 'text-red-400' : 
                          daysUntilDeadline < 7 ? 'text-yellow-400' : 
                          'text-gray-500'
                        }`}>
                          {daysUntilDeadline} days left
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-white">
                          Rs {job.paymentAmount.toLocaleString()}
                        </p>
                        {!job.isPaid && (
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 mt-1">
                            Unpaid
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant="outline" className={getJobStatusColor(job.status)}>
                          <StatusIcon size={12} className="mr-1" />
                          {job.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          onClick={() => handleViewJob(job)}
                        >
                          <Eye size={16} className="mr-2" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Job History Section */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="text-green-400" size={20} />
                  Recent Completed Jobs
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Last {worker.recentCompletedJobs.length} completed assignments
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-950/50 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3 font-medium">Job Card</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Item Description</th>
                  <th className="px-6 py-3 font-medium">Completed Date</th>
                  <th className="px-6 py-3 font-medium text-right">Earned</th>
                  <th className="px-6 py-3 font-medium text-center">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {worker.recentCompletedJobs.map((job) => (
                  <tr key={job.id} className="group hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-mono text-gray-400 font-medium">{job.jobCardId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-300">{job.customerName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-400">{job.itemDescription}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-300">{format(job.deadline, 'MMM dd, yyyy')}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-bold text-green-400">
                        +Rs {job.paymentAmount.toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {job.isPaid ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                          <CheckCircle2 size={12} className="mr-1" />
                          Paid
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20">
                          Pending
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-gray-950/50 border-t border-gray-800 text-center">
            <Button
              variant="ghost"
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
              onClick={handleGoToAccounting}
            >
              View Complete History in Accounting
              <ChevronRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
