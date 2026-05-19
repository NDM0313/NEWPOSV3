/**
 * Client-only backup export + selective restore wizard.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Upload, ChevronRight, ChevronLeft, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Input } from '@/app/components/ui/input';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { toast } from 'sonner';
import { BackupExportPanel } from './components/BackupExportPanel';
import { EntitySelectionGrid } from './components/EntitySelectionGrid';
import { ImportAuditPreview } from './components/ImportAuditPreview';
import { DependencyChecklist } from './components/DependencyChecklist';
import { parseBackupPackage } from './backupPackage/parseBackupPackage';
import { auditRestorePlan } from './backupPackage/auditRestorePlan';
import { commitRestorePlan } from './backupPackage/commitRestorePlan';
import {
  mergeSelectionWithDependencies,
  validateRestoreSelection,
} from './backupPackage/dependencyGraph';
import { loadProductCatalogContext } from './profiles/productsProfile';
import type { BackupEntityKey, ParsedBackupPackage, RestoreAuditResult } from './backupPackage/types';
import type { RestoreCommitProgress } from './backupPackage/types';

type Tab = 'export' | 'restore';
type RestoreStep = 'upload' | 'select' | 'audit' | 'dependencies' | 'confirm' | 'commit';

const PHASE1_DEFAULT: BackupEntityKey[] = [
  'contacts_customers',
  'contacts_suppliers',
  'contacts_workers',
  'products',
  'inventory_stock_balances',
];

export interface BackupRestoreWorkbenchProps {
  isOwner?: boolean;
  companyName?: string;
}

export function BackupRestoreWorkbench({ isOwner = true, companyName }: BackupRestoreWorkbenchProps) {
  const { companyId, branchId } = useSupabase();
  const { generateDocumentNumberSafe, incrementNextNumber } = useDocumentNumbering();

  const [tab, setTab] = useState<Tab>('export');
  const [restoreStep, setRestoreStep] = useState<RestoreStep>('upload');
  const [pkg, setPkg] = useState<ParsedBackupPackage | null>(null);
  const [selected, setSelected] = useState<Set<BackupEntityKey>>(new Set(PHASE1_DEFAULT));
  const [audit, setAudit] = useState<RestoreAuditResult | null>(null);
  const [understandOverwrite, setUnderstandOverwrite] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitLog, setCommitLog] = useState<RestoreCommitProgress[]>([]);
  const [parsing, setParsing] = useState(false);

  const branchOrNull = branchId && branchId !== 'all' ? branchId : null;

  const depValidation = useMemo(
    () => validateRestoreSelection(selected),
    [selected]
  );

  const canRunAudit = pkg && selected.size > 0;
  const canCommit =
    audit &&
    audit.blocking.length === 0 &&
    depValidation.ok &&
    understandOverwrite &&
    confirmText.trim().toUpperCase() === 'IMPORT' &&
    isOwner;

  const resetRestore = useCallback(() => {
    setPkg(null);
    setSelected(new Set(PHASE1_DEFAULT));
    setAudit(null);
    setUnderstandOverwrite(false);
    setConfirmText('');
    setCommitLog([]);
    setRestoreStep('upload');
  }, []);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('Please upload a .zip backup package');
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseBackupPackage(file);
      if (companyId && parsed.manifest.company_id !== companyId) {
        toast.error('Backup company_id does not match active company');
        return;
      }
      setPkg(parsed);
      setAudit(null);
      setRestoreStep('select');
      toast.success('Backup package loaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse backup');
    } finally {
      setParsing(false);
    }
  };

  const runAudit = () => {
    if (!pkg || !companyId) return;
    const result = auditRestorePlan(pkg, selected, companyId);
    setAudit(result);
    setRestoreStep('audit');
  };

  const handleCommit = async () => {
    if (!pkg || !companyId || !canCommit) return;
    setCommitting(true);
    setRestoreStep('commit');
    setCommitLog([]);
    try {
      const catalog = await loadProductCatalogContext(companyId);
      const result = await commitRestorePlan({
        companyId,
        branchId: branchOrNull,
        selected,
        pkg,
        productCommitDeps: {
          companyId,
          branchIdOrNull: branchOrNull,
          catalog,
          autoGenerateSku: false,
          autoCreateCatalog: true,
          generateDocumentNumberSafe,
          incrementNextNumber,
        },
        onProgress: (p) => {
          setCommitLog((prev) => {
            const idx = prev.findIndex((x) => x.entity === p.entity);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = p;
              return next;
            }
            return [...prev, p];
          });
        },
      });
      setCommitLog(result.progress);
      const failed = result.progress.some((p) => p.status === 'failed');
      if (failed) toast.error('Import finished with errors — see log');
      else toast.success('Selective import completed');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setCommitting(false);
    }
  };

  if (!isOwner) {
    return (
      <p className="text-sm text-amber-400 flex items-center gap-2">
        <ShieldAlert size={16} />
        Backup export and selective restore are restricted to Owner role.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <Button
          variant={tab === 'export' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('export')}
          className={tab === 'export' ? 'bg-emerald-600' : 'text-gray-400'}
        >
          Export
        </Button>
        <Button
          variant={tab === 'restore' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('restore')}
          className={tab === 'restore' ? 'bg-emerald-600' : 'text-gray-400'}
        >
          Selective restore
        </Button>
      </div>

      {tab === 'export' && companyId && (
        <BackupExportPanel
          companyId={companyId}
          branchId={branchId}
          companyName={companyName}
        />
      )}

      {tab === 'restore' && (
        <div className="space-y-6">
          {restoreStep === 'upload' && (
            <div className="border border-dashed border-gray-700 rounded-lg p-8 text-center">
              <Upload className="mx-auto text-gray-500 mb-3" size={32} />
              <p className="text-sm text-gray-400 mb-4">
                Upload an ERP backup ZIP (manifest.json + CSV files)
              </p>
              <input
                type="file"
                accept=".zip,application/zip"
                disabled={parsing}
                onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-emerald-600/20 file:text-emerald-300"
              />
              {parsing && (
                <p className="text-xs text-gray-500 mt-2 flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Parsing…
                </p>
              )}
            </div>
          )}

          {pkg && restoreStep !== 'upload' && (
            <>
              <div className="text-xs text-gray-500">
                Package: {pkg.manifest.company_name ?? pkg.manifest.company_id} · exported{' '}
                {new Date(pkg.manifest.exported_at).toLocaleString()}
              </div>

              {restoreStep === 'select' && (
                <div className="space-y-4">
                  <h4 className="text-white font-medium">Select entities to import</h4>
                  <EntitySelectionGrid
                    files={pkg.files}
                    selected={selected}
                    onChange={setSelected}
                    disabled={committing}
                  />
                  <div className="flex justify-between">
                    <Button variant="ghost" size="sm" onClick={resetRestore}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1 bg-emerald-600"
                      disabled={selected.size === 0}
                      onClick={() => setRestoreStep('dependencies')}
                    >
                      Next: dependencies <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {restoreStep === 'dependencies' && (
                <div className="space-y-4">
                  <h4 className="text-white font-medium">Dependency order</h4>
                  <DependencyChecklist
                    selected={selected}
                    onAddDependencies={(keys) =>
                      setSelected(mergeSelectionWithDependencies(selected, keys))
                    }
                  />
                  <div className="flex justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setRestoreStep('select')}>
                      <ChevronLeft size={14} /> Back
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1 bg-emerald-600"
                      disabled={!canRunAudit || !depValidation.ok}
                      onClick={runAudit}
                    >
                      Run audit <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {(restoreStep === 'audit' || restoreStep === 'confirm' || restoreStep === 'commit') && (
                <div className="space-y-4">
                  <h4 className="text-white font-medium">Import audit</h4>
                  <ImportAuditPreview audit={audit} />

                  {restoreStep === 'audit' && (
                    <div className="flex justify-between">
                      <Button variant="ghost" size="sm" onClick={() => setRestoreStep('dependencies')}>
                        <ChevronLeft size={14} /> Back
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1 bg-emerald-600"
                        disabled={!audit || audit.blocking.length > 0}
                        onClick={() => setRestoreStep('confirm')}
                      >
                        Confirm import <ChevronRight size={14} />
                      </Button>
                    </div>
                  )}

                  {restoreStep === 'confirm' && (
                    <div className="border border-amber-700/40 rounded-lg p-4 space-y-4 bg-amber-950/10">
                      <h4 className="text-amber-200 font-medium text-sm">Confirmation required</h4>
                      <label className="flex items-start gap-3 text-sm text-gray-300 cursor-pointer">
                        <Checkbox
                          checked={understandOverwrite}
                          onCheckedChange={(v) => setUnderstandOverwrite(v === true)}
                        />
                        <span>
                          I understand this will create or update records in the active company using
                          existing import services (contacts, products, stock adjustments). This does
                          not replace the full JSON restore.
                        </span>
                      </label>
                      <div>
                        <p className="text-xs text-gray-400 mb-2">
                          Type <strong className="text-white">IMPORT</strong> to enable commit
                        </p>
                        <Input
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          placeholder="IMPORT"
                          className="bg-gray-900 border-gray-700 text-white max-w-xs"
                        />
                      </div>
                      <div className="flex justify-between">
                        <Button variant="ghost" size="sm" onClick={() => setRestoreStep('audit')}>
                          <ChevronLeft size={14} /> Back
                        </Button>
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-500"
                          disabled={!canCommit || committing}
                          onClick={() => void handleCommit()}
                        >
                          Run selective import
                        </Button>
                      </div>
                    </div>
                  )}

                  {restoreStep === 'commit' && (
                    <div className="space-y-2">
                      <h4 className="text-white font-medium text-sm">Import progress</h4>
                      <ul className="text-sm space-y-1">
                        {commitLog.map((p) => (
                          <li key={p.entity} className="text-gray-300 flex gap-2">
                            <span className="text-gray-500 w-40 shrink-0">{p.entity}</span>
                            <span
                              className={
                                p.status === 'done'
                                  ? 'text-emerald-400'
                                  : p.status === 'failed'
                                    ? 'text-red-400'
                                    : 'text-gray-400'
                              }
                            >
                              {p.status}
                              {p.message ? ` — ${p.message}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {committing && (
                        <p className="text-xs text-gray-500 flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" /> Importing…
                        </p>
                      )}
                      {!committing && (
                        <Button variant="outline" size="sm" onClick={resetRestore}>
                          Start over
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
