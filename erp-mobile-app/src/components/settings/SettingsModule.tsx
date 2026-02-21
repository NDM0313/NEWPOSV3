import { ArrowLeft, Settings as SettingsIcon, LogOut, Info, MapPin, ChevronRight, Building2 } from 'lucide-react';
import type { User, Branch } from '../../types';

interface SettingsModuleProps {
  onBack: () => void;
  user: User;
  branch: Branch | null;
  onChangeBranch: () => void;
  onLogout: () => void;
}

export function SettingsModule({ onBack, user, branch, onChangeBranch, onLogout }: SettingsModuleProps) {
  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#6B7280] rounded-lg flex items-center justify-center">
              <SettingsIcon size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Settings</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <p className="text-xs text-[#9CA3AF] mb-1">Logged in as</p>
          <p className="font-medium text-white">{user.name}</p>
          <p className="text-sm text-[#6B7280]">{user.email}</p>
          <span className="inline-block mt-2 px-2 py-0.5 bg-[#6B7280]/20 text-[#9CA3AF] text-xs rounded-full capitalize">
            {user.role}
          </span>
        </div>

        <button
          onClick={onChangeBranch}
          className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center justify-between hover:border-[#3B82F6] transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#3B82F6]/20 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div>
              <p className="font-medium text-white">Current Branch</p>
              <p className="text-sm text-[#9CA3AF]">{branch?.name ?? 'Not selected'}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B7280]" />
        </button>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#8B5CF6]/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <div>
              <p className="font-medium text-white">Din Collection Mobile</p>
              <p className="text-sm text-[#9CA3AF]">Version 0.1.0</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-[#6B7280]" />
            <div>
              <p className="font-medium text-white">About</p>
              <p className="text-sm text-[#9CA3AF]">ERP for bridal & rental business</p>
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 h-12 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-xl font-medium hover:bg-[#EF4444]/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
