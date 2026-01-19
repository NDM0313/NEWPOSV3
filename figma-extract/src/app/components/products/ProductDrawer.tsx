import React from 'react';
import { Drawer as VaulDrawer } from 'vaul';
import { motion, AnimatePresence } from 'motion/react';
import { EnhancedProductForm } from './EnhancedProductForm';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface ProductDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndAdd?: (product: any) => void;
}

export const ProductDrawer = ({ isOpen, onClose, onSaveAndAdd }: ProductDrawerProps) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-4xl bg-gray-900 z-50 shadow-2xl border-l border-gray-800"
            >
              <EnhancedProductForm 
                onCancel={onClose} 
                onSave={onClose} 
                onSaveAndAdd={onSaveAndAdd}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <VaulDrawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <VaulDrawer.Portal>
        <VaulDrawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <VaulDrawer.Content className="bg-gray-900 flex flex-col rounded-t-[10px] h-[90vh] mt-24 fixed bottom-0 left-0 right-0 z-50 outline-none border-t border-gray-800">
          <div className="p-4 bg-gray-900 rounded-t-[10px] flex-1 overflow-hidden relative">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-700 mb-6" />
            <div className="h-full overflow-hidden">
                <EnhancedProductForm 
                  onCancel={onClose} 
                  onSave={onClose} 
                  onSaveAndAdd={onSaveAndAdd}
                />
            </div>
          </div>
        </VaulDrawer.Content>
      </VaulDrawer.Portal>
    </VaulDrawer.Root>
  );
};