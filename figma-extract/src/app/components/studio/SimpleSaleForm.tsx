import React, { useState } from 'react';
import { X, ShoppingCart, User, Phone, Palette, Droplet, Check, Plus } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";

interface SimpleSaleFormProps {
  onSave: (data: any) => void;
  onCancel: () => void;
}

const FABRICS = [
  { id: 'silk', name: 'Pure Silk', price: 2500, image: 'https://images.unsplash.com/photo-1564584217132-2271feaeb3c5?w=200&h=200&fit=crop' },
  { id: 'velvet', name: 'Red Velvet', price: 3000, image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=200&h=200&fit=crop' },
  { id: 'banarasi', name: 'Banarasi Silk', price: 4500, image: 'https://images.unsplash.com/photo-1622122201714-77da0ca8e5d2?w=200&h=200&fit=crop' },
  { id: 'cotton', name: 'Premium Cotton', price: 1500, image: 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=200&h=200&fit=crop' },
  { id: 'chiffon', name: 'Chiffon', price: 2000, image: 'https://images.unsplash.com/photo-1583391733981-5afd6f2e9b82?w=200&h=200&fit=crop' },
  { id: 'georgette', name: 'Georgette', price: 2200, image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=200&h=200&fit=crop' }
];

const LACE_OPTIONS = [
  { id: 'floral', name: 'Floral Lace', price: 300 },
  { id: 'geometric', name: 'Geometric Lace', price: 350 },
  { id: 'vintage', name: 'Vintage Lace', price: 400 },
  { id: 'modern', name: 'Modern Lace', price: 250 }
];

const DYEING_TYPES = [
  { id: 'solid', name: 'Solid Color', price: 500 },
  { id: 'gradient', name: 'Gradient', price: 600 },
  { id: 'none', name: 'No Dyeing', price: 0 }
];

const COLOR_PALETTE = [
  { name: 'Red', value: '#DC2626' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Purple', value: '#9333EA' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Yellow', value: '#FBBF24' },
  { name: 'Gold', value: '#FFD700' },
  { name: 'Maroon', value: '#800000' }
];

export const SimpleSaleForm: React.FC<SimpleSaleFormProps> = ({ onSave, onCancel }) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedFabric, setSelectedFabric] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  
  // Customization
  const [selectedLace, setSelectedLace] = useState<string | null>(null);
  const [laceQuantity, setLaceQuantity] = useState(1);
  const [selectedDyeing, setSelectedDyeing] = useState<string>('none');
  const [primaryColor, setPrimaryColor] = useState('#DC2626');
  const [secondaryColor, setSecondaryColor] = useState<string | null>(null);
  
  // Workflow flags
  const [needsTailoring, setNeedsTailoring] = useState(false);
  const [needsHandcraft, setNeedsHandcraft] = useState(false);
  
  const [notes, setNotes] = useState('');

  const calculateTotal = () => {
    let total = 0;
    
    // Fabric
    if (selectedFabric) {
      const fabric = FABRICS.find(f => f.id === selectedFabric);
      if (fabric) total += fabric.price * quantity;
    }
    
    // Lace
    if (selectedLace) {
      const lace = LACE_OPTIONS.find(l => l.id === selectedLace);
      if (lace) total += lace.price * laceQuantity;
    }
    
    // Dyeing
    if (selectedDyeing !== 'none') {
      const dyeing = DYEING_TYPES.find(d => d.id === selectedDyeing);
      if (dyeing) total += dyeing.price * quantity;
    }
    
    return total;
  };

  const handleSubmit = () => {
    if (!customerName || !customerPhone || !selectedFabric) {
      alert('Please fill all required fields');
      return;
    }

    const fabric = FABRICS.find(f => f.id === selectedFabric);
    const lace = selectedLace ? LACE_OPTIONS.find(l => l.id === selectedLace) : null;
    const dyeing = DYEING_TYPES.find(d => d.id === selectedDyeing);

    const saleData = {
      customerName,
      customerPhone,
      fabric: {
        type: fabric?.name || '',
        quantity,
        price: (fabric?.price || 0) * quantity
      },
      customization: {
        ...(lace && {
          lace: {
            style: lace.name,
            width: '2"',
            price: lace.price * laceQuantity
          }
        }),
        ...(selectedDyeing !== 'none' && dyeing && {
          dyeing: {
            type: dyeing.name,
            colors: secondaryColor ? [primaryColor, secondaryColor] : [primaryColor],
            price: dyeing.price * quantity
          }
        }),
        colors: {
          primary: primaryColor,
          ...(secondaryColor && { secondary: secondaryColor })
        }
      },
      needsTailoring,
      needsHandcraft,
      totalAmount: calculateTotal(),
      notes
    };

    onSave(saleData);
  };

  return (
    <div className="min-h-screen bg-[#111827] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShoppingCart className="text-purple-400" size={28} />
              Simple Sale & Fabric Creation
            </h2>
            <p className="text-gray-400 mt-1">Create sale invoice with fabric customization</p>
          </div>
          <Button
            variant="outline"
            onClick={onCancel}
            className="bg-gray-900 border-gray-800 text-gray-300"
          >
            <X size={16} className="mr-2" />
            Cancel
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="col-span-2 space-y-6">
            {/* Customer Info */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User size={20} className="text-purple-400" />
                Customer Information
              </h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-400 mb-2 block">Customer Name *</Label>
                  <Input
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 mb-2 block">Phone Number *</Label>
                  <Input
                    placeholder="+92 300 1234567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Fabric Selection */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Palette size={20} className="text-purple-400" />
                Select Fabric *
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {FABRICS.map(fabric => (
                  <button
                    key={fabric.id}
                    onClick={() => setSelectedFabric(fabric.id)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                      selectedFabric === fabric.id
                        ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <img src={fabric.image} alt={fabric.name} className="w-full h-24 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <div className="text-white text-xs font-semibold">{fabric.name}</div>
                      <div className="text-purple-400 text-xs">₹{fabric.price}/m</div>
                    </div>
                    {selectedFabric === fabric.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div>
                <Label className="text-gray-400 mb-2 block">Quantity (meters)</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Lace Options */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Add Lace (Optional)</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {LACE_OPTIONS.map(lace => (
                  <button
                    key={lace.id}
                    onClick={() => setSelectedLace(selectedLace === lace.id ? null : lace.id)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      selectedLace === lace.id
                        ? 'bg-purple-500/20 border-purple-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="font-semibold text-sm">{lace.name}</div>
                    <div className="text-xs mt-1">₹{lace.price}/meter</div>
                  </button>
                ))}
              </div>
              {selectedLace && (
                <Input
                  type="number"
                  min="1"
                  placeholder="Lace quantity (meters)"
                  value={laceQuantity}
                  onChange={(e) => setLaceQuantity(Number(e.target.value))}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              )}
            </div>

            {/* Dyeing & Colors */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Droplet size={20} className="text-purple-400" />
                Dyeing & Colors
              </h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-400 mb-2 block">Dyeing Type</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {DYEING_TYPES.map(type => (
                      <button
                        key={type.id}
                        onClick={() => setSelectedDyeing(type.id)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedDyeing === type.id
                            ? 'bg-purple-500/20 border-purple-500 text-white'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <div className="font-semibold text-sm">{type.name}</div>
                        <div className="text-xs mt-1">₹{type.price}/m</div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDyeing !== 'none' && (
                  <>
                    <div>
                      <Label className="text-gray-400 mb-2 block">Primary Color *</Label>
                      <div className="flex gap-2">
                        {COLOR_PALETTE.map(color => (
                          <button
                            key={color.value}
                            onClick={() => setPrimaryColor(color.value)}
                            className={`w-10 h-10 rounded-lg border-2 transition-all ${
                              primaryColor === color.value
                                ? 'border-white shadow-lg scale-110'
                                : 'border-gray-700 hover:border-gray-500'
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>

                    {selectedDyeing === 'gradient' && (
                      <div>
                        <Label className="text-gray-400 mb-2 block">Secondary Color (for Gradient)</Label>
                        <div className="flex gap-2">
                          {COLOR_PALETTE.map(color => (
                            <button
                              key={color.value}
                              onClick={() => setSecondaryColor(secondaryColor === color.value ? null : color.value)}
                              className={`w-10 h-10 rounded-lg border-2 transition-all ${
                                secondaryColor === color.value
                                  ? 'border-white shadow-lg scale-110'
                                  : 'border-gray-700 hover:border-gray-500'
                              }`}
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Workflow Routing */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Workflow Routing</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsTailoring}
                    onChange={(e) => setNeedsTailoring(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-700 bg-gray-800"
                  />
                  <span className="text-gray-300">Needs Tailoring</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsHandcraft}
                    onChange={(e) => setNeedsHandcraft(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-700 bg-gray-800"
                  />
                  <span className="text-gray-300">Needs Handcraft</span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <Label className="text-gray-400 mb-2 block">Additional Notes</Label>
              <Textarea
                placeholder="Any special instructions or notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Right: Summary */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-white mb-4">Order Summary</h3>
              
              <div className="space-y-3 mb-4 pb-4 border-b border-gray-700">
                {selectedFabric && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{FABRICS.find(f => f.id === selectedFabric)?.name} ({quantity}m)</span>
                    <span className="text-white font-semibold">
                      ₹{((FABRICS.find(f => f.id === selectedFabric)?.price || 0) * quantity).toLocaleString()}
                    </span>
                  </div>
                )}
                
                {selectedLace && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{LACE_OPTIONS.find(l => l.id === selectedLace)?.name} ({laceQuantity}m)</span>
                    <span className="text-white font-semibold">
                      ₹{((LACE_OPTIONS.find(l => l.id === selectedLace)?.price || 0) * laceQuantity).toLocaleString()}
                    </span>
                  </div>
                )}
                
                {selectedDyeing !== 'none' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{DYEING_TYPES.find(d => d.id === selectedDyeing)?.name} ({quantity}m)</span>
                    <span className="text-white font-semibold">
                      ₹{((DYEING_TYPES.find(d => d.id === selectedDyeing)?.price || 0) * quantity).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="text-gray-400 font-semibold">Total Amount</span>
                <span className="text-2xl font-bold text-white">₹{calculateTotal().toLocaleString()}</span>
              </div>

              {selectedDyeing !== 'none' && (
                <div className="mb-4">
                  <Label className="text-gray-400 mb-2 block text-xs">Color Preview</Label>
                  <div className="flex gap-2">
                    <div
                      className="w-12 h-12 rounded-lg border-2 border-gray-700"
                      style={{ backgroundColor: primaryColor }}
                    />
                    {secondaryColor && (
                      <div
                        className="w-12 h-12 rounded-lg border-2 border-gray-700"
                        style={{ backgroundColor: secondaryColor }}
                      />
                    )}
                  </div>
                </div>
              )}

              {(needsTailoring || needsHandcraft || selectedDyeing !== 'none') && (
                <div className="mb-4">
                  <Label className="text-gray-400 mb-2 block text-xs">Workflow Steps</Label>
                  <div className="space-y-1">
                    {selectedDyeing !== 'none' && (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                        Dyeing Unit
                      </Badge>
                    )}
                    {needsTailoring && (
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs ml-2">
                        Tailor Unit
                      </Badge>
                    )}
                    {needsHandcraft && (
                      <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 text-xs ml-2">
                        Handcraft Unit
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={!customerName || !customerPhone || !selectedFabric}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
              >
                <Check size={16} className="mr-2" />
                Create Sale Invoice
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
