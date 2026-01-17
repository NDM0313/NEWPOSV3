import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Sparkles,
  Palette,
  Scissors,
  Shirt,
  Layers,
  PackageOpen,
  Hand,
  Zap,
  Eye,
  Save,
  RotateCcw
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { FabricSelectionStep } from './steps/FabricSelectionStep';
import { ConfirmationStep } from './steps/ConfirmationStep';
import { StitchingStep } from './steps/StitchingStep';
import { HandworkStep } from './steps/HandworkStep';

export interface FabricSelection {
  baseFabric: string | null;
  fabricType: string;
  lace: {
    style: string;
    width: string;
    pattern: string;
  } | null;
  dyeing: {
    type: 'solid' | 'gradient' | 'none';
    primary: string;
    secondary?: string;
  } | null;
  colors: {
    primary: string;
    secondary?: string;
    accent?: string;
  };
  clothType: string;
  isReadyMade: boolean;
  readyMadeType?: string;
  isDoubleCloth: boolean;
  doubleClothType?: string;
}

export interface StitchingSelection {
  type: 'machine' | 'hand' | 'decorative' | null;
  details: string;
  measurements?: {
    chest?: string;
    waist?: string;
    length?: string;
    sleeve?: string;
  };
}

export interface HandworkSelection {
  hasHandwork: boolean;
  types: string[];
  details: string;
  intensity: 'light' | 'medium' | 'heavy';
}

type Step = 1 | 2 | 3 | 4;

