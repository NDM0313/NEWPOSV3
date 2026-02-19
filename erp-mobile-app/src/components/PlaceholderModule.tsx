import { ArrowLeft } from 'lucide-react';

interface PlaceholderModuleProps {
  title: string;
  onBack: () => void;
}

export function PlaceholderModule({ title, onBack }: PlaceholderModuleProps) {
  return (
    <div className="min-h-screen pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={onBack}
            className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
      </div>
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <p className="text-[#9CA3AF] mb-2">Module</p>
        <p className="text-2xl font-bold text-white mb-4">{title}</p>
        <p className="text-sm text-[#6B7280] max-w-xs">
          Coming soon. Design from Figma (mobile-design) will be implemented here step by step.
        </p>
      </div>
    </div>
  );
}
