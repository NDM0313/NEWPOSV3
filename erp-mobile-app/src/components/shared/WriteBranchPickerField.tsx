import { MapPin } from 'lucide-react';
import type { Branch } from '../../api/branches';
import { CustomSelect } from '../common/CustomSelect';

interface WriteBranchPickerFieldProps {
  branches: Branch[];
  value: string;
  onChange: (branchId: string) => void;
  helperText?: string;
  zIndexClass?: string;
}

export function WriteBranchPickerField({
  branches,
  value,
  onChange,
  helperText = 'This transaction will be recorded under the selected branch.',
  zIndexClass = 'z-[90]',
}: WriteBranchPickerFieldProps) {
  if (branches.length === 0) return null;

  return (
    <div className="bg-[#111827] border border-[#374151] rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1.5">
        <MapPin className="w-4 h-4 text-[#10B981] shrink-0" />
        <span className="text-xs text-[#9CA3AF]">Branch *</span>
      </div>
      <CustomSelect
        value={value}
        onChange={onChange}
        options={[
          { value: '', label: 'Select branch' },
          ...branches.map((b) => ({ value: b.id, label: b.name, subtitle: b.location })),
        ]}
        placeholder="Select branch"
        zIndexClass={zIndexClass}
      />
      {helperText ? <p className="text-xs text-[#6B7280] mt-2">{helperText}</p> : null}
    </div>
  );
}
