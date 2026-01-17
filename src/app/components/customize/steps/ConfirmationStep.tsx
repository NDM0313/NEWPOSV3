import React from 'react';
import { Eye, CheckCircle, Palette, Sparkles, Layers } from 'lucide-react';
import { Badge } from "../../ui/badge";
import { FabricSelection } from '../CustomizeStudio';

interface ConfirmationStepProps {
  selection: FabricSelection;
}

const FABRICS_MAP: Record<string, string> = {
  silk: 'Pure Silk',
  velvet: 'Red Velvet',
  cotton: 'Premium Cotton',
  chiffon: 'Chiffon',
  georgette: 'Georgette',
  banarasi: 'Banarasi Silk'
};

export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({ selection }) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 
          className="text-2xl font-bold flex items-center gap-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <Eye 
            size={28}
            style={{ color: 'var(--color-wholesale)' }}
          />
          Preview & Confirmation
        </h2>
        <p 
          className="mt-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Review your fabric selections before proceeding to stitching
        </p>
      </div>

      {/* Visual Preview */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Fabric Visual */}
        <div 
          className="rounded-xl p-8 border"
          style={{
            background: 'linear-gradient(to bottom right, var(--color-bg-tertiary), var(--color-bg-card))',
            borderColor: 'var(--color-border-secondary)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div className="text-center mb-6">
            <Badge 
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                color: 'var(--color-wholesale)',
                borderColor: 'rgba(168, 85, 247, 0.3)'
              }}
            >
              Visual Preview
            </Badge>
          </div>
          
          {/* Color Preview */}
          <div className="space-y-4">
            <div 
              className="relative h-64 rounded-lg overflow-hidden border-2"
              style={{
                borderColor: 'var(--color-border-secondary)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              {/* Primary Color Layer */}
              <div
                className="absolute inset-0"
                style={{ backgroundColor: selection.colors.primary }}
              />
              
              {/* Gradient Overlay if dyeing is gradient */}
              {selection.dyeing?.type === 'gradient' && selection.dyeing.secondary && (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${selection.colors.primary} 0%, ${selection.dyeing.secondary} 100%)`
                  }}
                />
              )}

              {/* Pattern Overlay */}
              <div className="absolute inset-0 opacity-20">
                <div className="w-full h-full"
                  style={{
                    backgroundImage: `repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 10px,
                      rgba(255,255,255,0.1) 10px,
                      rgba(255,255,255,0.1) 20px
                    )`
                  }}
                />
              </div>

              {/* Lace Border */}
              {selection.lace && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-white/10 border-t-2 border-white/30 backdrop-blur-sm">
                  <div className="text-center text-white text-xs pt-2 font-semibold">
                    {selection.lace.style.toUpperCase()} LACE
                  </div>
                </div>
              )}

              {/* Fabric Label */}
              <div className="absolute top-4 left-4">
                <Badge 
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    color: 'var(--color-text-primary)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  {FABRICS_MAP[selection.baseFabric || '']}
                </Badge>
              </div>
            </div>

            {/* Color Swatches */}
            <div className="flex gap-3 justify-center">
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-lg border-2 shadow-lg"
                  style={{
                    backgroundColor: selection.colors.primary,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                  }}
                />
                <div 
                  className="text-xs mt-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Primary
                </div>
              </div>
              {selection.colors.secondary && (
                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-lg border-2 shadow-lg"
                    style={{
                      backgroundColor: selection.colors.secondary,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                    }}
                  />
                  <div 
                    className="text-xs mt-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Secondary
                  </div>
                </div>
              )}
              {selection.colors.accent && (
                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-lg border-2 shadow-lg"
                    style={{
                      backgroundColor: selection.colors.accent,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                    }}
                  />
                  <div 
                    className="text-xs mt-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Accent
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Details List */}
        <div className="space-y-4">
          {/* Base Fabric */}
          <div 
            className="rounded-lg p-6 border"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderColor: 'var(--color-border-secondary)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div className="flex items-start gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <Palette size={20} style={{ color: 'var(--color-wholesale)' }} />
              </div>
              <div className="flex-1">
                <h3 
                  className="font-semibold mb-2"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Base Fabric
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Type:</span>
                    <span 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {FABRICS_MAP[selection.baseFabric || '']}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Cloth Type:</span>
                    <span 
                      className="capitalize"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {selection.clothType}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lace Details */}
          {selection.lace && (
            <div 
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <div className="flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: 'rgba(236, 72, 153, 0.2)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <Sparkles size={20} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div className="flex-1">
                  <h3 
                    className="font-semibold mb-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Lace Details
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Style:</span>
                      <span 
                        className="capitalize"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {selection.lace.style}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Width:</span>
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        {selection.lace.width.replace('inch', '"')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dyeing Details */}
          {selection.dyeing && (
            <div 
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <div className="flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <Palette size={20} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div className="flex-1">
                  <h3 
                    className="font-semibold mb-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Dyeing
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Type:</span>
                      <span 
                        className="capitalize"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {selection.dyeing.type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Primary Color:</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded border"
                          style={{
                            backgroundColor: selection.dyeing.primary,
                            borderColor: 'var(--color-border-secondary)',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        />
                        <span 
                          className="text-xs"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {selection.dyeing.primary}
                        </span>
                      </div>
                    </div>
                    {selection.dyeing.secondary && (
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--color-text-secondary)' }}>Secondary Color:</span>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border"
                            style={{
                              backgroundColor: selection.dyeing.secondary,
                              borderColor: 'var(--color-border-secondary)',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          />
                          <span 
                            className="text-xs"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {selection.dyeing.secondary}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ready-made */}
          {selection.isReadyMade && (
            <div 
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <div className="flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                </div>
                <div className="flex-1">
                  <h3 
                    className="font-semibold mb-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Ready-made Option
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Type:</span>
                      <span 
                        className="capitalize"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {selection.readyMadeType?.replace('-', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Double Cloth */}
          {selection.isDoubleCloth && (
            <div 
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <div className="flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: 'rgba(249, 115, 22, 0.2)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <Layers size={20} style={{ color: 'var(--color-warning)' }} />
                </div>
                <div className="flex-1">
                  <h3 
                    className="font-semibold mb-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Double Cloth
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Type:</span>
                      <span 
                        className="capitalize"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {selection.doubleClothType}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Message */}
      <div 
        className="border rounded-lg p-6"
        style={{
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderColor: 'rgba(34, 197, 94, 0.2)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div className="flex items-start gap-3">
          <CheckCircle 
            size={24} 
            className="shrink-0"
            style={{ color: 'var(--color-success)' }}
          />
          <div>
            <h3 
              className="font-semibold mb-2"
              style={{ color: 'var(--color-success)' }}
            >
              Fabric Selection Complete!
            </h3>
            <p 
              className="text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Your fabric configuration looks great! Click "Next Step" to proceed with stitching options.
              You can always go back to make changes if needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
