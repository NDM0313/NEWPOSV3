import React from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { LoginPage } from './LoginPage';
import { CompanySelectionPage } from './CompanySelectionPage';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, profileLoadComplete, needsCompanySelection } = useSupabase();

  if (loading || (user && !profileLoadComplete)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (needsCompanySelection) {
    return <CompanySelectionPage />;
  }

  return <>{children}</>;
};
