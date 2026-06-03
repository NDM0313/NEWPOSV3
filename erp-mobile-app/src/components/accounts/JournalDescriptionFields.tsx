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
  return (
    <>
      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
        <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Auto description</label>
        <p className="text-sm text-[#9CA3AF] leading-relaxed whitespace-pre-wrap break-words">{autoDescription}</p>
        <p className="text-[10px] text-[#6B7280] mt-2">Saved with your add-on and reference below.</p>
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
          placeholder="Add extra description or details (auto description is added by system)..."
          rows={3}
          className={`w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none ${focusBorderClass} resize-none`}
        />
      </div>
    </>
  );
}
