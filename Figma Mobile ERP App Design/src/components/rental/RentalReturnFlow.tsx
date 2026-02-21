import { useState } from 'react';
import { ArrowLeft, CheckCircle, Camera, AlertTriangle, XCircle, DollarSign } from 'lucide-react';

interface RentalReturnFlowProps {
  booking: {
    id: string;
    bookingNumber: string;
    customerName: string;
    customerCnic: string;
    productName: string;
    deliveryDate: string;
    returnDate: string;
    expectedReturnDate: string;
  };
  onBack: () => void;
  onComplete: () => void;
}

type DamageLevel = 'none' | 'minor' | 'major';

export function RentalReturnFlow({ booking, onBack, onComplete }: RentalReturnFlowProps) {
  const [step, setStep] = useState<'verify' | 'inspect' | 'damage' | 'penalty' | 'complete'>('verify');
  const [productPhotoTaken, setProductPhotoTaken] = useState(false);
  const [damageLevel, setDamageLevel] = useState<DamageLevel>('none');
  const [damageNotes, setDamageNotes] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState(0);

  const isLateReturn = new Date() > new Date(booking.expectedReturnDate);
  const daysLate = isLateReturn 
    ? Math.ceil((new Date().getTime() - new Date(booking.expectedReturnDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const lateFee = daysLate * 1000; // Rs. 1000 per day late fee

  // STEP 1: Verify Return
  if (step === 'verify') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Return Process</h1>
              <p className="text-xs text-[#9CA3AF]">Step 1: Verify return</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {isLateReturn && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-[#EF4444] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-[#EF4444] mb-1">Late Return!</p>
                  <p className="text-xs text-[#D1D5DB]">
                    {daysLate} {daysLate === 1 ? 'day' : 'days'} late • Late fee: Rs. {lateFee.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Booking Details */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Rental Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Booking No.</span>
                <span className="font-semibold text-white">{booking.bookingNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Customer</span>
                <span className="font-medium text-white">{booking.customerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Item</span>
                <span className="font-medium text-white">{booking.productName}</span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Delivery Date</span>
              <span className="text-white">{new Date(booking.deliveryDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Expected Return</span>
              <span className="text-white">{new Date(booking.expectedReturnDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-[#374151]">
              <span className="text-white font-medium">Actual Return</span>
              <span className={`font-semibold ${isLateReturn ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                {new Date().toLocaleDateString()}
                {isLateReturn && ` (+${daysLate})`}
              </span>
            </div>
          </div>

          <button
            onClick={() => setStep('inspect')}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg font-semibold"
          >
            Start Product Inspection
          </button>
        </div>
      </div>
    );
  }

  // STEP 2: Product Inspection
  if (step === 'inspect') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setStep('verify')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Product Inspection</h1>
              <p className="text-xs text-[#9CA3AF]">Step 2: Check condition</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Product Info */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">👗</div>
              <div className="flex-1">
                <p className="font-semibold text-white">{booking.productName}</p>
                <p className="text-xs text-[#6B7280]">Inspect carefully for damage</p>
              </div>
            </div>
          </div>

          {/* Take Return Photo */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Product Photo (After Return)</h3>
            <button
              onClick={() => setProductPhotoTaken(true)}
              className={`w-full h-40 rounded-lg border-2 border-dashed transition-all ${
                productPhotoTaken
                  ? 'bg-[#10B981]/10 border-[#10B981]'
                  : 'bg-[#111827] border-[#374151] hover:border-[#8B5CF6]'
              } flex flex-col items-center justify-center gap-2`}
            >
              {productPhotoTaken ? (
                <>
                  <CheckCircle size={40} className="text-[#10B981]" />
                  <span className="text-sm font-medium text-[#10B981]">Photo Taken</span>
                  <span className="text-xs text-[#6B7280]">Tap to retake</span>
                </>
              ) : (
                <>
                  <Camera size={40} className="text-[#6B7280]" />
                  <span className="text-sm font-medium text-white">Take Product Photo</span>
                  <span className="text-xs text-[#6B7280]">Document returned condition</span>
                </>
              )}
            </button>
          </div>

          {/* Inspection Checklist */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Inspection Checklist</h3>
            <div className="space-y-2">
              {[
                'Check for tears or stains',
                'Verify all accessories returned',
                'Check buttons and zippers',
                'Inspect embroidery/embellishments',
                'Check for missing items',
              ].map((item, index) => (
                <label key={index} className="flex items-center gap-3 p-2 bg-[#111827] rounded-lg cursor-pointer hover:bg-[#1F2937] transition-colors">
                  <input type="checkbox" className="w-5 h-5 rounded border-[#374151]" />
                  <span className="text-sm text-[#D1D5DB]">{item}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep('damage')}
            disabled={!productPhotoTaken}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-[#374151] disabled:text-[#6B7280] text-white rounded-lg font-semibold"
          >
            Continue to Damage Assessment
          </button>
        </div>
      </div>
    );
  }

  // STEP 3: Damage Assessment
  if (step === 'damage') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setStep('inspect')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Damage Assessment</h1>
              <p className="text-xs text-[#9CA3AF]">Step 3: Evaluate condition</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg p-3 flex gap-2">
            <AlertTriangle size={16} className="text-[#3B82F6] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#D1D5DB]">
              Select damage level based on inspection. Penalties will be applied for damaged items.
            </p>
          </div>

          {/* Damage Level Selection */}
          <div className="space-y-3">
            {/* No Damage */}
            <button
              onClick={() => {
                setDamageLevel('none');
                setPenaltyAmount(0);
              }}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                damageLevel === 'none'
                  ? 'bg-[#10B981]/10 border-[#10B981]'
                  : 'bg-[#1F2937] border-[#374151] hover:border-[#10B981]'
              }`}
            >
              <div className="flex items-start gap-3">
                <CheckCircle size={24} className={damageLevel === 'none' ? 'text-[#10B981]' : 'text-[#6B7280]'} />
                <div className="flex-1">
                  <h4 className={`font-semibold mb-1 ${damageLevel === 'none' ? 'text-[#10B981]' : 'text-white'}`}>
                    No Damage
                  </h4>
                  <p className="text-xs text-[#9CA3AF]">Product returned in excellent condition</p>
                  <p className="text-sm font-semibold text-[#10B981] mt-2">Penalty: Rs. 0</p>
                </div>
              </div>
            </button>

            {/* Minor Damage */}
            <button
              onClick={() => {
                setDamageLevel('minor');
                setPenaltyAmount(5000);
              }}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                damageLevel === 'minor'
                  ? 'bg-[#F59E0B]/10 border-[#F59E0B]'
                  : 'bg-[#1F2937] border-[#374151] hover:border-[#F59E0B]'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={24} className={damageLevel === 'minor' ? 'text-[#F59E0B]' : 'text-[#6B7280]'} />
                <div className="flex-1">
                  <h4 className={`font-semibold mb-1 ${damageLevel === 'minor' ? 'text-[#F59E0B]' : 'text-white'}`}>
                    Minor Damage
                  </h4>
                  <p className="text-xs text-[#9CA3AF]">Small stains, loose threads, fixable issues</p>
                  <p className="text-sm font-semibold text-[#F59E0B] mt-2">Penalty: Rs. 5,000</p>
                </div>
              </div>
            </button>

            {/* Major Damage */}
            <button
              onClick={() => {
                setDamageLevel('major');
                setPenaltyAmount(15000);
              }}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                damageLevel === 'major'
                  ? 'bg-[#EF4444]/10 border-[#EF4444]'
                  : 'bg-[#1F2937] border-[#374151] hover:border-[#EF4444]'
              }`}
            >
              <div className="flex items-start gap-3">
                <XCircle size={24} className={damageLevel === 'major' ? 'text-[#EF4444]' : 'text-[#6B7280]'} />
                <div className="flex-1">
                  <h4 className={`font-semibold mb-1 ${damageLevel === 'major' ? 'text-[#EF4444]' : 'text-white'}`}>
                    Major Damage
                  </h4>
                  <p className="text-xs text-[#9CA3AF]">Tears, permanent stains, missing items, unrepairable</p>
                  <p className="text-sm font-semibold text-[#EF4444] mt-2">Penalty: Rs. 15,000+</p>
                </div>
              </div>
            </button>
          </div>

          {/* Damage Notes */}
          {damageLevel !== 'none' && (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="text-sm font-medium text-white mb-2 block">
                Damage Description <span className="text-[#EF4444]">*</span>
              </label>
              <textarea
                value={damageNotes}
                onChange={(e) => setDamageNotes(e.target.value)}
                placeholder="Describe the damage in detail..."
                rows={4}
                className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          )}

          {/* Custom Penalty Amount */}
          {damageLevel === 'major' && (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="text-sm font-medium text-white mb-3 block">
                Penalty Amount (Adjustable)
              </label>
              <input
                type="number"
                value={penaltyAmount}
                onChange={(e) => setPenaltyAmount(Number(e.target.value))}
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-lg font-semibold text-center text-white focus:outline-none focus:border-[#EF4444]"
              />
            </div>
          )}

          <button
            onClick={() => setStep('penalty')}
            disabled={damageLevel !== 'none' && !damageNotes}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-[#374151] disabled:text-[#6B7280] text-white rounded-lg font-semibold"
          >
            {damageLevel === 'none' ? 'Complete Return' : 'Calculate Final Amount'}
          </button>
        </div>
      </div>
    );
  }

  // STEP 4: Penalty Calculation & Payment
  if (step === 'penalty') {
    const totalPenalty = penaltyAmount + lateFee;
    const hasCharges = totalPenalty > 0;

    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setStep('damage')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Final Settlement</h1>
              <p className="text-xs text-[#9CA3AF]">Step 4: Calculate charges</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Damage Summary */}
          {damageLevel !== 'none' && (
            <div className={`border-2 rounded-xl p-4 ${
              damageLevel === 'minor' 
                ? 'bg-[#F59E0B]/10 border-[#F59E0B]' 
                : 'bg-[#EF4444]/10 border-[#EF4444]'
            }`}>
              <h3 className={`font-semibold mb-2 ${damageLevel === 'minor' ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                {damageLevel === 'minor' ? 'Minor' : 'Major'} Damage Detected
              </h3>
              <p className="text-sm text-[#D1D5DB] mb-3">{damageNotes}</p>
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <span className="text-sm text-[#9CA3AF]">Damage Penalty</span>
                <span className={`text-xl font-bold ${damageLevel === 'minor' ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                  Rs. {penaltyAmount.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Late Fee */}
          {isLateReturn && (
            <div className="bg-[#EF4444]/10 border-2 border-[#EF4444] rounded-xl p-4">
              <h3 className="font-semibold text-[#EF4444] mb-2">Late Return Fee</h3>
              <p className="text-sm text-[#D1D5DB] mb-3">
                Returned {daysLate} {daysLate === 1 ? 'day' : 'days'} late @ Rs. 1,000/day
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-[#EF4444]/30">
                <span className="text-sm text-[#9CA3AF]">Late Fee</span>
                <span className="text-xl font-bold text-[#EF4444]">Rs. {lateFee.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Total Charges */}
          {hasCharges ? (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-white">Charge Breakdown</h3>
              {penaltyAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#9CA3AF]">Damage Penalty</span>
                  <span className="font-semibold text-[#EF4444]">Rs. {penaltyAmount.toLocaleString()}</span>
                </div>
              )}
              {lateFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#9CA3AF]">Late Fee</span>
                  <span className="font-semibold text-[#EF4444]">Rs. {lateFee.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold pt-3 border-t border-[#374151]">
                <span className="text-white">Total Charges</span>
                <span className="text-[#EF4444]">Rs. {totalPenalty.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#10B981]/10 border-2 border-[#10B981] rounded-xl p-6 text-center">
              <CheckCircle size={48} className="text-[#10B981] mx-auto mb-3" />
              <h3 className="font-semibold text-[#10B981] mb-2">No Charges!</h3>
              <p className="text-sm text-[#D1D5DB]">
                Product returned on time in perfect condition
              </p>
            </div>
          )}

          {/* CNIC Release */}
          <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <CheckCircle size={18} className="text-[#3B82F6] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[#D1D5DB]">
                <p className="font-medium text-white mb-1">Security Documents</p>
                <p>Customer CNIC will be returned after {hasCharges ? 'payment settlement' : 'confirmation'}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep('complete')}
            className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-semibold"
          >
            {hasCharges ? 'Collect Charges & Complete' : 'Complete Return'}
          </button>
        </div>
      </div>
    );
  }

  // STEP 5: Completion
  const totalCharges = penaltyAmount + lateFee;
  
  return (
    <div className="min-h-screen pb-24 bg-[#111827] flex items-center justify-center">
      <div className="p-8 text-center max-w-md mx-auto">
        <div className="w-20 h-20 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-[#10B981]" />
        </div>
        
        <h2 className="text-2xl font-bold mb-2 text-white">Return Complete!</h2>
        <p className="text-[#9CA3AF] mb-6">Rental booking closed successfully</p>
        
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 mb-6 text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Booking Status</span>
            <span className="px-2 py-0.5 bg-[#10B981]/10 border border-[#10B981]/30 rounded text-xs font-medium text-[#10B981]">
              COMPLETED
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Condition</span>
            <span className={`font-medium ${
              damageLevel === 'none' ? 'text-[#10B981]' :
              damageLevel === 'minor' ? 'text-[#F59E0B]' : 'text-[#EF4444]'
            }`}>
              {damageLevel === 'none' ? 'Excellent' : damageLevel === 'minor' ? 'Minor Damage' : 'Major Damage'}
            </span>
          </div>
          {totalCharges > 0 && (
            <>
              <div className="flex justify-between text-sm border-t border-[#374151] pt-3">
                <span className="text-[#6B7280]">Total Charges</span>
                <span className="font-semibold text-[#EF4444]">Rs. {totalCharges.toLocaleString()}</span>
              </div>
              {penaltyAmount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#6B7280]">• Damage Penalty</span>
                  <span className="text-[#9CA3AF]">Rs. {penaltyAmount.toLocaleString()}</span>
                </div>
              )}
              {lateFee > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#6B7280]">• Late Fee</span>
                  <span className="text-[#9CA3AF]">Rs. {lateFee.toLocaleString()}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between text-sm border-t border-[#374151] pt-3">
            <span className="text-[#10B981]">CNIC Status</span>
            <span className="font-medium text-[#10B981]">Returned</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#10B981]">Product Status</span>
            <span className="font-medium text-[#10B981]">Available for Rent</span>
          </div>
        </div>

        <button
          onClick={onComplete}
          className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-semibold mb-3"
        >
          Done
        </button>
        
        <button
          onClick={() => {/* Print return receipt */}}
          className="w-full h-12 bg-[#374151] hover:bg-[#4B5563] text-white rounded-lg font-medium"
        >
          Print Return Receipt
        </button>
      </div>
    </div>
  );
}
