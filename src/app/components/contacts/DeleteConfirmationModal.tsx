import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from "../ui/button";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  contactName: string;
}

export const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  contactName
}: DeleteConfirmationModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div 
        className="relative w-full max-w-md border rounded-xl shadow-2xl p-6 transform transition-all animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-secondary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div className="flex flex-col items-center text-center space-y-4">
          
          {/* Icon */}
          <div 
            className="h-16 w-16 rounded-full flex items-center justify-center mb-2"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 'var(--radius-full)'
            }}
          >
            <div 
              className="h-12 w-12 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-full)'
              }}
            >
              <Trash2 
                className="h-6 w-6"
                style={{ color: 'var(--color-error)' }}
              />
            </div>
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h3 
              className="text-xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Delete Contact?
            </h3>
            <p 
              className="text-sm leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Are you sure you want to delete <span 
                className="font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {contactName}
              </span>? 
              All associated transactions will be unlinked.
            </p>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3 w-full mt-4">
            <Button 
              variant="ghost" 
              onClick={onClose}
              className="w-full border"
              style={{
                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-secondary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={onConfirm}
              className="w-full font-semibold border border-transparent"
              style={{
                backgroundColor: 'var(--color-error)',
                color: 'var(--color-text-primary)',
                boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-error)';
              }}
            >
              Delete
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};
