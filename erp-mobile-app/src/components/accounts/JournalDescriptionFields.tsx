import { useState } from 'react';
import {
  readJournalAutoDescriptionEnabled,
  writeJournalAutoDescriptionEnabled,
} from '../../utils/journalEntryDescription';

interface JournalDescriptionFieldsProps {
  autoDescription: string;
  userNotes: string;
  onUserNotesChange: (value: string) => void;
  reference: string;
  onReferenceChange: (value: string) => void;
  referenceLabel?: string;
  referencePlaceholder?: string;
  focusBorderClass?: string;
}

export function JournalDescriptionFields({
  autoDescription,
  userNotes,
  onUserNotesChange,
  reference,
  onReferenceChange,
  referenceLabel = 'Reference # (Optional)',
  referencePlaceholder = 'e.g., TRF-001, Cheque #123',
  focusBorderClass = 'focus:border-[#3B82F6]',
}: JournalDescriptionFieldsProps) {
  const [autoEnabled, setAutoEnabled] = useState(readJournalAutoDescriptionEnabled);

  const setEnabled = (next: boolean) => {
    setAutoEnabled(next);
    writeJournalAutoDescriptionEnabled(next);
  };

  return (
    <>
      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <label className="block text-sm font-medium text-[#D1D5DB]">Auto description</label>
          <div
            className="inline-flex rounded-lg border border-[#4B5563] overflow-hidden shrink-0"
            role="group"
            aria-label="Auto description on or off"
          >
            <button
              type="button"
              onClick={() => setEnabled(true)}
              className={`px-3 py-1.5 text-xs font-bold tracking-wide transition-colors ${
                autoEnabled
                  ? 'bg-[#4F46E5] text-white'
                  : 'bg-[#374151] text-[#9CA3AF] hover:text-white'
              }`}
            >
              ON
            </button>
            <button
              type="button"
              onClick={() => setEnabled(false)}
              className={`px-3 py-1.5 text-xs font-bold tracking-wide transition-colors border-l border-[#4B5563] ${
                !autoEnabled
                  ? 'bg-[#6B7280] text-white'
                  : 'bg-[#374151] text-[#9CA3AF] hover:text-white'
              }`}
            >
              OFF
            </button>
          </div>
        </div>
        {autoEnabled ? (
          <>
            <p className="text-sm text-[#9CA3AF] leading-relaxed whitespace-pre-wrap break-words">
              {autoDescription}
            </p>
            <p className="text-[10px] text-[#6B7280] mt-2">Saved with your add-on and reference below.</p>
          </>
        ) : (
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Auto description is OFF. Only Reference and Description add-on are saved.
          </p>
        )}
      </div>

      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
        <label className="block text-sm font-medium text-[#D1D5DB] mb-2">{referenceLabel}</label>
        <input
          type="text"
          value={reference}
          onChange={(e) => onReferenceChange(e.target.value)}
          placeholder={referencePlaceholder}
          className={`w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none ${focusBorderClass}`}
        />
      </div>

      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
        <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Description add-on (Optional)</label>
        <textarea
          value={userNotes}
          onChange={(e) => onUserNotesChange(e.target.value)}
          placeholder="Add extra description or details..."
          rows={3}
          className={`w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none ${focusBorderClass} resize-none`}
        />
      </div>
    </>
  );
}
