import React from 'react';
import { Loader2 } from 'lucide-react';

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-10 bg-card rounded-lg w-full max-w-xl" />
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-28 bg-card rounded-xl border border-border" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="h-64 bg-card rounded-xl border border-border" />
      <div className="h-64 bg-card rounded-xl border border-border" />
    </div>
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      Loading dashboard…
    </div>
  </div>
);
