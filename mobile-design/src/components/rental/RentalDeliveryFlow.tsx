import { useState } from 'react';
import { ArrowLeft, CheckCircle, FileText, Camera, AlertCircle } from 'lucide-react';

interface RentalDeliveryFlowProps {
  booking: {
    id: string;
    bookingNumber: string;
    customerName: string;
    customerCnic: string;
    productName: string;
    totalRent: number;
    advancePaid: number;
    remainingAmount: number;
    deliveryDate: string;
    returnDate: string;
  };
  onBack: () => void;
  onComplete: () => void;
}

export function RentalDeliveryFlow({ booking, onBack, onComplete }: RentalDeliveryFlowProps) {
  const [step, setStep] = useState<'verify' | 'payment' | 'documents' | 'handover' | 'complete'>('verify');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'card'>('cash');
  const [cnicPhotoTaken, setCnicPhotoTaken] = useState(false);
  const [productPhotoTaken, setProductPhotoTaken] = useState(false);

  // STEP 1: Verify Customer & Booking
  if (step === 'verify') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Delivery Process</h1>
              <p className="text-xs text-[#9CA3AF]">Step 1: Verify Details</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="text-[#3B82F6] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[#D1D5DB]">
                <p className="font-medium text-white mb-1">Delivery Checklist</p>
                <ul className="space-y-1">
                  <li>✓ Verify customer identity (CNIC)</li>
                  <li>✓ Collect remaining payment</li>
                  <li>✓ Take CNIC photocopy/photo for security</li>
                  <li>✓ Inspect & handover product</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Booking Details</h3>
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
                <span className="text-[#6B7280]">CNIC</span>
                <span className="font-medium text-white font-mono">{booking.customerCnic}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Item</span>
                <span className="font-medium text-white">{booking.productName}</span>
              </div>
            </div>
          </div>

          {/* Delivery Date */}
          <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#10B981]">Delivery Date (Today)</span>
              <span className="font-semibold text-[#10B981]">
                {new Date(booking.deliveryDate).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Return Date */}
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#F59E0B]">Expected Return</span>
              <span className="font-semibold text-[#F59E0B]">
                {new Date(booking.returnDate).toLocaleDateString()}
              </span>
            </div>
          </div>

          <button
            onClick={() => setStep('payment')}
            className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-semibold"
          >
            Proceed to Payment Collection
          </button>
        </div>
      </div>
    );
  }

  // STEP 2: Collect Remaining Payment
  if (step === 'payment') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setStep('verify')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Collect Payment</h1>
              <p className="text-xs text-[#9CA3AF]">Step 2: Remaining amount</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Payment Summary */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Total Rent</span>
              <span className="font-semibold text-white">Rs. {booking.totalRent.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#10B981]">Advance Paid</span>
              <span className="font-semibold text-[#10B981]">Rs. {booking.advancePaid.toLocaleString()}</span>
            </div>
            <div className="pt-3 border-t border-[#374151]">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-white">Remaining Amount</span>
                <span className="text-2xl font-bold text-[#F59E0B]">
                  Rs. {booking.remainingAmount.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-[#6B7280]">To be collected now</p>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-white mb-3 block">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash', label: 'Cash', icon: '💵' },
                { id: 'bank', label: 'Bank', icon: '🏦' },
                { id: 'card', label: 'Card', icon: '💳' },
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as typeof paymentMethod)}
                  className={`p-4 rounded-lg border transition-all ${
                    paymentMethod === method.id
                      ? 'bg-[#10B981]/10 border-[#10B981] text-white'
                      : 'bg-[#111827] border-[#374151] text-[#9CA3AF]'
                  }`}
                >
                  <div className="text-3xl mb-2">{method.icon}</div>
                  <div className="text-xs font-medium">{method.label}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep('documents')}
            className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-semibold"
          >
            Payment Collected
          </button>
        </div>
      </div>
    );
  }

  // STEP 3: Collect Security Documents
  if (step === 'documents') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setStep('payment')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Security Documents</h1>
              <p className="text-xs text-[#9CA3AF]">Step 3: Collect CNIC</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[#D1D5DB]">
                <p className="font-medium text-white mb-1">Security Protocol</p>
                <p>Customer's CNIC will be kept as security until the product is returned in good condition.</p>
              </div>
            </div>
          </div>

          {/* CNIC Details */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Customer CNIC</h3>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-lg">{booking.customerCnic}</span>
              <FileText className="text-[#8B5CF6]" size={24} />
            </div>
            <p className="text-xs text-[#6B7280]">Verify CNIC matches customer identity</p>
          </div>

          {/* Take CNIC Photo */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">CNIC Photo/Copy</h3>
            <button
              onClick={() => setCnicPhotoTaken(true)}
              className={`w-full h-32 rounded-lg border-2 border-dashed transition-all ${
                cnicPhotoTaken
                  ? 'bg-[#10B981]/10 border-[#10B981]'
                  : 'bg-[#111827] border-[#374151] hover:border-[#8B5CF6]'
              } flex flex-col items-center justify-center gap-2`}
            >
              {cnicPhotoTaken ? (
                <>
                  <CheckCircle size={32} className="text-[#10B981]" />
                  <span className="text-sm font-medium text-[#10B981]">CNIC Photo Taken</span>
                  <span className="text-xs text-[#6B7280]">Tap to retake</span>
                </>
              ) : (
                <>
                  <Camera size={32} className="text-[#6B7280]" />
                  <span className="text-sm font-medium text-white">Take CNIC Photo</span>
                  <span className="text-xs text-[#6B7280]">or upload photocopy</span>
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => setStep('handover')}
            disabled={!cnicPhotoTaken}
            className="w-full h-12 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280] text-white rounded-lg font-semibold"
          >
            Continue to Handover
          </button>
        </div>
      </div>
    );
  }

  // STEP 4: Product Handover
  if (step === 'handover') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setStep('documents')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Product Handover</h1>
              <p className="text-xs text-[#9CA3AF]">Step 4: Final inspection</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Product Info */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Rental Item</h3>
            <div className="flex items-center gap-3">
              <div className="text-4xl">👗</div>
              <div className="flex-1">
                <p className="font-semibold text-white">{booking.productName}</p>
                <p className="text-xs text-[#6B7280]">Inspect before handover</p>
              </div>
            </div>
          </div>

          {/* Condition Checklist */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Pre-Delivery Inspection</h3>
            <div className="space-y-2">
              {[
                'No tears or damage',
                'All accessories included',
                'Clean and pressed',
                'All buttons/zippers working',
              ].map((item, index) => (
                <label key={index} className="flex items-center gap-3 p-2 bg-[#111827] rounded-lg cursor-pointer hover:bg-[#1F2937] transition-colors">
                  <input type="checkbox" className="w-5 h-5 rounded border-[#374151]" />
                  <span className="text-sm text-[#D1D5DB]">{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Take Product Photo */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Product Photo (Before Handover)</h3>
            <button
              onClick={() => setProductPhotoTaken(true)}
              className={`w-full h-32 rounded-lg border-2 border-dashed transition-all ${
                productPhotoTaken
                  ? 'bg-[#10B981]/10 border-[#10B981]'
                  : 'bg-[#111827] border-[#374151] hover:border-[#8B5CF6]'
              } flex flex-col items-center justify-center gap-2`}
            >
              {productPhotoTaken ? (
                <>
                  <CheckCircle size={32} className="text-[#10B981]" />
                  <span className="text-sm font-medium text-[#10B981]">Photo Taken</span>
                  <span className="text-xs text-[#6B7280]">Tap to retake</span>
                </>
              ) : (
                <>
                  <Camera size={32} className="text-[#6B7280]" />
                  <span className="text-sm font-medium text-white">Take Product Photo</span>
                  <span className="text-xs text-[#6B7280]">For condition record</span>
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => setStep('complete')}
            disabled={!productPhotoTaken}
            className="w-full h-12 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280] text-white rounded-lg font-semibold"
          >
            Complete Handover
          </button>
        </div>
      </div>
    );
  }

  // STEP 5: Completion
  return (
    <div className="min-h-screen pb-24 bg-[#111827] flex items-center justify-center">
      <div className="p-8 text-center max-w-md mx-auto">
        <div className="w-20 h-20 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-[#10B981]" />
        </div>
        
        <h2 className="text-2xl font-bold mb-2 text-white">Delivery Complete!</h2>
        <p className="text-[#9CA3AF] mb-6">Product handed over to customer</p>
        
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 mb-6 text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Status Updated</span>
            <span className="px-2 py-0.5 bg-[#10B981]/10 border border-[#10B981]/30 rounded text-xs font-medium text-[#10B981]">
              DELIVERED
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Payment Collected</span>
            <span className="font-semibold text-[#10B981]">Rs. {booking.remainingAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Security</span>
            <span className="font-medium text-white">CNIC Kept</span>
          </div>
          <div className="flex justify-between text-sm border-t border-[#374151] pt-3">
            <span className="text-[#F59E0B]">Expected Return</span>
            <span className="font-semibold text-[#F59E0B]">
              {new Date(booking.returnDate).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg p-4 mb-6 text-xs text-left text-[#D1D5DB]">
          <p className="font-medium text-white mb-2">Next Steps:</p>
          <ul className="space-y-1">
            <li>✓ Product is now with customer</li>
            <li>✓ CNIC kept as security</li>
            <li>✓ Return expected on {new Date(booking.returnDate).toLocaleDateString()}</li>
            <li>✓ Process return & inspect condition</li>
          </ul>
        </div>

        <button
          onClick={onComplete}
          className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-semibold mb-3"
        >
          Done
        </button>
        
        <button
          onClick={() => {/* Print delivery receipt */}}
          className="w-full h-12 bg-[#374151] hover:bg-[#4B5563] text-white rounded-lg font-medium"
        >
          Print Delivery Receipt
        </button>
      </div>
    </div>
  );
}
