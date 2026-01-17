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
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 
              className="text-2xl font-bold flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <ShoppingCart 
                size={28}
                style={{ color: 'var(--color-wholesale)' }}
              />
              Simple Sale & Fabric Creation
            </h2>
            <p 
              className="mt-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Create sale invoice with fabric customization
            </p>
          </div>
          <Button
            variant="outline"
            onClick={onCancel}
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
          >
            <X size={16} className="mr-2" />
            Cancel
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="col-span-2 space-y-6">
            {/* Customer Info */}
            <div 
              className="border rounded-xl p-6"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <h3 
                className="text-lg font-semibold mb-4 flex items-center gap-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <User 
                  size={20}
                  style={{ color: 'var(--color-wholesale)' }}
                />
                Customer Information
              </h3>
              <div className="space-y-4">
                <div>
                  <Label 
                    className="mb-2 block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Customer Name *
                  </Label>
                  <Input
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                </div>
                <div>
                  <Label 
                    className="mb-2 block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Phone Number *
                  </Label>
                  <Input
                    placeholder="+92 300 1234567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Fabric Selection */}
            <div 
              className="border rounded-xl p-6"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <h3 
                className="text-lg font-semibold mb-4 flex items-center gap-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <Palette 
                  size={20}
                  style={{ color: 'var(--color-wholesale)' }}
                />
                Select Fabric *
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {FABRICS.map(fabric => (
                  <button
                    key={fabric.id}
                    onClick={() => setSelectedFabric(fabric.id)}
                    className="relative rounded-lg overflow-hidden border-2 transition-all"
                    style={{
                      borderColor: selectedFabric === fabric.id
                        ? 'var(--color-wholesale)'
                        : 'var(--color-border-secondary)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: selectedFabric === fabric.id
                        ? '0 10px 15px -3px rgba(168, 85, 247, 0.2)'
                        : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedFabric !== fabric.id) {
                        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedFabric !== fabric.id) {
                        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                      }
                    }}
                  >
                    <img src={fabric.image} alt={fabric.name} className="w-full h-24 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <div 
                        className="text-xs font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {fabric.name}
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: 'var(--color-wholesale)' }}
                      >
                        ₹{fabric.price}/m
                      </div>
                    </div>
                    {selectedFabric === fabric.id && (
                      <div 
                        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: 'var(--color-wholesale)',
                          borderRadius: 'var(--radius-full)'
                        }}
                      >
                        <Check size={14} style={{ color: 'var(--color-text-primary)' }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div>
                <Label 
                  className="mb-2 block"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Quantity (meters)
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
            </div>

            {/* Lace Options */}
            <div 
              className="border rounded-xl p-6"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <h3 
                className="text-lg font-semibold mb-4"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Add Lace (Optional)
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {LACE_OPTIONS.map(lace => (
                  <button
                    key={lace.id}
                    onClick={() => setSelectedLace(selectedLace === lace.id ? null : lace.id)}
                    className="p-3 rounded-lg border-2 transition-all text-left"
                    style={{
                      backgroundColor: selectedLace === lace.id
                        ? 'rgba(168, 85, 247, 0.2)'
                        : 'var(--color-bg-tertiary)',
                      borderColor: selectedLace === lace.id
                        ? 'var(--color-wholesale)'
                        : 'var(--color-border-secondary)',
                      color: selectedLace === lace.id
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-tertiary)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedLace !== lace.id) {
                        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedLace !== lace.id) {
                        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                      }
                    }}
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
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              )}
            </div>

            {/* Dyeing & Colors */}
            <div 
              className="border rounded-xl p-6"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <h3 
                className="text-lg font-semibold mb-4 flex items-center gap-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <Droplet 
                  size={20}
                  style={{ color: 'var(--color-wholesale)' }}
                />
                Dyeing & Colors
              </h3>
              <div className="space-y-4">
                <div>
                  <Label 
                    className="mb-2 block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Dyeing Type
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    {DYEING_TYPES.map(type => (
                      <button
                        key={type.id}
                        onClick={() => setSelectedDyeing(type.id)}
                        className="p-3 rounded-lg border-2 transition-all"
                        style={{
                          backgroundColor: selectedDyeing === type.id
                            ? 'rgba(168, 85, 247, 0.2)'
                            : 'var(--color-bg-tertiary)',
                          borderColor: selectedDyeing === type.id
                            ? 'var(--color-wholesale)'
                            : 'var(--color-border-secondary)',
                          color: selectedDyeing === type.id
                            ? 'var(--color-text-primary)'
                            : 'var(--color-text-tertiary)',
                          borderRadius: 'var(--radius-lg)'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedDyeing !== type.id) {
                            e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedDyeing !== type.id) {
                            e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                          }
                        }}
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
                      <Label 
                        className="mb-2 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Primary Color *
                      </Label>
                      <div className="flex gap-2">
                        {COLOR_PALETTE.map(color => (
                          <button
                            key={color.value}
                            onClick={() => setPrimaryColor(color.value)}
                            className="w-10 h-10 rounded-lg border-2 transition-all"
                            style={{
                              backgroundColor: color.value,
                              borderColor: primaryColor === color.value
                                ? 'var(--color-text-primary)'
                                : 'var(--color-border-secondary)',
                              borderRadius: 'var(--radius-lg)',
                              boxShadow: primaryColor === color.value
                                ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                                : 'none',
                              transform: primaryColor === color.value ? 'scale(1.1)' : 'scale(1)'
                            }}
                            onMouseEnter={(e) => {
                              if (primaryColor !== color.value) {
                                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (primaryColor !== color.value) {
                                e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                              }
                            }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>

                    {selectedDyeing === 'gradient' && (
                      <div>
                        <Label 
                          className="mb-2 block"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Secondary Color (for Gradient)
                        </Label>
                        <div className="flex gap-2">
                          {COLOR_PALETTE.map(color => (
                            <button
                              key={color.value}
                              onClick={() => setSecondaryColor(secondaryColor === color.value ? null : color.value)}
                              className="w-10 h-10 rounded-lg border-2 transition-all"
                              style={{
                                backgroundColor: color.value,
                                borderColor: secondaryColor === color.value
                                  ? 'var(--color-text-primary)'
                                  : 'var(--color-border-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                boxShadow: secondaryColor === color.value
                                  ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                                  : 'none',
                                transform: secondaryColor === color.value ? 'scale(1.1)' : 'scale(1)'
                              }}
                              onMouseEnter={(e) => {
                                if (secondaryColor !== color.value) {
                                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (secondaryColor !== color.value) {
                                  e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                                }
                              }}
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
            <div 
              className="border rounded-xl p-6"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <h3 
                className="text-lg font-semibold mb-4"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Workflow Routing
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsTailoring}
                    onChange={(e) => setNeedsTailoring(e.target.checked)}
                    className="w-5 h-5 rounded"
                    style={{
                      borderColor: 'var(--color-border-secondary)',
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  />
                  <span style={{ color: 'var(--color-text-primary)' }}>Needs Tailoring</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsHandcraft}
                    onChange={(e) => setNeedsHandcraft(e.target.checked)}
                    className="w-5 h-5 rounded"
                    style={{
                      borderColor: 'var(--color-border-secondary)',
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  />
                  <span style={{ color: 'var(--color-text-primary)' }}>Needs Handcraft</span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div 
              className="border rounded-xl p-6"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <Label 
                className="mb-2 block"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Additional Notes
              </Label>
              <Textarea
                placeholder="Any special instructions or notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
                rows={3}
              />
            </div>
          </div>

          {/* Right: Summary */}
          <div className="space-y-4">
            <div 
              className="border rounded-xl p-6 sticky top-6"
              style={{
                background: 'linear-gradient(to bottom right, rgba(168, 85, 247, 0.3), rgba(59, 130, 246, 0.3))',
                borderColor: 'rgba(168, 85, 247, 0.3)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <h3 
                className="text-lg font-semibold mb-4"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Order Summary
              </h3>
              
              <div 
                className="space-y-3 mb-4 pb-4 border-b"
                style={{ borderBottomColor: 'var(--color-border-secondary)' }}
              >
                {selectedFabric && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {FABRICS.find(f => f.id === selectedFabric)?.name} ({quantity}m)
                    </span>
                    <span 
                      className="font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      ₹{((FABRICS.find(f => f.id === selectedFabric)?.price || 0) * quantity).toLocaleString()}
                    </span>
                  </div>
                )}
                
                {selectedLace && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {LACE_OPTIONS.find(l => l.id === selectedLace)?.name} ({laceQuantity}m)
                    </span>
                    <span 
                      className="font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      ₹{((LACE_OPTIONS.find(l => l.id === selectedLace)?.price || 0) * laceQuantity).toLocaleString()}
                    </span>
                  </div>
                )}
                
                {selectedDyeing !== 'none' && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {DYEING_TYPES.find(d => d.id === selectedDyeing)?.name} ({quantity}m)
                    </span>
                    <span 
                      className="font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      ₹{((DYEING_TYPES.find(d => d.id === selectedDyeing)?.price || 0) * quantity).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mb-6">
                <span 
                  className="font-semibold"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Total Amount
                </span>
                <span 
                  className="text-2xl font-bold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  ₹{calculateTotal().toLocaleString()}
                </span>
              </div>

              {selectedDyeing !== 'none' && (
                <div className="mb-4">
                  <Label 
                    className="mb-2 block text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Color Preview
                  </Label>
                  <div className="flex gap-2">
                    <div
                      className="w-12 h-12 rounded-lg border-2"
                      style={{
                        backgroundColor: primaryColor,
                        borderColor: 'var(--color-border-secondary)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    />
                    {secondaryColor && (
                      <div
                        className="w-12 h-12 rounded-lg border-2"
                        style={{
                          backgroundColor: secondaryColor,
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)'
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {(needsTailoring || needsHandcraft || selectedDyeing !== 'none') && (
                <div className="mb-4">
                  <Label 
                    className="mb-2 block text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Workflow Steps
                  </Label>
                  <div className="space-y-1">
                    {selectedDyeing !== 'none' && (
                      <Badge 
                        className="text-xs"
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          color: 'var(--color-primary)',
                          borderColor: 'rgba(59, 130, 246, 0.3)'
                        }}
                      >
                        Dyeing Unit
                      </Badge>
                    )}
                    {needsTailoring && (
                      <Badge 
                        className="text-xs ml-2"
                        style={{
                          backgroundColor: 'rgba(168, 85, 247, 0.2)',
                          color: 'var(--color-wholesale)',
                          borderColor: 'rgba(168, 85, 247, 0.3)'
                        }}
                      >
                        Tailor Unit
                      </Badge>
                    )}
                    {needsHandcraft && (
                      <Badge 
                        className="text-xs ml-2"
                        style={{
                          backgroundColor: 'rgba(236, 72, 153, 0.2)',
                          color: 'var(--color-primary)',
                          borderColor: 'rgba(236, 72, 153, 0.3)'
                        }}
                      >
                        Handcraft Unit
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={!customerName || !customerPhone || !selectedFabric}
                className="w-full"
                style={{
                  backgroundColor: 'var(--color-wholesale)',
                  color: 'var(--color-text-primary)',
                  opacity: (!customerName || !customerPhone || !selectedFabric) ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!(!customerName || !customerPhone || !selectedFabric)) {
                    e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.9)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(!customerName || !customerPhone || !selectedFabric)) {
                    e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
                  }
                }}
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
