import React from 'react';
import { Scissors, Settings, Hand as HandIcon, Sparkles, Ruler } from 'lucide-react';
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Badge } from "../../ui/badge";
import { StitchingSelection } from '../CustomizeStudio';

interface StitchingStepProps {
  selection: StitchingSelection;
  onUpdate: (selection: StitchingSelection) => void;
}

const STITCHING_TYPES = [
  {
    id: 'machine',
    name: 'Machine Stitch',
    icon: Settings,
    description: 'Fast, precise, and uniform stitching',
    features: ['Quick turnaround', 'Consistent quality', 'Cost-effective'],
    color: 'blue'
  },
  {
    id: 'hand',
    name: 'Hand Stitch',
    icon: HandIcon,
    description: 'Traditional handcrafted stitching',
    features: ['Premium quality', 'Artisan touch', 'Flexible designs'],
    color: 'purple'
  },
  {
    id: 'decorative',
    name: 'Decorative Stitch',
    icon: Sparkles,
    description: 'Special decorative patterns and embellishments',
    features: ['Unique patterns', 'Premium finish', 'Custom designs'],
    color: 'pink'
  }
];

export const StitchingStep: React.FC<StitchingStepProps> = ({ selection, onUpdate }) => {
  const handleTypeSelect = (type: 'machine' | 'hand' | 'decorative') => {
    onUpdate({ ...selection, type });
  };

  const handleMeasurementUpdate = (field: string, value: string) => {
    onUpdate({
      ...selection,
      measurements: {
        ...selection.measurements,
        [field]: value
      }
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
          <Scissors 
            size={28}
            style={{ color: 'var(--color-wholesale)' }}
          />
          Stitching Options
        </h2>
        <p 
          className="mt-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Choose your preferred stitching method and provide measurements
        </p>
      </div>

      {/* Stitching Type Selection */}
      <div>
        <Label className="text-gray-300 text-lg mb-4 block">Select Stitching Type *</Label>
        <div className="grid grid-cols-3 gap-6">
          {STITCHING_TYPES.map(type => {
            const Icon = type.icon;
            const isSelected = selection.type === type.id;
            
            // Map color names to semantic tokens
            const getColorToken = (colorName: string) => {
              switch (colorName) {
                case 'blue': return 'var(--color-primary)';
                case 'purple': return 'var(--color-wholesale)';
                case 'pink': return 'var(--color-primary)';
                default: return 'var(--color-primary)';
              }
            };
            
            const colorToken = getColorToken(type.color);
            
            return (
              <button
                key={type.id}
                onClick={() => handleTypeSelect(type.id as any)}
                className="relative p-6 rounded-xl border-2 transition-all text-left"
                style={{
                  backgroundColor: isSelected
                    ? (type.color === 'blue' ? 'rgba(59, 130, 246, 0.2)' :
                       type.color === 'purple' ? 'rgba(168, 85, 247, 0.2)' :
                       type.color === 'pink' ? 'rgba(236, 72, 153, 0.2)' :
                       'rgba(59, 130, 246, 0.2)')
                    : 'var(--color-bg-tertiary)',
                  borderColor: isSelected ? colorToken : 'var(--color-border-secondary)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: isSelected
                    ? (type.color === 'blue' ? '0 10px 15px -3px rgba(59, 130, 246, 0.2)' :
                       type.color === 'purple' ? '0 10px 15px -3px rgba(168, 85, 247, 0.2)' :
                       type.color === 'pink' ? '0 10px 15px -3px rgba(236, 72, 153, 0.2)' :
                       '0 10px 15px -3px rgba(59, 130, 246, 0.2)')
                    : 'none'
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
                {/* Icon */}
                <div 
                  className="w-14 h-14 rounded-lg mb-4 flex items-center justify-center"
                  style={{
                    backgroundColor: isSelected
                      ? (type.color === 'blue' ? 'rgba(59, 130, 246, 0.2)' :
                         type.color === 'purple' ? 'rgba(168, 85, 247, 0.2)' :
                         type.color === 'pink' ? 'rgba(236, 72, 153, 0.2)' :
                         'rgba(59, 130, 246, 0.2)')
                      : 'var(--color-bg-card)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <Icon
                    size={28}
                    style={{
                      color: isSelected ? colorToken : 'var(--color-text-tertiary)'
                    }}
                  />
                </div>

                {/* Title */}
                <h3 
                  className="font-bold mb-2"
                  style={{
                    color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-primary)'
                  }}
                >
                  {type.name}
                </h3>

                {/* Description */}
                <p 
                  className="text-sm mb-4"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {type.description}
                </p>

                {/* Features */}
                <div className="space-y-1">
                  {type.features.map((feature, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-2 text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      <div 
                        className="w-1 h-1 rounded-full"
                        style={{
                          backgroundColor: isSelected ? colorToken : 'var(--color-text-tertiary)',
                          borderRadius: 'var(--radius-full)'
                        }}
                      />
                      {feature}
                    </div>
                  ))}
                </div>

                {/* Selected Badge */}
                {isSelected && (
                  <div className="absolute top-4 right-4">
                    <Badge 
                      style={{
                        backgroundColor: type.color === 'blue' ? 'rgba(59, 130, 246, 0.2)' :
                                       type.color === 'purple' ? 'rgba(168, 85, 247, 0.2)' :
                                       type.color === 'pink' ? 'rgba(236, 72, 153, 0.2)' :
                                       'rgba(59, 130, 246, 0.2)',
                        color: colorToken,
                        borderColor: type.color === 'blue' ? 'rgba(59, 130, 246, 0.3)' :
                                   type.color === 'purple' ? 'rgba(168, 85, 247, 0.3)' :
                                   type.color === 'pink' ? 'rgba(236, 72, 153, 0.3)' :
                                   'rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      Selected
                    </Badge>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Measurements Section */}
      {selection.type && (
        <div 
          className="border-t pt-6"
          style={{ borderTopColor: 'var(--color-border-primary)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Ruler 
              size={20}
              style={{ color: 'var(--color-wholesale)' }}
            />
            <Label 
              className="text-lg"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Measurements (Optional)
            </Label>
          </div>
          
          <div 
            className="rounded-lg p-6 border"
            style={{
              backgroundColor: 'rgba(31, 41, 55, 0.5)',
              borderColor: 'var(--color-border-secondary)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <Label 
                  className="mb-2 block text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Chest (inches)
                </Label>
                <Input
                  type="number"
                  placeholder="e.g., 36"
                  value={selection.measurements?.chest || ''}
                  onChange={(e) => handleMeasurementUpdate('chest', e.target.value)}
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
              <div>
                <Label 
                  className="mb-2 block text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Waist (inches)
                </Label>
                <Input
                  type="number"
                  placeholder="e.g., 30"
                  value={selection.measurements?.waist || ''}
                  onChange={(e) => handleMeasurementUpdate('waist', e.target.value)}
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
              <div>
                <Label 
                  className="mb-2 block text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Length (inches)
                </Label>
                <Input
                  type="number"
                  placeholder="e.g., 42"
                  value={selection.measurements?.length || ''}
                  onChange={(e) => handleMeasurementUpdate('length', e.target.value)}
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
              <div>
                <Label 
                  className="mb-2 block text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Sleeve (inches)
                </Label>
                <Input
                  type="number"
                  placeholder="e.g., 20"
                  value={selection.measurements?.sleeve || ''}
                  onChange={(e) => handleMeasurementUpdate('sleeve', e.target.value)}
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
            </div>

            <div 
              className="border rounded-lg p-3"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderColor: 'rgba(59, 130, 246, 0.2)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <p 
                className="text-sm"
                style={{ color: 'var(--color-primary)' }}
              >
                💡 <strong>Tip:</strong> Accurate measurements ensure perfect fitting. Leave blank if using standard sizes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Additional Details */}
      {selection.type && (
        <div 
          className="border-t pt-6"
          style={{ borderTopColor: 'var(--color-border-primary)' }}
        >
          <Label 
            className="text-lg mb-4 block"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Additional Stitching Details (Optional)
          </Label>
          <Textarea
            placeholder="Add any special stitching instructions, preferences, or notes..."
            value={selection.details}
            onChange={(e) => onUpdate({ ...selection, details: e.target.value })}
            className="resize-none"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderColor: 'var(--color-border-secondary)',
              color: 'var(--color-text-primary)'
            }}
            rows={4}
          />
        </div>
      )}

      {/* Visual Representation */}
      {selection.type && (
        <div 
          className="border-t pt-6"
          style={{ borderTopColor: 'var(--color-border-primary)' }}
        >
          <Label 
            className="text-lg mb-4 block"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Stitching Preview
          </Label>
          <div 
            className="rounded-xl p-8 border"
            style={{
              background: 'linear-gradient(to bottom right, var(--color-bg-tertiary), var(--color-bg-card))',
              borderColor: 'var(--color-border-secondary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="grid grid-cols-3 gap-8">
              {/* Visual representation based on selected type */}
              {selection.type === 'machine' && (
                <>
                  <div className="text-center">
                    <div 
                      className="w-24 h-24 mx-auto mb-3 rounded-lg border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderColor: 'rgba(59, 130, 246, 0.3)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <Settings size={40} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Precision
                    </div>
                  </div>
                  <div className="text-center">
                    <div 
                      className="w-24 h-24 mx-auto mb-3 rounded-lg border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderColor: 'rgba(59, 130, 246, 0.3)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <Scissors size={40} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Speed
                    </div>
                  </div>
                  <div className="text-center">
                    <div 
                      className="w-24 h-24 mx-auto mb-3 rounded-lg border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderColor: 'rgba(59, 130, 246, 0.3)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <Sparkles size={40} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Quality
                    </div>
                  </div>
                </>
              )}

              {selection.type === 'hand' && (
                <>
                  <div className="text-center">
                    <div 
                      className="w-24 h-24 mx-auto mb-3 rounded-lg border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        borderColor: 'rgba(168, 85, 247, 0.3)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <HandIcon size={40} style={{ color: 'var(--color-wholesale)' }} />
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Craftsmanship
                    </div>
                  </div>
                  <div className="text-center">
                    <div 
                      className="w-24 h-24 mx-auto mb-3 rounded-lg border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        borderColor: 'rgba(168, 85, 247, 0.3)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <Sparkles size={40} style={{ color: 'var(--color-wholesale)' }} />
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Premium
                    </div>
                  </div>
                  <div className="text-center">
                    <div 
                      className="w-24 h-24 mx-auto mb-3 rounded-lg border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        borderColor: 'rgba(168, 85, 247, 0.3)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <Settings size={40} style={{ color: 'var(--color-wholesale)' }} />
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Detailed
                    </div>
                  </div>
                </>
              )}

              {selection.type === 'decorative' && (
                <>
                  <div className="text-center">
                    <div 
                      className="w-24 h-24 mx-auto mb-3 rounded-lg border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(236, 72, 153, 0.1)',
                        borderColor: 'rgba(236, 72, 153, 0.3)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <Sparkles size={40} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Decorative
                    </div>
                  </div>
                  <div className="text-center">
                    <div 
                      className="w-24 h-24 mx-auto mb-3 rounded-lg border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(236, 72, 153, 0.1)',
                        borderColor: 'rgba(236, 72, 153, 0.3)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <Scissors size={40} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Artistic
                    </div>
                  </div>
                  <div className="text-center">
                    <div 
                      className="w-24 h-24 mx-auto mb-3 rounded-lg border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(236, 72, 153, 0.1)',
                        borderColor: 'rgba(236, 72, 153, 0.3)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <Settings size={40} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Custom
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
