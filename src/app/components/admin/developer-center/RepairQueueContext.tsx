import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { RepairQueueItem } from '@/app/lib/developerRepairTypes';

interface RepairQueueContextValue {
  items: RepairQueueItem[];
  sendToRepairQueue: (item: Omit<RepairQueueItem, 'queueId'>) => void;
  removeFromQueue: (queueId: string) => void;
  clearQueue: () => void;
}

const RepairQueueContext = createContext<RepairQueueContextValue | null>(null);

function newQueueId(): string {
  return `rq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function RepairQueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<RepairQueueItem[]>([]);

  const sendToRepairQueue = useCallback((item: Omit<RepairQueueItem, 'queueId'>) => {
    setItems((prev) => {
      const key = `${item.actionId}:${JSON.stringify(item.params)}`;
      if (prev.some((p) => `${p.actionId}:${JSON.stringify(p.params)}` === key)) return prev;
      return [...prev, { ...item, queueId: newQueueId() }];
    });
  }, []);

  const removeFromQueue = useCallback((queueId: string) => {
    setItems((prev) => prev.filter((i) => i.queueId !== queueId));
  }, []);

  const clearQueue = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, sendToRepairQueue, removeFromQueue, clearQueue }),
    [items, sendToRepairQueue, removeFromQueue, clearQueue]
  );

  return <RepairQueueContext.Provider value={value}>{children}</RepairQueueContext.Provider>;
}

export function useRepairQueue(): RepairQueueContextValue {
  const ctx = useContext(RepairQueueContext);
  if (!ctx) {
    throw new Error('useRepairQueue must be used within RepairQueueProvider');
  }
  return ctx;
}

export function useRepairQueueOptional(): RepairQueueContextValue | null {
  return useContext(RepairQueueContext);
}
