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
      <div className="relative w-full max-w-md bg-[#1F2937] border border-gray-700 rounded-xl shadow-2xl p-6 transform transition-all animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-4">
          
          {/* Icon */}
          <div className="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
            <div className="h-12 w-12 bg-red-500/20 rounded-full flex items-center justify-center">
              <Trash2 className="text-red-500 h-6 w-6" />
            </div>
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Delete Contact?</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-white">{contactName}</span>? 
              All associated transactions will be unlinked.
            </p>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3 w-full mt-4">
            <Button 
              variant="ghost" 
              onClick={onClose}
              className="w-full bg-gray-800/50 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={onConfirm}
              className="w-full bg-[#EF4444] hover:bg-red-600 text-white font-semibold shadow-lg shadow-red-500/20 border border-transparent"
            >
              Delete
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};
