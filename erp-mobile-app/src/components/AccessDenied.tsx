import { ShieldX } from 'lucide-react';

interface AccessDeniedProps {
  onBack: () => void;
  message?: string;
}

export function AccessDenied({ onBack, message }: AccessDeniedProps) {
  return (
    <div className="min-h-screen bg-[#111827] text-[#F9FAFB] flex flex-col items-center justify-center p-6">
      <div className="w-20 h-20 rounded-full bg-[#EF4444]/20 flex items-center justify-center mb-6">
        <ShieldX className="w-10 h-10 text-[#EF4444]" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
      <p className="text-[#9CA3AF] text-center mb-8 max-w-sm">
        {message ?? "You don't have permission to access this module or branch."}
      </p>
      <button
        onClick={onBack}
        className="px-6 py-3 bg-[#374151] hover:bg-[#4B5563] rounded-xl font-medium text-white transition-colors"
      >
        Go Back
      </button>
    </div>
  );
}
