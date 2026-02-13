'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Package,
  ChevronDown,
  ChevronRight,
  Loader2,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  FileText,
  Palette,
  Scissors,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useSupabase } from '@/app/context/SupabaseContext';
import { studioCostsService } from '@/app/services/studioCostsService';
import type {
  StudioCostsSummary,
  WorkerCostSummary,
  ProductionCostSummary,
  WorkerLedgerEntry,
  StageCostDetail,
} from '@/app/services/studioCostsService';
import { branchService, Branch } from '@/app/services/branchService';
import { cn } from '@/app/components/ui/utils';
import { format } from 'date-fns';
import { useNavigation } from '@/app/context/NavigationContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

const getStageTypeLabel = (t: string) => {
  const s = (t || '').toLowerCase();
  if (s === 'dyer') return 'Dyeing';
  if (s === 'stitching') return 'Stitching';
  if (s === 'handwork') return 'Handwork';
  return t || t;
};

const getStageTypeIcon = (t: string) => {
  const s = (t || '').toLowerCase();
  if (s === 'dyer') return Palette;
  if (s === 'stitching') return Scissors;
  if (s === 'handwork') return Sparkles;
  return FileText;
};

export const StudioCostsTab: React.FC = () => {
  const { companyId, branchId: contextBranchId } = useSupabase();
  const { setCurrentView, setSelectedWorkerId } = useNavigation();
  const { formatCurrency } = useFormatCurrency();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<StudioCostsSummary | null>(null);
  const [workers, setWorkers] = useState<WorkerCostSummary[]>([]);
  const [productions, setProductions] = useState<ProductionCostSummary[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(contextBranchId);
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  const [expandedProduction, setExpandedProduction] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'workers' | 'productions'>('workers');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [sum, workerList, prodList, branchList] = await Promise.all([
        studioCostsService.getStudioCostsSummary(companyId, selectedBranchId),
        studioCostsService.getWorkerCostSummaries(companyId, selectedBranchId),
        studioCostsService.getProductionCostSummaries(companyId, selectedBranchId),
        branchService.getAllBranches(companyId),
      ]);
      setSummary(sum);
      setWorkers(workerList);
      setProductions(prodList);
      setBranches(branchList);
    } catch (e) {
      console.error('[StudioCostsTab] Error:', e);
      setSummary(null);
      setWorkers([]);
      setProductions([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedBranchId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleWorkerClick = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setCurrentView('worker-detail');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Studio Production Costs</h3>
          <p className="text-sm text-gray-400">
            Worker payments and job costs by production (standard method: Cost of Production / Worker Payable)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {branches.length > 1 && (
            <select
              value={selectedBranchId || 'all'}
              onChange={(e) => setSelectedBranchId(e.target.value === 'all' ? undefined : e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex rounded-lg border border-gray-700 overflow-hidden">
            <button
              onClick={() => setViewMode('workers')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                viewMode === 'workers'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              )}
            >
              By Worker
            </button>
            <button
              onClick={() => setViewMode('productions')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                viewMode === 'productions'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              )}
            >
              By Production
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={20} className="text-gray-500" />
            <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Cost</span>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(summary?.totalCost ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1">All stage costs</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={20} className="text-green-500" />
            <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Paid</span>
          </div>
          <p className="text-xl font-bold text-green-400">{formatCurrency(summary?.totalPaid ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1">Worker payments</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={20} className="text-amber-500" />
            <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Outstanding</span>
          </div>
          <p className="text-xl font-bold text-amber-400">{formatCurrency(summary?.totalUnpaid ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1">To pay workers</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={20} className="text-blue-500" />
            <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Workers</span>
          </div>
          <p className="text-xl font-bold text-white">{summary?.workersCount ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">With costs</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package size={20} className="text-purple-500" />
            <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Productions</span>
          </div>
          <p className="text-xl font-bold text-white">{summary?.productionsCount ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">With stages</p>
        </div>
      </div>

      {/* Cost by Stage Type */}
      {summary && (summary.byStageType.dyer > 0 || summary.byStageType.stitching > 0 || summary.byStageType.handwork > 0) && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Cost by Stage Type</h4>
          <div className="flex flex-wrap gap-4">
            {summary.byStageType.dyer > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Palette size={16} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Dyeing</p>
                  <p className="text-sm font-semibold text-white">{formatCurrency(summary.byStageType.dyer)}</p>
                </div>
              </div>
            )}
            {summary.byStageType.stitching > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Scissors size={16} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Stitching</p>
                  <p className="text-sm font-semibold text-white">{formatCurrency(summary.byStageType.stitching)}</p>
                </div>
              </div>
            )}
            {summary.byStageType.handwork > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                  <Sparkles size={16} className="text-pink-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Handwork</p>
                  <p className="text-sm font-semibold text-white">{formatCurrency(summary.byStageType.handwork)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workers View */}
      {viewMode === 'workers' && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h4 className="text-sm font-semibold text-white">Worker-wise Cost Breakdown</h4>
            <p className="text-xs text-gray-500 mt-0.5">Click worker to view full ledger</p>
          </div>
          {workers.length === 0 ? (
            <div className="text-center py-12">
              <Users size={48} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">No worker costs found</p>
              <p className="text-gray-500 text-xs mt-1">Studio production stages will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-800">
                  <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left w-8"></th>
                    <th className="px-4 py-3 text-left">Worker</th>
                    <th className="px-4 py-3 text-right">Jobs</th>
                    <th className="px-4 py-3 text-right">Total Cost</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Outstanding</th>
                    <th className="px-4 py-3 text-left w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((w) => (
                    <React.Fragment key={w.workerId}>
                      <tr
                        className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                        onClick={() => setExpandedWorker(expandedWorker === w.workerId ? null : w.workerId)}
                      >
                        <td className="px-4 py-3">
                          {w.ledgerEntries.length > 0 ? (
                            expandedWorker === w.workerId ? (
                              <ChevronDown size={16} className="text-gray-500" />
                            ) : (
                              <ChevronRight size={16} className="text-gray-500" />
                            )
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWorkerClick(w.workerId);
                            }}
                            className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium"
                          >
                            {w.workerName}
                            {w.workerCode ? ` (${w.workerCode})` : ''}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-300">{w.jobsCount}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-white">
                          {formatCurrency(w.totalCost)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-green-400">
                          {formatCurrency(w.paidAmount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'text-sm font-semibold',
                            w.unpaidAmount > 0 ? 'text-amber-400' : 'text-gray-500'
                          )}>
                            {formatCurrency(w.unpaidAmount)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWorkerClick(w.workerId);
                            }}
                          >
                            View Ledger
                          </Button>
                        </td>
                      </tr>
                      {expandedWorker === w.workerId && w.ledgerEntries.length > 0 && (
                        <tr className="bg-gray-950/50">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="space-y-2 pl-6 border-l-2 border-gray-700">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Ledger Entries
                              </p>
                              {w.ledgerEntries.map((e: WorkerLedgerEntry) => (
                                <div
                                  key={e.id}
                                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-900/50 border border-gray-800"
                                >
                                  <div className="flex items-center gap-3">
                                    <Badge
                                      className={cn(
                                        'text-xs capitalize',
                                        e.status === 'paid'
                                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                      )}
                                    >
                                      {e.status}
                                    </Badge>
                                    <span className="text-sm text-gray-300">
                                      {e.documentNo || '—'} • {getStageTypeLabel(e.stageType || '')}
                                    </span>
                                    {e.productionNo && (
                                      <span className="text-xs text-gray-500">{e.productionNo}</span>
                                    )}
                                    {e.saleInvoice && (
                                      <span className="text-xs text-gray-500">{e.saleInvoice}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className="text-sm font-semibold text-white">
                                      {formatCurrency(e.amount)}
                                    </span>
                                    {e.paidAt && (
                                      <span className="text-xs text-gray-500">
                                        Paid {format(new Date(e.paidAt), 'dd MMM yyyy')}
                                      </span>
                                    )}
                                    {e.paymentReference && (
                                      <span className="text-xs text-gray-500">{e.paymentReference}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Productions View */}
      {viewMode === 'productions' && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h4 className="text-sm font-semibold text-white">Production-wise Cost Breakdown</h4>
            <p className="text-xs text-gray-500 mt-0.5">Each production with stages and worker costs</p>
          </div>
          {productions.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">No productions found</p>
              <p className="text-gray-500 text-xs mt-1">Studio productions will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-800">
                  <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left w-8"></th>
                    <th className="px-4 py-3 text-left">Production</th>
                    <th className="px-4 py-3 text-left">Sale / Customer</th>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-right">Stages</th>
                    <th className="px-4 py-3 text-right">Total Cost</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {productions.map((p) => (
                    <React.Fragment key={p.productionId}>
                      <tr
                        className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                        onClick={() =>
                          setExpandedProduction(expandedProduction === p.productionId ? null : p.productionId)
                        }
                      >
                        <td className="px-4 py-3">
                          {p.stages.length > 0 ? (
                            expandedProduction === p.productionId ? (
                              <ChevronDown size={16} className="text-gray-500" />
                            ) : (
                              <ChevronRight size={16} className="text-gray-500" />
                            )
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-white">{p.productionNo}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <span className="text-gray-300">{p.saleInvoice || '—'}</span>
                            {p.customerName && (
                              <p className="text-xs text-gray-500">{p.customerName}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">{p.productName || '—'}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-300">{p.stages.length}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-white">
                          {formatCurrency(p.totalStageCost)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={cn(
                              'text-xs capitalize',
                              p.status === 'completed'
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : p.status === 'in_progress'
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            )}
                          >
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                      {expandedProduction === p.productionId && p.stages.length > 0 && (
                        <tr className="bg-gray-950/50">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="space-y-2 pl-6 border-l-2 border-gray-700">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Stage Details
                              </p>
                              {p.stages.map((s: StageCostDetail) => {
                                const StageIcon = getStageTypeIcon(s.stageType);
                                return (
                                  <div
                                    key={s.stageId}
                                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-900/50 border border-gray-800"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                                        <StageIcon size={16} className="text-gray-400" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-white">
                                          {getStageTypeLabel(s.stageType)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {s.workerName || 'Unassigned'} • {s.status}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <Badge
                                        className={cn(
                                          'text-xs',
                                          s.ledgerStatus === 'paid'
                                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                        )}
                                      >
                                        {s.ledgerStatus || 'unpaid'}
                                      </Badge>
                                      <span className="text-sm font-semibold text-white">
                                        {formatCurrency(s.cost)}
                                      </span>
                                      {s.documentNo && (
                                        <span className="text-xs text-gray-500">{s.documentNo}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Standard Method Note */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <FileText size={20} className="text-gray-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-400">Standard Accounting Method</p>
            <p className="text-xs text-gray-500 mt-1">
              Studio costs are recorded as <strong>Cost of Production</strong> (expense 5000) / <strong>Worker Payable</strong> (liability 2100).
              When a stage is completed, worker_ledger_entries are created. Payments reduce Worker Payable and debit Cash/Bank.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
