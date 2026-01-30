'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';

interface PaymentDeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  referenceNumber?: string;
  isLoading?: boolean;
}

export const PaymentDeleteConfirmationModal: React.FC<PaymentDeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  paymentAmount,
  paymentMethod,
  paymentDate,
  referenceNumber,
  isLoading = false,
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 bg-red-500/10 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="text-red-500 h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-white">
              Confirm Delete Payment
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-gray-300 space-y-3 pt-2">
            <p className="text-sm leading-relaxed">
              This payment will be <strong className="text-red-400">permanently deleted</strong>.
            </p>
            
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 text-sm border border-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-400">Amount:</span>
                <span className="text-white font-semibold">Rs. {paymentAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Method:</span>
                <span className="text-white capitalize">{paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date:</span>
                <span className="text-white">{new Date(paymentDate).toLocaleDateString()}</span>
              </div>
              {referenceNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Reference:</span>
                  <span className="text-blue-400 font-mono text-xs">{referenceNumber}</span>
                </div>
              )}
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-1.5 text-xs">
              <p className="text-yellow-400 font-semibold">⚠️ What will happen:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
                <li>Payment record will be removed</li>
                <li>Accounting journal entry will be reversed</li>
                <li>Paid & Due amounts will be recalculated</li>
                <li>Activity log entry will be created</li>
              </ul>
            </div>

            <p className="text-red-400 font-semibold text-sm pt-2">
              ⚠️ This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel
            onClick={onClose}
            disabled={isLoading}
            className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700 focus:ring-gray-600"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Deleting...
              </span>
            ) : (
              'Yes, Delete Payment'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