export const CustomizeStudio = () => {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [fabricSelection, setFabricSelection] = useState<FabricSelection>({
    baseFabric: null,
    fabricType: 'silk',
    lace: null,
    dyeing: null,
    colors: {
      primary: '#FF1493',
      secondary: '#FFD700',
      accent: '#FFFFFF'
    },
    clothType: 'basic',
    isReadyMade: false,
    isDoubleCloth: false
  });
  
  const [stitchingSelection, setStitchingSelection] = useState<StitchingSelection>({
    type: null,
    details: ''
  });
  
  const [handworkSelection, setHandworkSelection] = useState<HandworkSelection>({
    hasHandwork: false,
    types: [],
    details: '',
    intensity: 'medium'
  });

  const steps = [
    { id: 1, label: 'Fabric Selection', icon: Palette, description: 'Choose fabric, lace, dyeing & colors' },
    { id: 2, label: 'Confirmation', icon: Eye, description: 'Preview your selections' },
    { id: 3, label: 'Stitching', icon: Scissors, description: 'Select stitching method' },
    { id: 4, label: 'Handwork', icon: Hand, description: 'Add decorative handwork' }
  ];

  const canProceedFromStep1 = () => {
    return fabricSelection.baseFabric !== null;
  };

  const canProceedFromStep2 = () => {
    return true; // Confirmation is just preview
  };

  const canProceedFromStep3 = () => {
    return stitchingSelection.type !== null;
  };

  const handleNext = () => {
    if (currentStep === 1 && !canProceedFromStep1()) {
      alert('Please select a base fabric to continue');
      return;
    }
    if (currentStep === 2 && !canProceedFromStep2()) {
      return;
    }
    if (currentStep === 3 && !canProceedFromStep3()) {
      alert('Please select a stitching method to continue');
      return;
    }
    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const handleSave = () => {
    const customOrder = {
      fabric: fabricSelection,
      stitching: stitchingSelection,
      handwork: handworkSelection,
      createdAt: new Date().toISOString()
    };
    console.log('Custom Order Created:', customOrder);
    alert('Custom order saved successfully! 🎉');
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all selections?')) {
      setCurrentStep(1);
      setFabricSelection({
        baseFabric: null,
        fabricType: 'silk',
        lace: null,
        dyeing: null,
        colors: {
          primary: '#FF1493',
          secondary: '#FFD700',
          accent: '#FFFFFF'
        },
        clothType: 'basic',
        isReadyMade: false,
        isDoubleCloth: false
      });
      setStitchingSelection({ type: null, details: '' });
      setHandworkSelection({ hasHandwork: false, types: [], details: '', intensity: 'medium' });
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 
              className="text-3xl font-bold flex items-center gap-3"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <Sparkles 
                size={32}
                style={{ color: 'var(--color-wholesale)' }}
              />
              Custom Studio Workflow
            </h1>
            <p 
              className="mt-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Create personalized bridal pieces with our modular pipeline
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
              }}
            >
              <RotateCcw size={16} className="mr-2" />
              Reset
            </Button>
            {currentStep === 4 && (
              <Button
                onClick={handleSave}
                style={{
                  backgroundColor: 'var(--color-wholesale)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.9)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
                }}
              >
                <Save size={16} className="mr-2" />
                Save Order
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      backgroundColor: isCompleted
                        ? 'rgba(34, 197, 94, 0.2)'
                        : isActive
                        ? 'rgba(168, 85, 247, 0.2)'
                        : 'var(--color-bg-card)',
                      borderWidth: '2px',
                      borderColor: isCompleted
                        ? 'var(--color-success)'
                        : isActive
                        ? 'var(--color-wholesale)'
                        : 'var(--color-border-secondary)',
                      borderRadius: 'var(--radius-full)',
                      boxShadow: isActive ? '0 10px 15px -3px rgba(168, 85, 247, 0.2)' : 'none'
                    }}
                  >
                    {isCompleted ? (
                      <Check size={28} style={{ color: 'var(--color-success)' }} />
                    ) : (
                      <StepIcon
                        size={28}
                        style={{
                          color: isActive ? 'var(--color-wholesale)' : 'var(--color-text-tertiary)'
                        }}
                      />
                    )}
                  </div>
                  <div className="text-center mt-3">
                    <div
                      className="font-semibold"
                      style={{
                        color: isActive 
                          ? 'var(--color-text-primary)' 
                          : isCompleted 
                          ? 'var(--color-success)' 
                          : 'var(--color-text-tertiary)'
                      }}
                    >
                      {step.label}
                    </div>
                    <div 
                      className="text-xs mt-1 max-w-[120px]"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {step.description}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mb-12 transition-all duration-300"
                    style={{
                      backgroundColor: currentStep > step.id 
                        ? 'var(--color-success)' 
                        : 'var(--color-border-primary)'
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-6xl mx-auto">
        <div 
          className="border rounded-xl p-8 min-h-[600px]"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          {currentStep === 1 && (
            <FabricSelectionStep
              selection={fabricSelection}
              onUpdate={setFabricSelection}
            />
          )}
          {currentStep === 2 && (
            <ConfirmationStep selection={fabricSelection} />
          )}
          {currentStep === 3 && (
            <StitchingStep
              selection={stitchingSelection}
              onUpdate={setStitchingSelection}
            />
          )}
          {currentStep === 4 && (
            <HandworkStep
              selection={handworkSelection}
              onUpdate={setHandworkSelection}
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-6xl mx-auto mt-6 flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            color: 'var(--color-text-primary)',
            opacity: currentStep === 1 ? 0.5 : 1
          }}
          onMouseEnter={(e) => {
            if (currentStep !== 1) {
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }
          }}
          onMouseLeave={(e) => {
            if (currentStep !== 1) {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
            }
          }}
        >
          <ChevronLeft size={16} className="mr-2" />
          Back
        </Button>
        
        {currentStep < 4 ? (
          <Button
            onClick={handleNext}
            style={{
              backgroundColor: 'var(--color-wholesale)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
            }}
          >
            Next Step
            <ChevronRight size={16} className="ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            style={{
              backgroundColor: 'var(--color-success)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-success)';
            }}
          >
            <Check size={16} className="mr-2" />
            Complete Order
          </Button>
        )}
      </div>
    </div>
  );
};