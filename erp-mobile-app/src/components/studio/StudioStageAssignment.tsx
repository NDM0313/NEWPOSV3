import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Calendar, DollarSign, User, Tag, Loader2 } from 'lucide-react';
import * as studioApi from '../../api/studio';
import type { StudioStage } from './StudioDashboard';

interface StudioStageAssignmentProps {
  companyId: string;
  onBack: () => void;
  onComplete: (stageData: Partial<StudioStage>) => void;
  existingStage?: StudioStage;
}

const STAGE_TYPES = [
  { id: 'dyeing', name: 'Dyeing', icon: '🎨', description: 'Fabric dyeing & color work' },
  { id: 'stitching', name: 'Stitching', icon: '🧵', description: 'Sewing & construction' },
  { id: 'handwork', name: 'Handwork', icon: '✋', description: 'Manual detailing' },
  { id: 'embroidery', name: 'Embroidery', icon: '🌸', description: 'Thread & bead work' },
  { id: 'finishing', name: 'Finishing', icon: '✨', description: 'Final touches & pressing' },
  { id: 'quality-check', name: 'Quality Check', icon: '✓', description: 'Inspection & QA' },
] as const;

export function StudioStageAssignment({ companyId, onBack, onComplete, existingStage }: StudioStageAssignmentProps) {
  const [step, setStep] = useState(1);
  const [stageType, setStageType] = useState<(typeof STAGE_TYPES)[number]['id'] | ''>(existingStage?.type || '');
  const [stageName, setStageName] = useState(existingStage?.name || '');
  const [assignedTo, setAssignedTo] = useState(existingStage?.assignedTo || '');
  const [workerId, setWorkerId] = useState<string | null>(existingStage?.workerId ?? null);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [workersLoading, setWorkersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setWorkersLoading(true);
      const { data, error } = await studioApi.getWorkers(companyId);
      if (!cancelled) {
        setWorkers(data || []);
        setWorkersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);
  const [internalCost, setInternalCost] = useState(
    existingStage?.internalCost != null && existingStage.internalCost !== 0 ? String(existingStage.internalCost) : ''
  );
  const [customerCharge, setCustomerCharge] = useState(
    existingStage?.customerCharge != null && existingStage.customerCharge !== 0 ? String(existingStage.customerCharge) : ''
  );
  const [hasCustomerCharge, setHasCustomerCharge] = useState(existingStage ? existingStage.customerCharge > 0 : false);
  const [expectedDate, setExpectedDate] = useState(existingStage?.expectedDate || '');
  const dateInputRef = useRef<HTMLInputElement>(null);

  /** Format YYYY-MM-DD → DD MMM YYYY (app standard) */
  const formatDisplayDate = (iso: string): string => {
    if (!iso || !iso.trim()) return '';
    const [y, m, d] = iso.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[parseInt(m || '1', 10) - 1] || m;
    return `${d} ${month} ${y}`;
  };

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleComplete = () => {
    if (!expectedDate) return;

    const stageData: Partial<StudioStage> = {
      type: stageType as StudioStage['type'],
      name: stageName,
      assignedTo,
      workerId: workerId ?? undefined,
      internalCost: parseFloat(internalCost) || 0,
      customerCharge: hasCustomerCharge && customerCharge ? parseFloat(customerCharge) : 0,
      expectedDate,
      status: 'pending',
    };

    onComplete(stageData);
  };

  const selectedType = STAGE_TYPES.find((t) => t.id === stageType);

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">{existingStage ? 'Edit Stage' : 'Add Production Stage'}</h1>
            <p className="text-xs text-white/80">Step {step} of 5</p>
          </div>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      </div>

      <div className="p-4">
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Select Stage Type</h2>
            <p className="text-sm text-[#9CA3AF] mb-6">Choose the type of production work</p>
            <div className="space-y-3">
              {STAGE_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setStageType(type.id);
                    setStageName(type.name);
                  }}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    stageType === type.id
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
                      : 'border-[#374151] bg-[#1F2937] hover:border-[#8B5CF6]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{type.icon}</div>
                    <div className="flex-1">
                      <p className="font-semibold text-white mb-1">{type.name}</p>
                      <p className="text-xs text-[#9CA3AF]">{type.description}</p>
                    </div>
                    {stageType === type.id && (
                      <div className="w-5 h-5 bg-[#8B5CF6] rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Stage Name</h2>
            <p className="text-sm text-[#9CA3AF] mb-6">Customize the stage name if needed</p>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{selectedType?.icon}</div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Stage Type</p>
                  <p className="text-sm font-semibold text-white">{selectedType?.name}</p>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">
                <Tag className="w-4 h-4 inline mr-1" />
                Stage Name
              </label>
              <input
                type="text"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="e.g. Premium Dyeing, Expert Stitching"
                className="w-full px-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Assign to Worker</h2>
            <p className="text-sm text-[#9CA3AF] mb-6">Select who will handle this stage</p>
            {workersLoading ? (
              <div className="flex items-center justify-center py-8 text-[#9CA3AF]">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Loading workers…
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setWorkerId(null);
                    setAssignedTo('Unassigned');
                  }}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    workerId === null && assignedTo === 'Unassigned'
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
                      : 'border-[#374151] bg-[#1F2937] hover:border-[#8B5CF6]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#374151] rounded-full flex items-center justify-center">
                      <User size={20} className="text-[#9CA3AF]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">Unassigned</p>
                      <p className="text-xs text-[#9CA3AF]">Assign later</p>
                    </div>
                    {workerId === null && assignedTo === 'Unassigned' && (
                      <div className="w-5 h-5 bg-[#8B5CF6] rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                </button>
                {workers.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setWorkerId(w.id);
                      setAssignedTo(w.name);
                    }}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      workerId === w.id
                        ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
                        : 'border-[#374151] bg-[#1F2937] hover:border-[#8B5CF6]/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#374151] rounded-full flex items-center justify-center">
                        <User size={20} className="text-[#9CA3AF]" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{w.name}</p>
                      </div>
                      {workerId === w.id && (
                        <div className="w-5 h-5 bg-[#8B5CF6] rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Cost & Pricing</h2>
            <p className="text-sm text-[#9CA3AF] mb-6">Set internal cost and optional customer charge</p>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{selectedType?.icon}</div>
                <div>
                  <p className="text-sm font-semibold text-white">{stageName}</p>
                  <p className="text-xs text-[#9CA3AF]">Assigned to: {assignedTo}</p>
                </div>
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2 text-[#EF4444]">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Internal Cost (Required)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">Rs.</span>
                  <input
                    type="number"
                    value={internalCost}
                    onChange={(e) => setInternalCost(e.target.value)}
                    placeholder="500"
                    className="w-full pl-12 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#EF4444]"
                  />
                </div>
                <p className="text-xs text-[#6B7280] mt-1">Cost paid to worker/vendor</p>
              </div>
              <div className="bg-gradient-to-br from-[#1F2937] to-[#111827] border border-[#374151] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white mb-1">Add Customer Charge?</p>
                    <p className="text-xs text-[#9CA3AF]">Can be adjusted later in final bill</p>
                  </div>
                  <button
                    onClick={() => {
                      setHasCustomerCharge(!hasCustomerCharge);
                      if (hasCustomerCharge) setCustomerCharge('');
                    }}
                    className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                      hasCustomerCharge ? 'bg-[#10B981]' : 'bg-[#374151]'
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-lg transition-transform duration-300 ${
                        hasCustomerCharge ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                {hasCustomerCharge && (
                  <div className="mt-4 space-y-2">
                    <label className="block text-sm font-medium text-[#10B981]">
                      <DollarSign className="w-4 h-4 inline mr-1" />
                      Customer Charge
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">Rs.</span>
                      <input
                        type="number"
                        value={customerCharge}
                        onChange={(e) => setCustomerCharge(e.target.value)}
                        placeholder="800"
                        className="w-full pl-12 pr-4 py-3 bg-[#111827] border border-[#10B981]/30 rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
                      />
                    </div>
                    <p className="text-xs text-[#6B7280]">Amount charged to customer</p>
                  </div>
                )}
              </div>
              {hasCustomerCharge &&
                internalCost &&
                customerCharge &&
                parseFloat(customerCharge) > 0 && (
                  <div className="bg-gradient-to-r from-[#374151] to-[#1F2937] rounded-xl p-4 border border-[#10B981]/20">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-[#9CA3AF] mb-1">Estimated Profit</p>
                        <p
                          className={`text-2xl font-bold ${
                            parseFloat(customerCharge) >= parseFloat(internalCost)
                              ? 'text-[#10B981]'
                              : 'text-[#EF4444]'
                          }`}
                        >
                          Rs.{(parseFloat(customerCharge) - parseFloat(internalCost)).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#9CA3AF] mb-1">Margin</p>
                        <p
                          className={`text-lg font-semibold ${
                            parseFloat(customerCharge) >= parseFloat(internalCost)
                              ? 'text-[#10B981]'
                              : 'text-[#EF4444]'
                          }`}
                        >
                          {(
                            ((parseFloat(customerCharge) - parseFloat(internalCost)) / parseFloat(internalCost)) *
                            100
                          ).toFixed(1)}
                          %
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="w-full max-w-full overflow-hidden">
            <h2 className="text-lg font-semibold text-white mb-2">Expected Completion</h2>
            <p className="text-sm text-[#9CA3AF] mb-6">When should this stage be completed?</p>
            <div className="w-full max-w-full min-w-0 overflow-hidden space-y-4">
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 w-full max-w-full min-w-0 overflow-hidden">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <p className="text-xs text-[#9CA3AF]">Stage</p>
                    <p className="text-sm font-semibold text-white">{stageName}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-xs text-[#9CA3AF]">Worker</p>
                    <p className="text-sm text-white">{assignedTo}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-xs text-[#9CA3AF]">Internal Cost</p>
                    <p className="text-sm text-[#EF4444]">Rs. {parseFloat(internalCost || '0').toLocaleString()}</p>
                  </div>
                  {hasCustomerCharge && customerCharge && parseFloat(customerCharge) > 0 && (
                    <div className="flex justify-between">
                      <p className="text-xs text-[#9CA3AF]">Customer Charge</p>
                      <p className="text-sm text-[#10B981]">Rs. {parseFloat(customerCharge).toLocaleString()}</p>
                    </div>
                  )}
                  {!hasCustomerCharge && (
                    <div className="flex justify-between">
                      <p className="text-xs text-[#9CA3AF]">Customer Charge</p>
                      <p className="text-sm text-[#F59E0B]">To be added in final bill</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 w-full max-w-full min-w-0 overflow-hidden">
                <label className="block text-sm font-medium text-white mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Expected Completion Date
                </label>
                <div className="relative min-h-[48px]">
                  <div
                    className="w-full text-left px-4 py-3 bg-[#111827] border border-[#374151] rounded-xl text-white min-h-[48px] flex items-center gap-2 pointer-events-none"
                    aria-hidden="true"
                  >
                    <Calendar className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                    <span className={expectedDate ? 'text-white' : 'text-[#6B7280]'}>
                      {expectedDate ? formatDisplayDate(expectedDate) : 'Select date (DD MMM YYYY)'}
                    </span>
                  </div>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ fontSize: '16px' }}
                    aria-label="Expected completion date"
                    title="Tap to choose date"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="fixed bottom-20 left-0 right-0 p-4 bg-[#111827] border-t border-[#374151] z-20">
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 bg-[#374151] hover:bg-[#4B5563] rounded-xl font-semibold transition-colors text-white"
              >
                Back
              </button>
            )}
            {step < 5 ? (
              <button
                onClick={handleNext}
                disabled={
                  (step === 1 && !stageType) ||
                  (step === 2 && !stageName.trim()) ||
                  (step === 3 && !assignedTo) ||
                  (step === 4 &&
                    (!internalCost ||
                      parseFloat(internalCost) <= 0 ||
                      (hasCustomerCharge && (!customerCharge || parseFloat(customerCharge) <= 0))))
                }
                className="flex-1 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity text-white"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={!expectedDate}
                className="flex-1 py-3 bg-gradient-to-r from-[#10B981] to-[#059669] rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity text-white"
              >
                {existingStage ? 'Update Stage' : 'Add Stage'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
