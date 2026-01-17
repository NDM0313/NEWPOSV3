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
  const [boxes, setBoxes] = useState<PackingBox[]>(initialData?.boxes || []);
  const [loosePieces, setLoosePieces] = useState<number[]>([]); // For direct piece entry without box
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Tab state: 'detailed' or 'quick'
  const [activeTab, setActiveTab] = useState<'detailed' | 'quick'>('detailed');
  
  // Quick entry state
  const [quickBoxes, setQuickBoxes] = useState<number>(initialData?.total_boxes || 0);
  const [quickPieces, setQuickPieces] = useState<number>(initialData?.total_pieces || 0);
  const [quickMeters, setQuickMeters] = useState<number>(initialData?.total_meters || 0);

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
    const totalBoxes = boxes.length;
    const boxPieces = boxes.reduce((sum, box) => sum + box.pieces.length, 0);
    const totalPieces = boxPieces + loosePieces.length;
    const boxMeters = boxes.reduce((sum, box) => 
      sum + box.pieces.reduce((pieceSum, meters) => pieceSum + meters, 0), 0
    );
    const looseMeters = loosePieces.reduce((sum, meters) => sum + meters, 0);
    const totalMeters = boxMeters + looseMeters;

    return {
      boxes,
      total_boxes: totalBoxes,
      total_pieces: totalPieces,
      total_meters: parseFloat(totalMeters.toFixed(2))
    };
  };

  // Calculate totals for quick entry
  const calculateQuickTotals = (): PackingDetails => {
    // Create a simplified structure for quick entry
    // We'll create one "virtual" box that represents the lump sum
    const virtualBox: PackingBox = {
      box_no: 1,
      pieces: [quickMeters] // Single piece representing total meters
    };

    return {
      boxes: [virtualBox],
      total_boxes: quickBoxes,
      total_pieces: quickPieces,
      total_meters: parseFloat(quickMeters.toFixed(2))
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)'
        }}
      >
        <DialogHeader 
          className="px-6 pt-6 pb-4 border-b"
          style={{ borderBottomColor: 'var(--color-border-primary)' }}
        >
          <DialogTitle 
            className="flex items-center gap-3"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <div 
              className="p-2 rounded-lg"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <Package size={20} style={{ color: 'var(--color-primary)' }} />
            </div>
            Packing Entry
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
            Enter box, piece, and meter details for <span 
              className="font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              {productName}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="px-6 pt-4">
          <div 
            className="inline-flex items-center gap-1 p-1 border rounded-lg"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('detailed')}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2"
              style={{
                backgroundColor: activeTab === 'detailed' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'detailed' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                borderRadius: 'var(--radius-md)',
                boxShadow: activeTab === 'detailed' ? '0 10px 15px -3px rgba(59, 130, 246, 0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'detailed') {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'detailed') {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Package size={14} />
              Detailed Entry
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('quick')}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2"
              style={{
                backgroundColor: activeTab === 'quick' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'quick' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                borderRadius: 'var(--radius-md)',
                boxShadow: activeTab === 'quick' ? '0 10px 15px -3px rgba(59, 130, 246, 0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'quick') {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'quick') {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Zap size={14} />
              Quick / Lump Sum
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-4">
            {/* DETAILED ENTRY MODE */}
            {activeTab === 'detailed' && (
              <>
                {/* Boxes Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 
                      className="text-sm font-semibold flex items-center gap-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <Package size={16} style={{ color: 'var(--color-primary)' }} />
                      Boxes
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addBox}
                      className="h-7"
                      style={{
                        borderColor: 'rgba(59, 130, 246, 0.3)',
                        color: 'var(--color-primary)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                        e.currentTarget.style.color = 'var(--color-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--color-primary)';
                      }}
                    >
                      <Plus size={14} className="mr-1" /> Add Box
                    </Button>
                  </div>

                  {boxes.length === 0 ? (
                    <div 
                      className="text-center py-6 text-sm border border-dashed rounded-lg"
                      style={{
                        color: 'var(--color-text-tertiary)',
                        borderColor: 'var(--color-border-primary)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      No boxes added. Click "Add Box" to start.
                    </div>
                  ) : (
                    boxes.map((box) => (
                      <div
                        key={box.box_no}
                        className="border rounded-lg p-4 space-y-3"
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          borderColor: 'var(--color-border-primary)',
                          borderRadius: 'var(--radius-lg)'
                        }}
                      >
                        {/* Box Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-8 h-8 rounded flex items-center justify-center"
                              style={{
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                borderRadius: 'var(--radius-sm)'
                              }}
                            >
                              <span 
                                className="text-sm font-bold"
                                style={{ color: 'var(--color-primary)' }}
                              >
                                #{box.box_no}
                              </span>
                            </div>
                            <span 
                              className="text-sm"
                              style={{ color: 'var(--color-text-secondary)' }}
                            >
                              {box.pieces.length} {box.pieces.length === 1 ? 'Piece' : 'Pieces'} • {box.pieces.reduce((sum, m) => sum + m, 0).toFixed(2)} M
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeBox(box.box_no)}
                            className="h-7 w-7"
                            style={{ color: 'var(--color-error)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--color-error)';
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--color-error)';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
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
                                  <Ruler 
                                    className="absolute left-2 top-1/2 -translate-y-1/2" 
                                    size={14}
                                    style={{ color: 'var(--color-text-tertiary)' }}
                                  />
                                  <Input
                                    ref={el => inputRefs.current[`box-${box.box_no}-piece-${pieceIndex}`] = el}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={meters || ''}
                                    onChange={(e) => updatePiece(box.box_no, pieceIndex, parseFloat(e.target.value) || 0)}
                                    onKeyPress={(e) => handleKeyPress(e, box.box_no, pieceIndex)}
                                    className="pl-7 pr-12 h-8 text-sm"
                                    placeholder="0.00"
                                    style={{
                                      backgroundColor: 'var(--color-bg-card)',
                                      borderColor: 'var(--color-border-secondary)',
                                      color: 'var(--color-text-primary)'
                                    }}
                                    onFocus={(e) => {
                                      e.target.style.borderColor = 'var(--color-primary)';
                                    }}
                                    onBlur={(e) => {
                                      e.target.style.borderColor = 'var(--color-border-secondary)';
                                    }}
                                  />
                                  <span 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                                    style={{ color: 'var(--color-text-tertiary)' }}
                                  >
                                    M
                                  </span>
                                </div>
                                {box.pieces.length > 1 && (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removePieceFromBox(box.box_no, pieceIndex)}
                                    className="h-8 w-8 flex-shrink-0"
                                    style={{ color: 'var(--color-error)' }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = 'var(--color-error)';
                                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = 'var(--color-error)';
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
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
                          className="w-full h-7 text-xs border border-dashed"
                          style={{
                            borderColor: 'var(--color-border-secondary)',
                            color: 'var(--color-text-secondary)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                            e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Plus size={12} className="mr-1" /> Add Piece
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <Separator style={{ backgroundColor: 'var(--color-border-primary)' }} />

                {/* Loose Pieces Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 
                      className="text-sm font-semibold flex items-center gap-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <Layers size={16} style={{ color: 'var(--color-wholesale)' }} />
                      Loose Pieces (No Box)
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addLoosePiece}
                      className="h-7"
                      style={{
                        borderColor: 'rgba(147, 51, 234, 0.3)',
                        color: 'var(--color-wholesale)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.1)';
                        e.currentTarget.style.color = 'var(--color-wholesale)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--color-wholesale)';
                      }}
                    >
                      <Plus size={14} className="mr-1" /> Add Piece
                    </Button>
                  </div>

                  {loosePieces.length === 0 ? (
                    <div 
                      className="text-center py-4 text-xs italic"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Optional: Add pieces sold without a box
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {loosePieces.map((meters, index) => (
                        <div key={index} className="flex items-center gap-1">
                          <div className="relative flex-1">
                            <Ruler 
                              className="absolute left-2 top-1/2 -translate-y-1/2" 
                              size={14}
                              style={{ color: 'var(--color-text-tertiary)' }}
                            />
                            <Input
                              ref={el => inputRefs.current[`loose-piece-${index}`] = el}
                              type="number"
                              step="0.01"
                              min="0"
                              value={meters || ''}
                              onChange={(e) => updateLoosePiece(index, parseFloat(e.target.value) || 0)}
                              onKeyPress={(e) => handleLooseKeyPress(e, index)}
                              className="pl-7 pr-12 h-8 text-sm"
                              placeholder="0.00"
                              style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border-secondary)',
                                color: 'var(--color-text-primary)'
                              }}
                              onFocus={(e) => {
                                e.target.style.borderColor = 'var(--color-wholesale)';
                              }}
                              onBlur={(e) => {
                                e.target.style.borderColor = 'var(--color-border-secondary)';
                              }}
                            />
                            <span 
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                              style={{ color: 'var(--color-text-tertiary)' }}
                            >
                              M
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeLoosePiece(index)}
                            className="h-8 w-8 flex-shrink-0"
                            style={{ color: 'var(--color-error)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--color-error)';
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--color-error)';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
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
                <div 
                  className="border rounded-lg p-6 space-y-6"
                  style={{
                    background: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.05), rgba(147, 51, 234, 0.05))',
                    borderColor: 'rgba(59, 130, 246, 0.2)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <h4 
                    className="text-sm font-semibold flex items-center gap-2"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <Zap size={16} />
                    Quick Entry - Enter Summary Totals
                  </h4>
                  
                  {/* Input 1: Number of Boxes */}
                  <div className="space-y-2">
                    <Label 
                      htmlFor="quick-boxes"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Number of Boxes
                    </Label>
                    <div className="relative">
                      <Package 
                        className="absolute left-3 top-1/2 -translate-y-1/2" 
                        size={18}
                        style={{ color: 'var(--color-text-tertiary)' }}
                      />
                      <Input
                        id="quick-boxes"
                        type="number"
                        step="1"
                        min="0"
                        value={quickBoxes || ''}
                        onChange={(e) => setQuickBoxes(parseInt(e.target.value) || 0)}
                        className="pl-10 h-12 text-lg"
                        placeholder="e.g., 1"
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--color-primary)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--color-border-secondary)';
                        }}
                      />
                    </div>
                  </div>

                  {/* Input 2: Number of Pieces */}
                  <div className="space-y-2">
                    <Label 
                      htmlFor="quick-pieces"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Number of Pieces
                    </Label>
                    <div className="relative">
                      <Layers 
                        className="absolute left-3 top-1/2 -translate-y-1/2" 
                        size={18}
                        style={{ color: 'var(--color-text-tertiary)' }}
                      />
                      <Input
                        id="quick-pieces"
                        type="number"
                        step="1"
                        min="0"
                        value={quickPieces || ''}
                        onChange={(e) => setQuickPieces(parseInt(e.target.value) || 0)}
                        className="pl-10 h-12 text-lg"
                        placeholder="e.g., 15"
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--color-primary)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--color-border-secondary)';
                        }}
                      />
                    </div>
                  </div>

                  {/* Input 3: Total Meters - CRITICAL */}
                  <div className="space-y-2">
                    <Label 
                      htmlFor="quick-meters" 
                      className="flex items-center gap-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Total Meters 
                      <span 
                        className="text-xs px-2 py-0.5 rounded border"
                        style={{
                          color: 'var(--color-warning)',
                          backgroundColor: 'rgba(234, 179, 8, 0.1)',
                          borderColor: 'rgba(234, 179, 8, 0.2)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        ⚡ Critical for Billing
                      </span>
                    </Label>
                    <div className="relative">
                      <Ruler 
                        className="absolute left-3 top-1/2 -translate-y-1/2" 
                        size={18}
                        style={{ color: 'var(--color-success)' }}
                      />
                      <Input
                        id="quick-meters"
                        type="number"
                        step="0.01"
                        min="0"
                        value={quickMeters || ''}
                        onChange={(e) => setQuickMeters(parseFloat(e.target.value) || 0)}
                        className="pl-10 h-14 text-2xl font-bold"
                        placeholder="e.g., 786.6"
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          borderColor: 'rgba(16, 185, 129, 0.5)',
                          color: 'var(--color-text-primary)'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--color-success)';
                          e.target.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.2)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <span 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-lg font-bold"
                        style={{ color: 'var(--color-success)' }}
                      >
                        M
                      </span>
                    </div>
                  </div>

                  {/* Average Calculation Display */}
                  {quickPieces > 0 && quickMeters > 0 && (
                    <div 
                      className="border rounded-lg p-4 mt-4"
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        borderColor: 'var(--color-border-primary)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span 
                          className="text-sm"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Average Meter per Piece:
                        </span>
                        <span 
                          className="text-xl font-bold"
                          style={{ color: 'var(--color-wholesale)' }}
                        >
                          ~{avgMetersPerPiece.toFixed(2)} M
                        </span>
                      </div>
                      <p 
                        className="text-xs mt-2"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Calculated as: {quickMeters.toFixed(2)} M ÷ {quickPieces} pieces
                      </p>
                    </div>
                  )}
                </div>

                {/* Info Box */}
                <div 
                  className="border rounded-lg p-4"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderColor: 'rgba(59, 130, 246, 0.2)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <p 
                    className="text-sm flex items-start gap-2"
                    style={{ color: 'var(--color-primary)' }}
                  >
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
        <div 
          className="border-t px-6 py-4 space-y-4"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-tertiary)'
          }}
        >
          {/* Summary */}
          <div 
            className="grid grid-cols-3 gap-4 p-4 border rounded-lg"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              borderColor: 'rgba(59, 130, 246, 0.2)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div className="text-center">
              <div 
                className="text-xs mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Total Boxes
              </div>
              <div 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-primary)' }}
              >
                {totals.total_boxes}
              </div>
            </div>
            <div className="text-center">
              <div 
                className="text-xs mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Total Pieces
              </div>
              <div 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-wholesale)' }}
              >
                {totals.total_pieces}
              </div>
            </div>
            <div className="text-center">
              <div 
                className="text-xs mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Total Meters
              </div>
              <div 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-success)' }}
              >
                {totals.total_meters.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Info - Only show for detailed mode */}
          {activeTab === 'detailed' && (
            <div 
              className="border rounded-lg p-3"
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                borderColor: 'rgba(234, 179, 8, 0.2)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <p 
                className="text-xs flex items-start gap-2"
                style={{ color: 'var(--color-warning)' }}
              >
                <span className="mt-0.5">💡</span>
                <span>
                  <strong>Tip:</strong> Press <kbd 
                    className="px-1 py-0.5 rounded text-[10px]"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    Enter
                  </kbd> after typing meters to quickly add another piece.
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
              className="flex-1"
              style={{
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-secondary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="flex-1"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                e.currentTarget.style.opacity = '1';
              }}
              disabled={totals.total_meters === 0}
            >
              Save Packing
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
