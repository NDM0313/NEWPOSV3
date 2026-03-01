import { Layout } from '../components/Layout';
import { roleConfigs } from '../data/mockData';
import { useData } from '../context/DataContext';
import { Check, X } from 'lucide-react';

export function RolesManagement() {
  const { users } = useData();
  
  const capabilities = [
    { key: 'fullCompany', label: 'Full Company Access' },
    { key: 'fullBranches', label: 'All Branches Access' },
    { key: 'manageUsers', label: 'Manage Users' },
    { key: 'configureSystem', label: 'Configure System' },
    { key: 'viewAllSales', label: 'View All Sales' },
    { key: 'viewLedger', label: 'View Ledger' },
    { key: 'receivePayment', label: 'Receive Payment' },
    { key: 'deleteRecords', label: 'Delete Records' },
  ];

  const roleCapabilities: Record<string, Record<string, boolean>> = {
    owner: {
      fullCompany: true,
      fullBranches: true,
      manageUsers: true,
      configureSystem: true,
      viewAllSales: true,
      viewLedger: true,
      receivePayment: true,
      deleteRecords: true,
    },
    admin: {
      fullCompany: true,
      fullBranches: true,
      manageUsers: true,
      configureSystem: true,
      viewAllSales: true,
      viewLedger: true,
      receivePayment: true,
      deleteRecords: true,
    },
    manager: {
      fullCompany: false,
      fullBranches: false,
      manageUsers: false,
      configureSystem: false,
      viewAllSales: true,
      viewLedger: true,
      receivePayment: true,
      deleteRecords: false,
    },
    salesman: {
      fullCompany: false,
      fullBranches: false,
      manageUsers: false,
      configureSystem: false,
      viewAllSales: false,
      viewLedger: false,
      receivePayment: true,
      deleteRecords: false,
    },
    user: {
      fullCompany: false,
      fullBranches: false,
      manageUsers: false,
      configureSystem: false,
      viewAllSales: false,
      viewLedger: false,
      receivePayment: false,
      deleteRecords: false,
    },
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Roles Management</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Configure role capabilities and access levels
          </p>
        </div>

        {/* Role Capabilities Matrix */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300">Capability</th>
                  {roleConfigs.map((roleConfig) => (
                    <th key={roleConfig.role} className="text-center p-4">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl">{roleConfig.icon}</span>
                        <span
                          className="px-3 py-1 rounded-full text-xs font-bold text-white uppercase"
                          style={{ backgroundColor: roleConfig.color }}
                        >
                          {roleConfig.role}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {capabilities.map((capability, index) => (
                  <tr
                    key={capability.key}
                    className={index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}
                  >
                    <td className="p-4 font-medium text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      {capability.label}
                    </td>
                    {roleConfigs.map((roleConfig) => {
                      const hasCapability = roleCapabilities[roleConfig.role]?.[capability.key];
                      return (
                        <td key={roleConfig.role} className="text-center p-4 border-b border-slate-200 dark:border-slate-700">
                          {hasCapability ? (
                            <div className="inline-flex items-center justify-center size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                              <Check className="size-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-center size-8 rounded-full bg-red-100 dark:bg-red-900/30">
                              <X className="size-5 text-red-600 dark:text-red-400" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {roleConfigs.map((roleConfig) => (
            <div
              key={roleConfig.role}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border-2 p-6"
              style={{ borderColor: roleConfig.color + '40' }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="size-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ backgroundColor: roleConfig.color + '20' }}
                >
                  {roleConfig.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase">
                      {roleConfig.role}
                    </h3>
                    <span
                      className="px-2 py-1 rounded text-xs font-bold text-white"
                      style={{ backgroundColor: roleConfig.color }}
                    >
                      L{roleConfig.level}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">{roleConfig.description}</p>
                  
                  <div className="space-y-2">
                    {capabilities
                      .filter(cap => roleCapabilities[roleConfig.role]?.[cap.key])
                      .map(cap => (
                        <div key={cap.key} className="flex items-center gap-2 text-sm">
                          <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-slate-700 dark:text-slate-300">{cap.label}</span>
                        </div>
                      ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-sm text-slate-600 dark:text-slate-400">Total Users</div>
                    <div className="text-2xl font-bold" style={{ color: roleConfig.color }}>
                      {users.filter(u => u.role === roleConfig.role).length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
