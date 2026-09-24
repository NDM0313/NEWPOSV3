'use client';

import React, { useEffect, useState } from 'react';
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
import { Input } from '@/app/components/ui/input';

export interface TransactionConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When set, confirm stays disabled until the user types this exact phrase. */
  requireTypedPhrase?: string;
  typedPhraseHint?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TransactionConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Yes, continue',
  cancelLabel = 'No',
  requireTypedPhrase,
  typedPhraseHint,
  onConfirm,
  onCancel,
}: TransactionConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const needsPhrase = Boolean(requireTypedPhrase);
  const phraseOk = !needsPhrase || typed.trim() === requireTypedPhrase;

  useEffect(() => {
    if (open) setTyped('');
  }, [open, requireTypedPhrase]);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent className="bg-card border-border text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground whitespace-pre-wrap">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {needsPhrase ? (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              {typedPhraseHint || `Type ${requireTypedPhrase} to confirm`}
            </label>
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireTypedPhrase}
              className="bg-muted border-border font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && phraseOk) {
                  e.preventDefault();
                  onConfirm();
                }
              }}
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel
            className="bg-muted border-border text-foreground hover:bg-muted"
            onClick={onCancel}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-foreground disabled:opacity-40"
            disabled={!phraseOk}
            onClick={(e) => {
              if (!phraseOk) {
                e.preventDefault();
                return;
              }
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
