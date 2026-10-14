import React, { useState, useEffect } from 'react';
import { X, Keyboard, Command, ArrowRight } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';

export const KeyboardShortcutsModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Ctrl+/ or Cmd+/
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen(true);
      }
      
      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'Navigation',
      icon: '🧭',
      items: [
        { key: 'Ctrl+H', description: 'Go to Dashboard' },
        { key: 'Ctrl+P', description: 'Go to POS' },
        { key: 'Ctrl+1', description: 'Go to Dashboard' },
        { key: 'Ctrl+2', description: 'Go to Products' },
        { key: 'Ctrl+3', description: 'Go to Inventory' },
        { key: 'Ctrl+4', description: 'Go to Sales' },
        { key: 'Ctrl+5', description: 'Go to Purchases' },
        { key: 'Ctrl+6', description: 'Go to Rentals' },
        { key: 'Ctrl+7', description: 'Go to Expenses' },
        { key: 'Ctrl+8', description: 'Go to Accounting' },
        { key: 'Ctrl+9', description: 'Go to Reports' },
        { key: 'Ctrl+0', description: 'Go to Settings' },
      ]
    },
    {
      category: 'Actions',
      icon: '⚡',
      items: [
        { key: 'Ctrl+N', description: 'New Entry' },
        { key: 'Ctrl+S', description: 'Save Current Form' },
        { key: 'Ctrl+F', description: 'Focus Search' },
        { key: 'F2', description: 'Edit Selected' },
        { key: 'F4', description: 'Delete Selected' },
        { key: 'Esc', description: 'Close Modal/Dialog' },
      ]
    },
    {
      category: 'Help',
      icon: '❓',
      items: [
        { key: 'Ctrl+/', description: 'Show Keyboard Shortcuts' },
      ]
    }
  ];

  const KeyBadge = ({ keys }: { keys: string }) => (
    <div className="flex items-center gap-1">
      {keys.split('+').map((key, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="text-muted-foreground text-xs">+</span>}
          <Badge 
            variant="outline" 
            className="bg-card border-border text-muted-foreground px-2 py-0.5 text-xs font-mono"
          >
            {key}
          </Badge>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Keyboard className="text-blue-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Keyboard Shortcuts</h2>
                <p className="text-sm text-muted-foreground">Master the ERP with these shortcuts</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {shortcuts.map((category) => (
                <div key={category.category} className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">{category.icon}</span>
                    <h3 className="text-lg font-bold text-foreground">{category.category}</h3>
                  </div>
                  <div className="space-y-2">
                    {category.items.map((shortcut) => (
                      <div
                        key={shortcut.key}
                        className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                        <KeyBadge keys={shortcut.key} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Tips */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="flex items-start gap-3">
                <Command className="text-blue-400 mt-0.5" size={18} />
                <div>
                  <h4 className="text-sm font-semibold text-blue-300 mb-1">Pro Tips</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Use <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-xs">Ctrl+F</kbd> to quickly search in any page</li>
                    <li>• Press <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-xs">Esc</kbd> to close any dialog or modal</li>
                    <li>• Number shortcuts (Ctrl+1-9) work across all modules</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-border bg-muted/40">
            <div className="text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 bg-card border border-border rounded">Ctrl+/</kbd> anytime to view shortcuts
            </div>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted text-sm"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

// Export a button to trigger the modal
export const KeyboardShortcutsButton = ({ onClick }: { onClick?: () => void }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
    >
      <Keyboard size={16} />
      <span>Shortcuts</span>
      <Badge variant="outline" className="bg-card border-border text-muted-foreground text-xs">
        Ctrl+/
      </Badge>
    </button>
  );
};
