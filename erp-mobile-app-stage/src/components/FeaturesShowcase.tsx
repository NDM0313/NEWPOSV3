import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';

interface FeaturesShowcaseProps {
  onClose: () => void;
}

export function FeaturesShowcase({ onClose }: FeaturesShowcaseProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'modules'>('overview');

  return (
    <div className="fixed inset-0 z-[60] bg-[#111827] overflow-y-auto">
      <div className="sticky top-0 bg-[#1F2937] border-b border-[#374151] flex items-center justify-between px-4 h-14 z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#8B5CF6]" />
          <h1 className="text-lg font-semibold text-white">Features & Methods</h1>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6">
        <div className="flex gap-2 mb-6">
          {(['overview', 'modules'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium capitalize ${
                activeTab === tab ? 'bg-[#8B5CF6] text-white' : 'bg-[#1F2937] text-[#9CA3AF] hover:bg-[#374151]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {activeTab === 'overview' && (
          <div className="space-y-4 text-[#9CA3AF]">
            <p>12 modules • Sales, Purchase, Rental, Studio, Accounts, Expense, Products, Inventory, POS, Contacts, Reports, Settings.</p>
            <p>Design from Figma (mobile-design folder) will be implemented step by step in this app.</p>
          </div>
        )}
        {activeTab === 'modules' && (
          <div className="grid grid-cols-2 gap-3">
            {['Sales', 'Purchase', 'Rental', 'Studio', 'Accounts', 'Expense', 'Products', 'Inventory', 'POS', 'Contacts', 'Reports', 'Settings'].map((name) => (
              <div key={name} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 text-center">
                <p className="font-medium text-white">{name}</p>
                <p className="text-xs text-[#6B7280] mt-1">Coming soon</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
