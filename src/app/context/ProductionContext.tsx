/**
 * Production Context – Studio Production jobs
 * Backend-driven: studio_productions + studio_production_logs
 * Inventory impact only when status = completed
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { useSupabase } from '@/app/context/SupabaseContext';
import {
  studioProductionService,
  StudioProduction,
  StudioProductionStatus,
  StudioProductionLog,
  CreateProductionInput,
} from '@/app/services/studioProductionService';
import { toast } from 'sonner';

interface ProductionContextType {
  productions: StudioProduction[];
  loading: boolean;
  refreshProductions: () => Promise<void>;
  createProduction: (input: Omit<CreateProductionInput, 'company_id' | 'branch_id' | 'production_no' | 'created_by'>) => Promise<StudioProduction>;
  updateProduction: (id: string, updates: Partial<StudioProduction>, performedBy?: string | null) => Promise<StudioProduction>;
  changeStatus: (id: string, newStatus: StudioProductionStatus, performedBy?: string | null) => Promise<StudioProduction>;
  deleteProduction: (id: string) => Promise<void>;
  getProductionById: (id: string) => Promise<StudioProduction | null>;
  getProductionLogs: (productionId: string) => Promise<StudioProductionLog[]>;
}

const ProductionContext = createContext<ProductionContextType | undefined>(undefined);

export const useProduction = () => {
  const ctx = useContext(ProductionContext);
  if (!ctx) throw new Error('useProduction must be used within ProductionProvider');
  return ctx;
};

export const ProductionProvider = ({ children }: { children: ReactNode }) => {
  const { companyId, branchId, user } = useSupabase();
  const { generateDocumentNumber, incrementNextNumber } = useDocumentNumbering();
  const [productions, setProductions] = useState<StudioProduction[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProductions = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await studioProductionService.getProductions(companyId, branchId === 'all' ? undefined : branchId || undefined);
      setProductions(data);
    } catch (e: any) {
      console.error('[ProductionContext]', e);
      toast.error('Failed to load productions');
      setProductions([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  const createProduction = useCallback(
    async (
      input: Omit<CreateProductionInput, 'company_id' | 'branch_id' | 'production_no' | 'created_by'>
    ): Promise<StudioProduction> => {
      if (!companyId || !user) throw new Error('Company and user required');
      let effectiveBranchId = branchId && branchId !== 'all' ? branchId : null;
      if (!effectiveBranchId) {
        const { branchService } = await import('@/app/services/branchService');
        const branches = await branchService.getAllBranches(companyId);
        effectiveBranchId = branches?.[0]?.id ?? null;
      }
      if (!effectiveBranchId) throw new Error('Branch required');
      const production_no = generateDocumentNumber('production');
      const created = await studioProductionService.createProductionJob({
        ...input,
        company_id: companyId,
        branch_id: effectiveBranchId,
        production_no,
        created_by: user.id,
      });
      incrementNextNumber('production');
      await refreshProductions();
      toast.success(`Production ${production_no} created`);
      return created;
    },
    [companyId, branchId, user, generateDocumentNumber, incrementNextNumber, refreshProductions]
  );

  const updateProduction = useCallback(
    async (
      id: string,
      updates: Partial<StudioProduction>,
      performedBy?: string | null
    ): Promise<StudioProduction> => {
      const updated = await studioProductionService.updateProductionJob(id, updates, performedBy ?? user?.id ?? null);
      await refreshProductions();
      toast.success('Production updated');
      return updated;
    },
    [user?.id, refreshProductions]
  );

  const changeStatus = useCallback(
    async (id: string, newStatus: StudioProductionStatus, performedBy?: string | null): Promise<StudioProduction> => {
      const updated = await studioProductionService.changeProductionStatus(id, newStatus, performedBy ?? user?.id ?? null);
      await refreshProductions();
      toast.success(`Status set to ${newStatus}`);
      return updated;
    },
    [user?.id, refreshProductions]
  );

  const deleteProduction = useCallback(
    async (id: string) => {
      await studioProductionService.deleteProductionJob(id);
      await refreshProductions();
      toast.success('Production deleted');
    },
    [refreshProductions]
  );

  const getProductionById = useCallback((id: string) => studioProductionService.getProductionById(id), []);
  const getProductionLogs = useCallback((productionId: string) => studioProductionService.getProductionLogs(productionId), []);

  const value: ProductionContextType = {
    productions,
    loading,
    refreshProductions,
    createProduction,
    updateProduction,
    changeStatus,
    deleteProduction,
    getProductionById,
    getProductionLogs,
  };

  return <ProductionContext.Provider value={value}>{children}</ProductionContext.Provider>;
};
