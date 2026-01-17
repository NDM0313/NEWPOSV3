import React from 'react';
import { Hand, Sparkles, Star, Zap, Heart, Smile } from 'lucide-react';
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Badge } from "../../ui/badge";
import { HandworkSelection } from '../CustomizeStudio';

interface HandworkStepProps {
  selection: HandworkSelection;
  onUpdate: (selection: HandworkSelection) => void;
}

const HANDWORK_TYPES = [
  { id: 'embroidery', name: 'Embroidery', emoji: '🧵', color: 'purple' },
  { id: 'beadwork', name: 'Beadwork', emoji: '💎', color: 'blue' },
  { id: 'sequins', name: 'Sequins', emoji: '✨', color: 'pink' },
  { id: 'zari', name: 'Zari Work', emoji: '🌟', color: 'yellow' },
  { id: 'stonework', name: 'Stone Work', emoji: '💠', color: 'cyan' },
  { id: 'mirror', name: 'Mirror Work', emoji: '🪞', color: 'indigo' }
];

const INTENSITY_LEVELS = [
  { id: 'light', name: 'Light', description: 'Minimal handwork', icon: '🌙' },
  { id: 'medium', name: 'Medium', description: 'Moderate details', icon: '⭐' },
  { id: 'heavy', name: 'Heavy', description: 'Extensive work', icon: '🌟' }
];

