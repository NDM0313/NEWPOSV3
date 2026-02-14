import { MapPin, ChevronRight } from 'lucide-react';
import { User, Branch } from '../App';

interface BranchSelectionProps {
  user: User;
  onBranchSelect: (branch: Branch) => void;
}

const mockBranches: Branch[] = [
  { id: '1', name: 'Main Branch (HQ)', location: 'Karachi, Pakistan' },
  { id: '2', name: 'Lahore Branch', location: 'Lahore, Pakistan' },
  { id: '3', name: 'Islamabad Branch', location: 'Islamabad, Pakistan' },
];

export function BranchSelection({ user, onBranchSelect }: BranchSelectionProps) {
  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="pt-8 pb-6 text-center">
        <h1 className="text-xl font-semibold mb-2">Welcome, {user.name}</h1>
        <p className="text-sm text-[#9CA3AF]">Select your branch to continue</p>
      </div>

      {/* Branch List */}
      <div className="space-y-3 max-w-md mx-auto">
        {mockBranches.map((branch) => (
          <button
            key={branch.id}
            onClick={() => onBranchSelect(branch)}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#3B82F6]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6 text-[#3B82F6]" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-medium text-[#F9FAFB] mb-1">{branch.name}</h3>
                <p className="text-sm text-[#9CA3AF]">{branch.location}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6B7280] group-hover:text-[#3B82F6] transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
