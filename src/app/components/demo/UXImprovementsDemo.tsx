import React, { useState } from "react";
import { ArrowLeft, Package, Tag, CreditCard } from "lucide-react";
import { Button } from "../ui/button";
import { ProductTypeForm } from "../products/ProductTypeForm";
import { QuickAddDropdown } from "../products/QuickAddDropdown";
import { PaymentModal } from "../transactions/PaymentModal";

export function UXImprovementsDemo() {
  const [activeDemo, setActiveDemo] = useState<'overview' | 'product' | 'dropdown' | 'payment'>('overview');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {activeDemo === 'overview' ? (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">ERP UX Improvements</h1>
            <p className="text-gray-400">Modern dark-mode enhancements for better user experience</p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: Product Type Selection */}
            <button
              onClick={() => setActiveDemo('product')}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-blue-600 transition-all group text-left"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-blue-600/20 group-hover:bg-blue-600/30 transition-colors">
                  <Package className="size-6 text-blue-500" />
                </div>
                <h3 className="text-lg font-bold text-white">Product Type Selection</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Segmented control for Standard, Variable, and Combo products with dynamic form sections
              </p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li>• Toggle between product types</li>
                <li>• Variants table for Variable products</li>
                <li>• Combo product builder</li>
              </ul>
            </button>

            {/* Feature 2: Quick Add Dropdown */}
            <button
              onClick={() => setActiveDemo('dropdown')}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-green-600 transition-all group text-left"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-green-600/20 group-hover:bg-green-600/30 transition-colors">
                  <Tag className="size-6 text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-white">Quick Add Dropdown</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Enhanced dropdown with inline "Add New" functionality for brands and categories
              </p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li>• List items with divider</li>
                <li>• Add New button in dropdown</li>
                <li>• Popover modal for quick entry</li>
              </ul>
            </button>

            {/* Feature 3: Payment Modal */}
            <button
              onClick={() => setActiveDemo('payment')}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-purple-600 transition-all group text-left"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-purple-600/20 group-hover:bg-purple-600/30 transition-colors">
                  <CreditCard className="size-6 text-purple-500" />
                </div>
                <h3 className="text-lg font-bold text-white">Payment Modal Overlay</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Centered payment interface with dimmed background instead of side panel
              </p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li>• Full-width product grid</li>
                <li>• Green "Finalize" button</li>
                <li>• Overlay payment screen</li>
              </ul>
            </button>
          </div>

          {/* Design System Reference */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Design System</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="text-xs text-gray-500">Background</div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded border"
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      borderColor: 'var(--color-border-secondary)'
                    }}
                  ></div>
                  <span className="text-xs text-gray-400">#111827</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-500">Surface</div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded border"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      borderColor: 'var(--color-border-secondary)'
                    }}
                  ></div>
                  <span className="text-xs text-gray-400">#1F2937</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-500">Primary</div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#2563EB] border border-gray-700"></div>
                  <span className="text-xs text-gray-400">#2563EB</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-500">Success</div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-green-600 border border-gray-700"></div>
                  <span className="text-xs text-gray-400">Green-600</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeDemo === 'product' ? (
        <div className="h-screen flex flex-col">
          <div className="p-4 border-b border-gray-800 bg-gray-900 flex items-center gap-4">
            <Button
              onClick={() => setActiveDemo('overview')}
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-lg font-bold text-white">Product Type Selection</h2>
              <p className="text-xs text-gray-400">With segmented control and dynamic sections</p>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <ProductTypeForm
              onCancel={() => setActiveDemo('overview')}
              onSave={() => setActiveDemo('overview')}
            />
          </div>
        </div>
      ) : activeDemo === 'dropdown' ? (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              onClick={() => setActiveDemo('overview')}
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-white">Quick Add Dropdown</h2>
              <p className="text-sm text-gray-400">Enhanced dropdown with inline add functionality</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-blue-400 mb-4">Example: Brand Selector</h3>
              <QuickAddDropdown
                placeholder="Select Brand"
                items={[
                  { value: 'gul_ahmed', label: 'Gul Ahmed' },
                  { value: 'sapphire', label: 'Sapphire' },
                  { value: 'khaadi', label: 'Khaadi' },
                  { value: 'j_dot', label: 'J.' },
                ]}
                onAddNew={(name) => {
                  console.log('New brand:', name);
                  alert(`New brand "${name}" would be created`);
                }}
                addNewLabel="Add New Brand"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-green-400 mb-4">Example: Category Selector</h3>
              <QuickAddDropdown
                placeholder="Select Category"
                items={[
                  { value: 'unstitched', label: 'Unstitched' },
                  { value: 'pret', label: 'Pret (Ready to Wear)' },
                  { value: 'bedding', label: 'Bedding' },
                  { value: 'fabric', label: 'Raw Fabric' },
                ]}
                onAddNew={(name) => {
                  console.log('New category:', name);
                  alert(`New category "${name}" would be created`);
                }}
                addNewLabel="Add New Category"
              />
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase">Features</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>✓ Opens list of existing items</li>
                <li>✓ Horizontal divider before action</li>
                <li>✓ Blue "+ Add New" button at bottom</li>
                <li>✓ Mini modal (300x200px) for quick entry</li>
                <li>✓ Auto-closes and refreshes list</li>
              </ul>
            </div>
          </div>
        </div>
      ) : activeDemo === 'payment' ? (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              onClick={() => setActiveDemo('overview')}
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-white">Payment Modal Overlay</h2>
              <p className="text-sm text-gray-400">Centered payment interface with dimmed background</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-purple-400">New Payment Flow</h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                  <div>
                    <div className="font-semibold text-white">Main Drawer</div>
                    <div className="text-gray-400">Product grid takes full width. Green "Finalize Sale" button at bottom.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                  <div>
                    <div className="font-semibold text-white">Payment Modal</div>
                    <div className="text-gray-400">Overlay screen with dimmed background. Payment card centered on screen.</div>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full bg-green-600 hover:bg-green-500 text-white h-14 text-lg font-bold shadow-lg shadow-green-600/20"
            >
              Preview Payment Modal
            </Button>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase">Changes</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>✗ Removed right-side payment panel</li>
                <li>✓ Product grid expands to full width</li>
                <li>✓ Prominent green "Finalize" button</li>
                <li>✓ Payment modal with overlay background</li>
                <li>✓ Back arrow for easy navigation</li>
              </ul>
            </div>
          </div>

          {/* Payment Modal */}
          <PaymentModal
            isOpen={isPaymentModalOpen}
            onClose={() => setIsPaymentModalOpen(false)}
            onConfirm={(data) => {
              console.log('Payment confirmed:', data);
              setIsPaymentModalOpen(false);
              alert('Payment confirmed! Check console for details.');
            }}
            grandTotal={45250}
            transactionType="sale"
          />
        </div>
      ) : null}
    </div>
  );
}
