import React, { createContext, useContext, useState, useEffect } from 'react';

export type ModuleId = 'rentals' | 'manufacturing' | 'repairs' | 'loyalty' | 'accounting';

export interface ModuleConfig {
  id: ModuleId;
  name: string;
  isEnabled: boolean;
  config?: any;
}

interface ModuleContextType {
  modules: Record<ModuleId, ModuleConfig>;
  toggleModule: (id: ModuleId, isEnabled: boolean) => void;
  updateModuleConfig: (id: ModuleId, config: any) => void;
}

const defaultModules: Record<ModuleId, ModuleConfig> = {
  rentals: { id: 'rentals', name: 'Rental & Leasing', isEnabled: true },
  manufacturing: { id: 'manufacturing', name: 'Manufacturing', isEnabled: false },
  repairs: { id: 'repairs', name: 'Repairs & Services', isEnabled: false },
  loyalty: { id: 'loyalty', name: 'Loyalty Program', isEnabled: false },
  accounting: { id: 'accounting', name: 'Accounting', isEnabled: true },
};

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modules, setModules] = useState<Record<ModuleId, ModuleConfig>>(() => {
    const saved = localStorage.getItem('erp_modules');
    return saved ? JSON.parse(saved) : defaultModules;
  });

  useEffect(() => {
    localStorage.setItem('erp_modules', JSON.stringify(modules));
  }, [modules]);

  const toggleModule = (id: ModuleId, isEnabled: boolean) => {
    setModules(prev => ({
      ...prev,
      [id]: { ...prev[id], isEnabled }
    }));
  };

  const updateModuleConfig = (id: ModuleId, config: any) => {
    setModules(prev => ({
      ...prev,
      [id]: { ...prev[id], config: { ...prev[id].config, ...config } }
    }));
  };

  return (
    <ModuleContext.Provider value={{ modules, toggleModule, updateModuleConfig }}>
      {children}
    </ModuleContext.Provider>
  );
};

export const useModules = () => {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error('useModules must be used within a ModuleProvider');
  }
  return context;
};
