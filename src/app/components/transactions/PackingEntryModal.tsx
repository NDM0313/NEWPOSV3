import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Package, Layers, Ruler, X, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { cn } from "../ui/utils";

/**
 * Packing Entry Modal - Variable Sub-Unit Logic for Textile Wholesale
 * 
 * Business Logic:
 * - Boxes can contain any number of Pieces
 * - Pieces can contain any number of Meters (decimal support)
 * - Billing Unit: Price calculated on Total Meters
 * - Inventory Unit: Track Stock in Boxes, Pieces, AND Meters
 * 
 * Features:
 * - Two modes: Detailed Entry & Quick/Lump Sum
 * - Add multiple boxes with variable pieces
 * - Support for loose pieces (without boxes)
 * - Real-time calculation of totals
 * - Keyboard friendly (Enter key navigation)
 * - Decimal support for meters (e.g., 5.25 meters)
 */

export interface PackingBox {
  box_no: number;
  pieces: number[]; // Array of meter values
}

export interface PackingDetails {
  boxes: PackingBox[];
  total_boxes: number;
  total_pieces: number;
  total_meters: number;
}

interface PackingEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (details: PackingDetails) => void;
  initialData?: PackingDetails;
  productName?: string;
}

export const PackingEntryModal = ({
  open,
  onOpenChange,
  onSave,
  initialData,
  productName = "Product"
}: PackingEntryModalProps) => {
  const [boxes, setBoxes] = useState<PackingBox[]>([]);
  const [loosePieces, setLoosePieces] = useState<number[]>([]); // For direct piece entry without box
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Tab state: 'detailed' or 'quick'
  const [activeTab, setActiveTab] = useState<'detailed' | 'quick'>('detailed');
  
  // Quick entry state
  const [quickBoxes, setQuickBoxes] = useState<number>(0);
  const [quickPieces, setQuickPieces] = useState<number>(0);
  const [quickMeters, setQuickMeters] = useState<number>(0);

  // Reset state when modal opens - Pre-fill with initialData if editing
  useEffect(() => {
    if (open) {
      if (initialData) {
        // Edit mode - Pre-fill with existing data
        setBoxes(initialData.boxes || []);
        setLoosePieces([]);
        setQuickBoxes(initialData.total_boxes || 0);
        setQuickPieces(initialData.total_pieces || 0);
        setQuickMeters(initialData.total_meters || 0);
        // Determine which tab to show based on data structure
        setActiveTab(initialData.boxes && initialData.boxes.length > 0 ? 'detailed' : 'quick');
      } else {
        // Add mode - Start with empty state
        setBoxes([]);
        setLoosePieces([]);
        setQuickBoxes(0);
        setQuickPieces(0);
        setQuickMeters(0);
        setActiveTab('detailed');
      }
    }
  }, [open, initialData]);

  // Initialize with one box if empty (only for detailed mode)
  useEffect(() => {
    if (open && boxes.length === 0 && loosePieces.length === 0 && activeTab === 'detailed') {
      addBox();
    }
  }, [open, activeTab]);

  const addBox = () => {
    const newBoxNo = boxes.length > 0 ? Math.max(...boxes.map(b => b.box_no)) + 1 : 1;
    setBoxes([...boxes, { box_no: newBoxNo, pieces: [0] }]);
    
    // Focus on the first piece input of the new box
    setTimeout(() => {
      const key = `box-${newBoxNo}-piece-0`;
      inputRefs.current[key]?.focus();
      inputRefs.current[key]?.select();
    }, 50);
  };

  const removeBox = (boxNo: number) => {
    setBoxes(boxes.filter(b => b.box_no !== boxNo));
  };

  const addPieceToBox = (boxNo: number) => {
    setBoxes(boxes.map(b => {
      if (b.box_no === boxNo) {
        return { ...b, pieces: [...b.pieces, 0] };
      }
      return b;
    }));

    // Focus on the new piece input
    setTimeout(() => {
      const box = boxes.find(b => b.box_no === boxNo);
      const pieceIndex = box ? box.pieces.length : 0;
      const key = `box-${boxNo}-piece-${pieceIndex}`;
      inputRefs.current[key]?.focus();
      inputRefs.current[key]?.select();
    }, 50);
  };

  const removePieceFromBox = (boxNo: number, pieceIndex: number) => {
    setBoxes(boxes.map(b => {
      if (b.box_no === boxNo) {
        const newPieces = b.pieces.filter((_, i) => i !== pieceIndex);
        return { ...b, pieces: newPieces.length > 0 ? newPieces : [0] };
      }
      return b;
    }));
  };

  const updatePiece = (boxNo: number, pieceIndex: number, value: number) => {
    setBoxes(boxes.map(b => {
      if (b.box_no === boxNo) {
        const newPieces = [...b.pieces];
        newPieces[pieceIndex] = value;
        return { ...b, pieces: newPieces };
      }
      return b;
    }));
  };

  const addLoosePiece = () => {
    setLoosePieces([...loosePieces, 0]);
    setTimeout(() => {
      const key = `loose-piece-${loosePieces.length}`;
      inputRefs.current[key]?.focus();
      inputRefs.current[key]?.select();
    }, 50);
  };

  const removeLoosePiece = (index: number) => {
    setLoosePieces(loosePieces.filter((_, i) => i !== index));
  };

  const updateLoosePiece = (index: number, value: number) => {
    const newPieces = [...loosePieces];
    newPieces[index] = value;
    setLoosePieces(newPieces);
  };

  // Calculate totals for detailed entry
  const calculateDetailedTotals = (): PackingDetails => {
    // Filter out boxes that have no valid pieces (all pieces are 0 or no pieces)
    const validBoxes = boxes.filter(box => 
      box.pieces.some(meters => meters > 0)
    );
    
    const totalBoxes = validBoxes.length;
    
    // Count only pieces with value > 0
    const boxPieces = validBoxes.reduce((sum, box) => 
      sum + box.pieces.filter(meters => meters > 0).length, 0
    );
    
    // Count only loose pieces with value > 0
    const validLoosePieces = loosePieces.filter(meters => meters > 0);
    const totalPieces = boxPieces + validLoosePieces.length;
    
    // Sum only meters > 0
    const boxMeters = validBoxes.reduce((sum, box) => 
      sum + box.pieces.filter(meters => meters > 0).reduce((pieceSum, meters) => pieceSum + meters, 0), 0
    );
    const looseMeters = validLoosePieces.reduce((sum, meters) => sum + meters, 0);
    const totalMeters = boxMeters + looseMeters;

    return {
      boxes: validBoxes,
      total_boxes: totalBoxes,
      total_pieces: totalPieces,
      total_meters: parseFloat(totalMeters.toFixed(2))
    };
  };

  // Calculate totals for quick entry
  const calculateQuickTotals = (): PackingDetails => {
    // Create a simplified structure for quick entry only if values are greater than 0
    // We'll create one "virtual" box that represents the lump sum
    const virtualBox: PackingBox = {
      box_no: 1,
      pieces: quickMeters > 0 ? [quickMeters] : [] // Single piece representing total meters
    };

    return {
      boxes: quickMeters > 0 ? [virtualBox] : [],
      total_boxes: quickBoxes > 0 ? quickBoxes : 0,
      total_pieces: quickPieces > 0 ? quickPieces : 0,
      total_meters: quickMeters > 0 ? parseFloat(quickMeters.toFixed(2)) : 0
    };
  };

  const totals = activeTab === 'detailed' ? calculateDetailedTotals() : calculateQuickTotals();

  // Calculate average meters per piece for quick mode
  const avgMetersPerPiece = quickPieces > 0 ? quickMeters / quickPieces : 0;

  const handleSave = () => {
    onSave(totals);
    onOpenChange(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent, boxNo: number, pieceIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPieceToBox(boxNo);
    }
  };

  const handleLooseKeyPress = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLoosePiece();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] bg-gray-900 border-gray-800 text-white max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-800">
          <DialogTitle className="flex items-center gap-3 text-white">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Package size={20} className="text-blue-500" />
            </div>
            Packing Entry
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Enter box, piece, and meter details for <span className="text-blue-400 font-medium">{productName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="px-6 pt-4">
          <div className="inline-flex items-center gap-1 p-1 bg-gray-950 border border-gray-800 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('detailed')}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                activeTab === 'detailed'
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
              )}
            >
              <Package size={14} />
              Detailed Entry
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('quick')}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                activeTab === 'quick'
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
              )}
            >
              <Zap size={14} />
              Quick / Lump Sum
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 max-h-[calc(90vh-280px)] overflow-y-auto">
          <div className="space-y-4 py-4">
            {/* DETAILED ENTRY MODE */}
            {activeTab === 'detailed' && (
              <>
                {/* Boxes Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <Package size={16} className="text-blue-400" />
                      Boxes
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addBox}
                      className="h-7 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                    >
                      <Plus size={14} className="mr-1" /> Add Box
                    </Button>
                  </div>

                  {boxes.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm border border-dashed border-gray-800 rounded-lg">
                      No boxes added. Click "Add Box" to start.
                    </div>
                  ) : (
                    boxes.map((box) => (
                      <div
                        key={box.box_no}
                        className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-3"
                      >
                        {/* Box Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center">
                              <span className="text-sm font-bold text-blue-400">#{box.box_no}</span>
                            </div>
                            <span className="text-sm text-gray-400">
                              {box.pieces.length} {box.pieces.length === 1 ? 'Piece' : 'Pieces'} • {box.pieces.reduce((sum, m) => sum + m, 0).toFixed(2)} M
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeBox(box.box_no)}
                            className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>

                        {/* Pieces */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {box.pieces.map((meters, pieceIndex) => (
                            <div key={pieceIndex} className="relative">
                              <div className="flex items-center gap-1">
                                <div className="relative flex-1">
                                  <Ruler className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                  <Input
                                    ref={el => inputRefs.current[`box-${box.box_no}-piece-${pieceIndex}`] = el}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={meters || ''}
                                    onChange={(e) => updatePiece(box.box_no, pieceIndex, parseFloat(e.target.value) || 0)}
                                    onKeyPress={(e) => handleKeyPress(e, box.box_no, pieceIndex)}
                                    className="pl-7 pr-12 h-8 bg-gray-900 border-gray-700 text-white text-sm focus:border-blue-500"
                                    placeholder="0.00"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                                    M
                                  </span>
                                </div>
                                {box.pieces.length > 1 && (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removePieceFromBox(box.box_no, pieceIndex)}
                                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20 flex-shrink-0"
                                  >
                                    <X size={12} />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add Piece to Box */}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => addPieceToBox(box.box_no)}
                          className="w-full h-7 text-xs border border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/5"
                        >
                          <Plus size={12} className="mr-1" /> Add Piece
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <Separator className="bg-gray-800" />

                {/* Loose Pieces Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <Layers size={16} className="text-purple-400" />
                      Loose Pieces (No Box)
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addLoosePiece}
                      className="h-7 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                    >
                      <Plus size={14} className="mr-1" /> Add Piece
                    </Button>
                  </div>

                  {loosePieces.length === 0 ? (
                    <div className="text-center py-4 text-gray-600 text-xs italic">
                      Optional: Add pieces sold without a box
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {loosePieces.map((meters, index) => (
                        <div key={index} className="flex items-center gap-1">
                          <div className="relative flex-1">
                            <Ruler className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                            <Input
                              ref={el => inputRefs.current[`loose-piece-${index}`] = el}
                              type="number"
                              step="0.01"
                              min="0"
                              value={meters || ''}
                              onChange={(e) => updateLoosePiece(index, parseFloat(e.target.value) || 0)}
                              onKeyPress={(e) => handleLooseKeyPress(e, index)}
                              className="pl-7 pr-12 h-8 bg-gray-900 border-gray-700 text-white text-sm focus:border-purple-500"
                              placeholder="0.00"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                              M
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeLoosePiece(index)}
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20 flex-shrink-0"
                          >
                            <X size={12} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* QUICK / LUMP SUM MODE */}
            {activeTab === 'quick' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-lg p-6 space-y-6">
                  <h4 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                    <Zap size={16} />
                    Quick Entry - Enter Summary Totals
                  </h4>
                  
                  {/* Input 1: Number of Boxes */}
                  <div className="space-y-2">
                    <Label htmlFor="quick-boxes" className="text-gray-300">
                      Number of Boxes
                    </Label>
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <Input
                        id="quick-boxes"
                        type="number"
                        step="1"
                        min="0"
                        value={quickBoxes || ''}
                        onChange={(e) => setQuickBoxes(parseInt(e.target.value) || 0)}
                        className="pl-10 h-12 bg-gray-950 border-gray-700 text-white text-lg focus:border-blue-500"
                        placeholder="e.g., 1"
                      />
                    </div>
                  </div>

                  {/* Input 2: Number of Pieces */}
                  <div className="space-y-2">
                    <Label htmlFor="quick-pieces" className="text-gray-300">
                      Number of Pieces
                    </Label>
                    <div className="relative">
                      <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <Input
                        id="quick-pieces"
                        type="number"
                        step="1"
                        min="0"
                        value={quickPieces || ''}
                        onChange={(e) => setQuickPieces(parseInt(e.target.value) || 0)}
                        className="pl-10 h-12 bg-gray-950 border-gray-700 text-white text-lg focus:border-blue-500"
                        placeholder="e.g., 15"
                      />
                    </div>
                  </div>

                  {/* Input 3: Total Meters - CRITICAL */}
                  <div className="space-y-2">
                    <Label htmlFor="quick-meters" className="text-gray-300 flex items-center gap-2">
                      Total Meters 
                      <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                        ⚡ Critical for Billing
                      </span>
                    </Label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                      <Input
                        id="quick-meters"
                        type="number"
                        step="0.01"
                        min="0"
                        value={quickMeters || ''}
                        onChange={(e) => setQuickMeters(parseFloat(e.target.value) || 0)}
                        className="pl-10 h-14 bg-gray-950 border-green-600/50 text-white text-2xl font-bold focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                        placeholder="e.g., 786.6"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-green-500 font-bold">
                        M
                      </span>
                    </div>
                  </div>

                  {/* Average Calculation Display */}
                  {quickPieces > 0 && quickMeters > 0 && (
                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 mt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Average Meter per Piece:</span>
                        <span className="text-xl font-bold text-purple-400">
                          ~{avgMetersPerPiece.toFixed(2)} M
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        Calculated as: {quickMeters.toFixed(2)} M ÷ {quickPieces} pieces
                      </p>
                    </div>
                  )}
                </div>

                {/* Info Box */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <p className="text-sm text-blue-300 flex items-start gap-2">
                    <span className="mt-0.5">ℹ️</span>
                    <span>
                      <strong>Quick Entry Mode:</strong> Perfect for when you already know the totals and don't need detailed piece-by-piece tracking.
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Summary & Footer */}
        <div className="border-t border-gray-800 bg-gray-950 px-6 py-4 space-y-4">
          {/* Summary - Only show non-zero values */}
          <div className={cn(
            "grid gap-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg",
            // Dynamic grid columns based on non-zero values
            [totals.total_boxes > 0, totals.total_pieces > 0, totals.total_meters > 0].filter(Boolean).length === 3 ? "grid-cols-3" :
            [totals.total_boxes > 0, totals.total_pieces > 0, totals.total_meters > 0].filter(Boolean).length === 2 ? "grid-cols-2" :
            "grid-cols-1"
          )}>
            {totals.total_boxes > 0 && (
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Total Boxes</div>
                <div className="text-2xl font-bold text-blue-400">{totals.total_boxes}</div>
              </div>
            )}
            {totals.total_pieces > 0 && (
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Total Pieces</div>
                <div className="text-2xl font-bold text-purple-400">{totals.total_pieces}</div>
              </div>
            )}
            {totals.total_meters > 0 && (
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Total Meters</div>
                <div className="text-2xl font-bold text-green-400">{totals.total_meters.toFixed(2)}</div>
              </div>
            )}
          </div>

          {/* Info - Only show for detailed mode */}
          {activeTab === 'detailed' && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <p className="text-xs text-yellow-400 flex items-start gap-2">
                <span className="mt-0.5">💡</span>
                <span>
                  <strong>Tip:</strong> Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-[10px]">Enter</kbd> after typing meters to quickly add another piece.
                </span>
              </p>
            </div>
          )}

          {/* Actions */}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
              disabled={totals.total_meters === 0}
            >
              Save Packing
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};