export const HandworkStep: React.FC<HandworkStepProps> = ({ selection, onUpdate }) => {
  const toggleHandworkType = (typeId: string) => {
    const isSelected = selection.types.includes(typeId);
    const newTypes = isSelected
      ? selection.types.filter(t => t !== typeId)
      : [...selection.types, typeId];
    
    onUpdate({
      ...selection,
      types: newTypes,
      hasHandwork: newTypes.length > 0
    });
  };

  const setIntensity = (intensity: 'light' | 'medium' | 'heavy') => {
    onUpdate({ ...selection, intensity });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 
          className="text-2xl font-bold flex items-center gap-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <Hand 
            size={28}
            style={{ color: 'var(--color-wholesale)' }}
          />
          Handwork & Embellishments
        </h2>
        <p 
          className="mt-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Add the final creative touch with handwork decorations
        </p>
      </div>

      {/* Comic-Style Introduction */}
      <div 
        className="rounded-xl p-6 border-2"
        style={{
          background: 'linear-gradient(to bottom right, rgba(168, 85, 247, 0.3), rgba(236, 72, 153, 0.3))',
          borderColor: 'rgba(168, 85, 247, 0.3)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div className="flex items-start gap-4">
          <div className="text-6xl">🎨</div>
          <div>
            <h3 
              className="text-xl font-bold mb-2 flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <Sparkles 
                size={20}
                style={{ color: 'var(--color-warning)' }}
              />
              Welcome to the Magic Studio!
            </h3>
            <p style={{ color: 'var(--color-text-primary)' }}>
              This is where your fabric comes to life! Our skilled artisans will add beautiful handwork 
              to make your piece truly one-of-a-kind. Choose your favorite decorations below! ✨
            </p>
          </div>
        </div>
      </div>

      {/* Handwork Enable Toggle */}
      <div 
        className="flex items-center justify-between rounded-lg p-6 border"
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          borderColor: 'var(--color-border-secondary)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div>
          <h3 
            className="font-semibold mb-1"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Add Handwork to Your Piece?
          </h3>
          <p 
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Handwork adds premium decorative details to your garment
          </p>
        </div>
        <button
          onClick={() => onUpdate({ ...selection, hasHandwork: !selection.hasHandwork, types: [] })}
          className="px-6 py-3 rounded-lg border-2 transition-all font-semibold"
          style={{
            backgroundColor: selection.hasHandwork
              ? 'rgba(168, 85, 247, 0.2)'
              : 'var(--color-bg-card)',
            borderColor: selection.hasHandwork
              ? 'var(--color-wholesale)'
              : 'var(--color-border-secondary)',
            color: selection.hasHandwork
              ? 'var(--color-wholesale)'
              : 'var(--color-text-tertiary)',
            borderRadius: 'var(--radius-lg)'
          }}
          onMouseEnter={(e) => {
            if (!selection.hasHandwork) {
              e.currentTarget.style.borderColor = 'var(--color-border-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!selection.hasHandwork) {
              e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
            }
          }}
        >
          {selection.hasHandwork ? '✓ Yes, Add Handwork!' : 'No Handwork'}
        </button>
      </div>

      {selection.hasHandwork && (
        <>
          {/* Comic Panel 1: Select Handwork Types */}
          <div 
            className="border-4 rounded-xl p-6"
            style={{
              borderColor: 'rgba(168, 85, 247, 0.3)',
              backgroundColor: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                <span className="text-2xl">1️⃣</span>
              </div>
              <div>
                <h3 
                  className="text-xl font-bold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Choose Your Decorations!
                </h3>
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Select one or more handwork types
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {HANDWORK_TYPES.map(type => {
                const isSelected = selection.types.includes(type.id);
                
                // Map color names to semantic tokens
                const getColorToken = (colorName: string) => {
                  switch (colorName) {
                    case 'purple': return 'var(--color-wholesale)';
                    case 'blue': return 'var(--color-primary)';
                    case 'pink': return 'var(--color-primary)';
                    case 'yellow': return 'var(--color-warning)';
                    case 'cyan': return 'var(--color-primary)';
                    case 'indigo': return 'var(--color-wholesale)';
                    default: return 'var(--color-primary)';
                  }
                };
                
                const colorToken = getColorToken(type.color);
                
                return (
                  <button
                    key={type.id}
                    onClick={() => toggleHandworkType(type.id)}
                    className="relative p-6 rounded-xl border-2 transition-all transform hover:scale-105"
                    style={{
                      backgroundColor: isSelected
                        ? (type.color === 'purple' ? 'rgba(168, 85, 247, 0.2)' :
                           type.color === 'blue' ? 'rgba(59, 130, 246, 0.2)' :
                           type.color === 'pink' ? 'rgba(236, 72, 153, 0.2)' :
                           type.color === 'yellow' ? 'rgba(234, 179, 8, 0.2)' :
                           type.color === 'cyan' ? 'rgba(6, 182, 212, 0.2)' :
                           type.color === 'indigo' ? 'rgba(99, 102, 241, 0.2)' :
                           'rgba(59, 130, 246, 0.2)')
                        : 'var(--color-bg-tertiary)',
                      borderColor: isSelected ? colorToken : 'var(--color-border-secondary)',
                      borderRadius: 'var(--radius-xl)',
                      boxShadow: isSelected ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none'
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
                    {/* Comic-style burst background */}
                    {isSelected && (
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-0 text-6xl animate-pulse">💫</div>
                        <div className="absolute bottom-0 right-0 text-6xl animate-pulse">✨</div>
                      </div>
                    )}

                    <div className="relative z-10">
                      <div className="text-5xl mb-3 text-center">{type.emoji}</div>
                      <h4 
                        className="font-bold text-center"
                        style={{
                          color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-primary)'
                        }}
                      >
                        {type.name}
                      </h4>
                    </div>

                    {isSelected && (
                      <div 
                        className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center border-2"
                        style={{
                          backgroundColor: 'var(--color-success)',
                          borderColor: 'var(--color-bg-card)',
                          borderRadius: 'var(--radius-full)'
                        }}
                      >
                        <Sparkles size={16} style={{ color: 'var(--color-text-primary)' }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comic Panel 2: Intensity Level */}
          {selection.types.length > 0 && (
            <div 
              className="border-4 rounded-xl p-6"
              style={{
                borderColor: 'rgba(59, 130, 246, 0.3)',
                backgroundColor: 'var(--color-bg-card)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderRadius: 'var(--radius-full)'
                  }}
                >
                  <span className="text-2xl">2️⃣</span>
                </div>
                <div>
                  <h3 
                    className="text-xl font-bold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    How Much Sparkle?
                  </h3>
                  <p 
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Choose the intensity of handwork
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {INTENSITY_LEVELS.map(level => {
                  const isSelected = selection.intensity === level.id;
                  
                  return (
                    <button
                      key={level.id}
                      onClick={() => setIntensity(level.id as any)}
                      className="p-6 rounded-xl border-2 transition-all"
                      style={{
                        backgroundColor: isSelected
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'var(--color-bg-tertiary)',
                        borderColor: isSelected
                          ? 'var(--color-primary)'
                          : 'var(--color-border-secondary)',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: isSelected ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none'
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
                      <div className="text-4xl mb-2 text-center">{level.icon}</div>
                      <h4 
                        className="font-bold text-center mb-1"
                        style={{
                          color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-primary)'
                        }}
                      >
                        {level.name}
                      </h4>
                      <p 
                        className="text-xs text-center"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        {level.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comic Panel 3: Special Instructions */}
          {selection.types.length > 0 && (
            <div 
              className="border-4 rounded-xl p-6"
              style={{
                borderColor: 'rgba(236, 72, 153, 0.3)',
                backgroundColor: 'var(--color-bg-card)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(236, 72, 153, 0.2)',
                    borderRadius: 'var(--radius-full)'
                  }}
                >
                  <span className="text-2xl">3️⃣</span>
                </div>
                <div>
                  <h3 
                    className="text-xl font-bold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Any Special Wishes?
                  </h3>
                  <p 
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Share your creative ideas with our artisans
                  </p>
                </div>
              </div>

              <Textarea
                placeholder="Tell us about placement, patterns, or any specific design ideas... 🎨"
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

          {/* Comic-Style Preview Panel */}
          {selection.types.length > 0 && (
            <div 
              className="rounded-xl p-8 border-2 border-dashed"
              style={{
                background: 'linear-gradient(to bottom right, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.2), rgba(59, 130, 246, 0.2))',
                borderColor: 'rgba(168, 85, 247, 0.3)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="text-center mb-6">
                <h3 
                  className="text-2xl font-bold mb-2 flex items-center justify-center gap-2"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <Star style={{ color: 'var(--color-warning)' }} />
                  Your Magical Creation
                  <Star style={{ color: 'var(--color-warning)' }} />
                </h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>Here's what you've chosen!</p>
              </div>

              {/* Comic Bubbles */}
              <div className="grid grid-cols-2 gap-6">
                <div 
                  className="relative rounded-2xl p-6 border-2"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderColor: 'rgba(168, 85, 247, 0.3)',
                    borderRadius: 'var(--radius-2xl)'
                  }}
                >
                  <div 
                    className="absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--color-wholesale)',
                      color: 'var(--color-text-primary)',
                      borderRadius: 'var(--radius-full)'
                    }}
                  >
                    HANDWORK
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selection.types.map(typeId => {
                      const type = HANDWORK_TYPES.find(t => t.id === typeId);
                      return (
                        <Badge 
                          key={typeId}
                          style={{
                            backgroundColor: 'rgba(168, 85, 247, 0.2)',
                            color: 'rgba(196, 181, 253, 1)',
                            borderColor: 'rgba(168, 85, 247, 0.3)'
                          }}
                        >
                          {type?.emoji} {type?.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div 
                  className="relative rounded-2xl p-6 border-2"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    borderRadius: 'var(--radius-2xl)'
                  }}
                >
                  <div 
                    className="absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-primary)',
                      borderRadius: 'var(--radius-full)'
                    }}
                  >
                    INTENSITY
                  </div>
                  <div className="mt-2">
                    <Badge 
                      className="text-lg"
                      style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        color: 'rgba(147, 197, 253, 1)',
                        borderColor: 'rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      {INTENSITY_LEVELS.find(l => l.id === selection.intensity)?.icon}{' '}
                      {INTENSITY_LEVELS.find(l => l.id === selection.intensity)?.name}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Success Message */}
              <div 
                className="mt-6 border rounded-lg p-4 text-center"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  borderColor: 'rgba(34, 197, 94, 0.3)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <p 
                  className="font-semibold flex items-center justify-center gap-2"
                  style={{ color: 'var(--color-success)' }}
                >
                  <Heart style={{ color: 'var(--color-error)' }} size={20} />
                  Awesome! Your custom piece is ready to be created!
                  <Smile style={{ color: 'var(--color-warning)' }} size={20} />
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* No Handwork Selected */}
      {!selection.hasHandwork && (
        <div 
          className="text-center py-12 rounded-xl border-2 border-dashed"
          style={{
            backgroundColor: 'rgba(31, 41, 55, 0.3)',
            borderColor: 'var(--color-border-secondary)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div className="text-6xl mb-4">✋</div>
          <h3 
            className="text-xl font-semibold mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            No Handwork Selected
          </h3>
          <p style={{ color: 'var(--color-text-tertiary)' }}>
            That's okay! Your piece will still look beautiful without handwork.
          </p>
        </div>
      )}
    </div>
  );
};
