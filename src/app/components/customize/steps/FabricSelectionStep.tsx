import React, { useState } from 'react';
import { Palette, Droplet, Layers, Package, Sparkles, Check } from 'lucide-react';
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Badge } from "../../ui/badge";
import { FabricSelection } from '../CustomizeStudio';

interface FabricSelectionStepProps {
  selection: FabricSelection;
  onUpdate: (selection: FabricSelection) => void;
}

const FABRICS = [
  { id: 'silk', name: 'Pure Silk', image: 'https://images.unsplash.com/photo-1564584217132-2271feaeb3c5?w=300&h=300&fit=crop', price: 2500 },
  { id: 'velvet', name: 'Red Velvet', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300&h=300&fit=crop', price: 3000 },
  { id: 'cotton', name: 'Premium Cotton', image: 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=300&h=300&fit=crop', price: 1500 },
  { id: 'chiffon', name: 'Chiffon', image: 'https://images.unsplash.com/photo-1583391733981-5afd6f2e9b82?w=300&h=300&fit=crop', price: 2000 },
  { id: 'georgette', name: 'Georgette', image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=300&h=300&fit=crop', price: 2200 },
  { id: 'banarasi', name: 'Banarasi Silk', image: 'https://images.unsplash.com/photo-1622122201714-77da0ca8e5d2?w=300&h=300&fit=crop', price: 4500 }
];

const LACE_STYLES = [
  { id: 'floral', name: 'Floral', icon: '🌸' },
  { id: 'geometric', name: 'Geometric', icon: '⬛' },
  { id: 'vintage', name: 'Vintage', icon: '🎀' },
  { id: 'modern', name: 'Modern', icon: '✨' }
];

const LACE_WIDTHS = [
  { id: '1inch', name: '1 inch', value: '1"' },
  { id: '2inch', name: '2 inches', value: '2"' },
  { id: '3inch', name: '3 inches', value: '3"' },
  { id: '4inch', name: '4 inches', value: '4"' }
];

const DYEING_TYPES = [
  { id: 'solid', name: 'Solid Color', icon: '🎨' },
  { id: 'gradient', name: 'Gradient', icon: '🌈' },
  { id: 'none', name: 'No Dyeing', icon: '⚪' }
];

const COLOR_PALETTES = [
  { name: 'Red', value: '#DC2626' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Purple', value: '#9333EA' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Yellow', value: '#FBBF24' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Gold', value: '#FFD700' },
  { name: 'Silver', value: '#C0C0C0' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
  { name: 'Maroon', value: '#800000' }
];

const CLOTH_TYPES = [
  { id: 'basic', name: 'Basic Plain' },
  { id: 'textured', name: 'Textured' },
  { id: 'embossed', name: 'Embossed' },
  { id: 'printed', name: 'Printed' }
];

const READY_MADE_TYPES = [
  { id: 'pre-stitched', name: 'Pre-Stitched' },
  { id: 'semi-stitched', name: 'Semi-Stitched' },
  { id: 'unstitched', name: 'Unstitched' }
];

const DOUBLE_CLOTH_TYPES = [
  { id: 'layered', name: 'Layered' },
  { id: 'reinforced', name: 'Reinforced' }
];

export const FabricSelectionStep: React.FC<FabricSelectionStepProps> = ({ selection, onUpdate }) => {
  const [showLaceOptions, setShowLaceOptions] = useState(false);

  const handleFabricSelect = (fabricId: string) => {
    onUpdate({ ...selection, baseFabric: fabricId });
  };

  const handleLaceToggle = () => {
    if (showLaceOptions) {
      onUpdate({ ...selection, lace: null });
      setShowLaceOptions(false);
    } else {
      setShowLaceOptions(true);
      onUpdate({
        ...selection,
        lace: { style: 'floral', width: '2inch', pattern: 'standard' }
      });
    }
  };

  const handleLaceUpdate = (field: string, value: string) => {
    if (selection.lace) {
      onUpdate({
        ...selection,
        lace: { ...selection.lace, [field]: value }
      });
    }
  };

  const handleDyeingSelect = (type: 'solid' | 'gradient' | 'none') => {
    if (type === 'none') {
      onUpdate({ ...selection, dyeing: null });
    } else {
      onUpdate({
        ...selection,
        dyeing: {
          type,
          primary: selection.colors.primary,
          secondary: type === 'gradient' ? selection.colors.secondary : undefined
        }
      });
    }
  };

  const handleColorUpdate = (field: 'primary' | 'secondary' | 'accent', value: string) => {
    onUpdate({
      ...selection,
      colors: { ...selection.colors, [field]: value }
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 
          className="text-2xl font-bold flex items-center gap-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <Palette 
            size={28}
            style={{ color: 'var(--color-wholesale)' }}
          />
          Fabric Selection - All Options
        </h2>
        <p 
          className="mt-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Choose your base fabric and customize with lace, dyeing, and colors
        </p>
      </div>

      {/* Base Fabric Selection */}
      <div>
        <Label 
          className="text-lg mb-4 block"
          style={{ color: 'var(--color-text-primary)' }}
        >
          1. Select Base Fabric *
        </Label>
        <div className="grid grid-cols-3 gap-4">
          {FABRICS.map(fabric => (
            <button
              key={fabric.id}
              onClick={() => handleFabricSelect(fabric.id)}
              className="relative group rounded-xl overflow-hidden border-2 transition-all"
              style={{
                borderColor: selection.baseFabric === fabric.id
                  ? 'var(--color-wholesale)'
                  : 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: selection.baseFabric === fabric.id
                  ? '0 10px 15px -3px rgba(168, 85, 247, 0.2)'
                  : 'none'
              }}
              onMouseEnter={(e) => {
                if (selection.baseFabric !== fabric.id) {
                  e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (selection.baseFabric !== fabric.id) {
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                }
              }}
            >
              <img
                src={fabric.image}
                alt={fabric.name}
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 
                  className="font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {fabric.name}
                </h3>
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-wholesale)' }}
                >
                  ₹{fabric.price}/meter
                </p>
              </div>
              {selection.baseFabric === fabric.id && (
                <div 
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--color-wholesale)',
                    borderRadius: 'var(--radius-full)'
                  }}
                >
                  <Check size={18} style={{ color: 'var(--color-text-primary)' }} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lace Options */}
      <div 
        className="border-t pt-6"
        style={{ borderTopColor: 'var(--color-border-primary)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <Label 
            className="text-lg"
            style={{ color: 'var(--color-text-primary)' }}
          >
            2. Add Lace (Optional)
          </Label>
          <button
            onClick={handleLaceToggle}
            className="px-4 py-2 rounded-lg border-2 transition-all"
            style={{
              backgroundColor: showLaceOptions
                ? 'rgba(168, 85, 247, 0.2)'
                : 'var(--color-bg-card)',
              borderColor: showLaceOptions
                ? 'var(--color-wholesale)'
                : 'var(--color-border-primary)',
              color: showLaceOptions
                ? 'var(--color-wholesale)'
                : 'var(--color-text-tertiary)',
              borderRadius: 'var(--radius-lg)'
            }}
            onMouseEnter={(e) => {
              if (!showLaceOptions) {
                e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showLaceOptions) {
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              }
            }}
          >
            {showLaceOptions ? '✓ Lace Added' : '+ Add Lace'}
          </button>
        </div>

        {showLaceOptions && (
          <div 
            className="space-y-4 rounded-lg p-6 border"
            style={{
              backgroundColor: 'rgba(31, 41, 55, 0.3)',
              borderColor: 'var(--color-border-secondary)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div>
              <Label 
                className="mb-2 block"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Lace Style
              </Label>
              <div className="grid grid-cols-4 gap-3">
                {LACE_STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => handleLaceUpdate('style', style.id)}
                    className="p-4 rounded-lg border-2 transition-all text-center"
                    style={{
                      backgroundColor: selection.lace?.style === style.id
                        ? 'rgba(168, 85, 247, 0.2)'
                        : 'var(--color-bg-card)',
                      borderColor: selection.lace?.style === style.id
                        ? 'var(--color-wholesale)'
                        : 'var(--color-border-secondary)',
                      color: selection.lace?.style === style.id
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-tertiary)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                    onMouseEnter={(e) => {
                      if (selection.lace?.style !== style.id) {
                        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selection.lace?.style !== style.id) {
                        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                      }
                    }}
                  >
                    <div className="text-2xl mb-2">{style.icon}</div>
                    <div className="text-sm">{style.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label 
                className="mb-2 block"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Lace Width
              </Label>
              <div className="grid grid-cols-4 gap-3">
                {LACE_WIDTHS.map(width => (
                  <button
                    key={width.id}
                    onClick={() => handleLaceUpdate('width', width.id)}
                    className="p-3 rounded-lg border-2 transition-all"
                    style={{
                      backgroundColor: selection.lace?.width === width.id
                        ? 'rgba(168, 85, 247, 0.2)'
                        : 'var(--color-bg-card)',
                      borderColor: selection.lace?.width === width.id
                        ? 'var(--color-wholesale)'
                        : 'var(--color-border-secondary)',
                      color: selection.lace?.width === width.id
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-tertiary)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                    onMouseEnter={(e) => {
                      if (selection.lace?.width !== width.id) {
                        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selection.lace?.width !== width.id) {
                        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                      }
                    }}
                  >
                    {width.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dyeing Options */}
      <div 
        className="border-t pt-6"
        style={{ borderTopColor: 'var(--color-border-primary)' }}
      >
        <Label 
          className="text-lg mb-4 block"
          style={{ color: 'var(--color-text-primary)' }}
        >
          3. Dyeing Preference
        </Label>
        <div className="grid grid-cols-3 gap-4">
          {DYEING_TYPES.map(type => {
            const isSelected = selection.dyeing?.type === type.id || (type.id === 'none' && !selection.dyeing);
            return (
              <button
                key={type.id}
                onClick={() => handleDyeingSelect(type.id as any)}
                className="p-6 rounded-lg border-2 transition-all text-center"
                style={{
                  backgroundColor: isSelected
                    ? 'rgba(168, 85, 247, 0.2)'
                    : 'var(--color-bg-card)',
                  borderColor: isSelected
                    ? 'var(--color-wholesale)'
                    : 'var(--color-border-secondary)',
                  color: isSelected
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-tertiary)',
                  borderRadius: 'var(--radius-lg)'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                  }
                }}
              >
                <div className="text-4xl mb-2">{type.icon}</div>
                <div className="font-semibold">{type.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Palette */}
      <div 
        className="border-t pt-6"
        style={{ borderTopColor: 'var(--color-border-primary)' }}
      >
        <Label 
          className="text-lg mb-4 block"
          style={{ color: 'var(--color-text-primary)' }}
        >
          4. Color Selection
        </Label>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <Label 
              className="mb-2 block"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Primary Color *
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PALETTES.map(color => (
                <button
                  key={`primary-${color.value}`}
                  onClick={() => handleColorUpdate('primary', color.value)}
                  className="w-12 h-12 rounded-lg border-2 transition-all"
                  style={{
                    backgroundColor: color.value,
                    borderColor: selection.colors.primary === color.value
                      ? 'var(--color-text-primary)'
                      : 'var(--color-border-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: selection.colors.primary === color.value
                      ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                      : 'none',
                    transform: selection.colors.primary === color.value ? 'scale(1.1)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (selection.colors.primary !== color.value) {
                      e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selection.colors.primary !== color.value) {
                      e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                    }
                  }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div>
            <Label 
              className="mb-2 block"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Secondary Color
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PALETTES.map(color => (
                <button
                  key={`secondary-${color.value}`}
                  onClick={() => handleColorUpdate('secondary', color.value)}
                  className="w-12 h-12 rounded-lg border-2 transition-all"
                  style={{
                    backgroundColor: color.value,
                    borderColor: selection.colors.secondary === color.value
                      ? 'var(--color-text-primary)'
                      : 'var(--color-border-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: selection.colors.secondary === color.value
                      ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                      : 'none',
                    transform: selection.colors.secondary === color.value ? 'scale(1.1)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (selection.colors.secondary !== color.value) {
                      e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selection.colors.secondary !== color.value) {
                      e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                    }
                  }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div>
            <Label 
              className="mb-2 block"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Accent Color
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PALETTES.map(color => (
                <button
                  key={`accent-${color.value}`}
                  onClick={() => handleColorUpdate('accent', color.value)}
                  className="w-12 h-12 rounded-lg border-2 transition-all"
                  style={{
                    backgroundColor: color.value,
                    borderColor: selection.colors.accent === color.value
                      ? 'var(--color-text-primary)'
                      : 'var(--color-border-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: selection.colors.accent === color.value
                      ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                      : 'none',
                    transform: selection.colors.accent === color.value ? 'scale(1.1)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (selection.colors.accent !== color.value) {
                      e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selection.colors.accent !== color.value) {
                      e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                    }
                  }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cloth Type */}
      <div 
        className="border-t pt-6"
        style={{ borderTopColor: 'var(--color-border-primary)' }}
      >
        <Label 
          className="text-lg mb-4 block"
          style={{ color: 'var(--color-text-primary)' }}
        >
          5. Cloth Type
        </Label>
        <div className="grid grid-cols-4 gap-3">
          {CLOTH_TYPES.map(type => (
            <button
              key={type.id}
              onClick={() => onUpdate({ ...selection, clothType: type.id })}
              className="p-4 rounded-lg border-2 transition-all"
              style={{
                backgroundColor: selection.clothType === type.id
                  ? 'rgba(168, 85, 247, 0.2)'
                  : 'var(--color-bg-card)',
                borderColor: selection.clothType === type.id
                  ? 'var(--color-wholesale)'
                  : 'var(--color-border-secondary)',
                color: selection.clothType === type.id
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-tertiary)',
                borderRadius: 'var(--radius-lg)'
              }}
              onMouseEnter={(e) => {
                if (selection.clothType !== type.id) {
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (selection.clothType !== type.id) {
                  e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                }
              }}
            >
              {type.name}
            </button>
          ))}
        </div>
      </div>

      {/* Ready-made & Double Cloth Options */}
      <div 
        className="border-t pt-6"
        style={{ borderTopColor: 'var(--color-border-primary)' }}
      >
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label 
                className="text-lg"
                style={{ color: 'var(--color-text-primary)' }}
              >
                6. Ready-made Option
              </Label>
              <button
                onClick={() => onUpdate({ ...selection, isReadyMade: !selection.isReadyMade })}
                className="px-4 py-2 rounded-lg border-2 transition-all"
                style={{
                  backgroundColor: selection.isReadyMade
                    ? 'rgba(168, 85, 247, 0.2)'
                    : 'var(--color-bg-card)',
                  borderColor: selection.isReadyMade
                    ? 'var(--color-wholesale)'
                    : 'var(--color-border-primary)',
                  color: selection.isReadyMade
                    ? 'var(--color-wholesale)'
                    : 'var(--color-text-tertiary)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                {selection.isReadyMade ? '✓ Enabled' : 'Disabled'}
              </button>
            </div>
            {selection.isReadyMade && (
              <div className="space-y-2">
                {READY_MADE_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => onUpdate({ ...selection, readyMadeType: type.id })}
                    className="w-full p-3 rounded-lg border-2 transition-all"
                    style={{
                      backgroundColor: selection.readyMadeType === type.id
                        ? 'rgba(168, 85, 247, 0.2)'
                        : 'var(--color-bg-card)',
                      borderColor: selection.readyMadeType === type.id
                        ? 'var(--color-wholesale)'
                        : 'var(--color-border-secondary)',
                      color: selection.readyMadeType === type.id
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-tertiary)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                    onMouseEnter={(e) => {
                      if (selection.readyMadeType !== type.id) {
                        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selection.readyMadeType !== type.id) {
                        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                      }
                    }}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <Label 
                className="text-lg"
                style={{ color: 'var(--color-text-primary)' }}
              >
                7. Double Cloth
              </Label>
              <button
                onClick={() => onUpdate({ ...selection, isDoubleCloth: !selection.isDoubleCloth })}
                className="px-4 py-2 rounded-lg border-2 transition-all"
                style={{
                  backgroundColor: selection.isDoubleCloth
                    ? 'rgba(168, 85, 247, 0.2)'
                    : 'var(--color-bg-card)',
                  borderColor: selection.isDoubleCloth
                    ? 'var(--color-wholesale)'
                    : 'var(--color-border-primary)',
                  color: selection.isDoubleCloth
                    ? 'var(--color-wholesale)'
                    : 'var(--color-text-tertiary)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                {selection.isDoubleCloth ? '✓ Enabled' : 'Disabled'}
              </button>
            </div>
            {selection.isDoubleCloth && (
              <div className="space-y-2">
                {DOUBLE_CLOTH_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => onUpdate({ ...selection, doubleClothType: type.id })}
                    className="w-full p-3 rounded-lg border-2 transition-all"
                    style={{
                      backgroundColor: selection.doubleClothType === type.id
                        ? 'rgba(168, 85, 247, 0.2)'
                        : 'var(--color-bg-card)',
                      borderColor: selection.doubleClothType === type.id
                        ? 'var(--color-wholesale)'
                        : 'var(--color-border-secondary)',
                      color: selection.doubleClothType === type.id
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-tertiary)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                    onMouseEnter={(e) => {
                      if (selection.doubleClothType !== type.id) {
                        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selection.doubleClothType !== type.id) {
                        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                      }
                    }}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Badge */}
      {selection.baseFabric && (
        <div 
          className="border rounded-lg p-4"
          style={{
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            borderColor: 'rgba(168, 85, 247, 0.2)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <div 
            className="flex items-center gap-2 mb-2"
            style={{ color: 'var(--color-wholesale)' }}
          >
            <Sparkles size={18} />
            <span className="font-semibold">Selection Summary</span>
          </div>
          <div 
            className="text-sm space-y-1"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <div>✓ Base Fabric: {FABRICS.find(f => f.id === selection.baseFabric)?.name}</div>
            {selection.lace && <div>✓ Lace: {LACE_STYLES.find(l => l.id === selection.lace?.style)?.name}</div>}
            {selection.dyeing && <div>✓ Dyeing: {selection.dyeing.type}</div>}
            <div>✓ Colors Selected: Primary{selection.colors.secondary ? ', Secondary' : ''}{selection.colors.accent ? ', Accent' : ''}</div>
            {selection.isReadyMade && <div>✓ Ready-made: {selection.readyMadeType}</div>}
            {selection.isDoubleCloth && <div>✓ Double Cloth: {selection.doubleClothType}</div>}
          </div>
        </div>
      )}
    </div>
  );
};
