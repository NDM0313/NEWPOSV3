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
import { Checkbox } from "../ui/checkbox";
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
  loose_pieces?: number[]; // Loose pieces (without boxes) - for persistence
  total_boxes: number;
  total_pieces: number;
  total_meters: number;
}

// Packing totals - calculated values only (for display and math)
export interface PackingTotals {
  total_boxes: number;
  total_pieces: number;
  total_meters: number;
}

// Packing structure - raw data exactly as entered (SOURCE OF TRUTH)
export interface PackingStructure {
  boxes: PackingBox[];
  loose_pieces: number[];
}

// Return packing details - piece-level selection structure
export interface ReturnedPiece {
  box_no: number;
  piece_no: number;
  meters: number;
}

export interface ReturnPackingDetails {
  returned_pieces: ReturnedPiece[];
  returned_boxes: number; // Count of complete boxes returned
  returned_pieces_count: number; // Total pieces returned
  returned_total_meters: number; // Sum of meters from selected pieces
}

interface PackingEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (details: PackingDetails) => void;
  initialData?: PackingDetails;
  productName?: string;
  // Return mode props
  returnMode?: boolean;
  returnPackingDetails?: ReturnPackingDetails; // Previously selected pieces
  onSaveReturnPacking?: (details: ReturnPackingDetails) => void;
  alreadyReturnedPieces?: Set<string>; // Set of piece keys already returned (format: "box_no-piece_no")
}

export const PackingEntryModal = ({
  open,
  onOpenChange,
  onSave,
  initialData,
  productName = "Product",
  returnMode = false,
  returnPackingDetails,
  onSaveReturnPacking,
  alreadyReturnedPieces = new Set()
}: PackingEntryModalProps) => {
  const [boxes, setBoxes] = useState<PackingBox[]>([]);
  const [loosePieces, setLoosePieces] = useState<number[]>([]); // For direct piece entry without box
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Validation state: track which inputs have errors
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  
  // Tab state: 'detailed' or 'quick' (disabled in return mode)
  const [activeTab, setActiveTab] = useState<'detailed' | 'quick'>('detailed');
  
  // Quick entry state
  const [quickBoxes, setQuickBoxes] = useState<number>(0);
  const [quickPieces, setQuickPieces] = useState<number>(0);
  const [quickMeters, setQuickMeters] = useState<number>(0);
  
  // Return mode: selected pieces state
  const [selectedPieces, setSelectedPieces] = useState<Set<string>>(new Set()); // Format: "box_no-piece_no" or "loose-piece_index"
  
  // Initialize selected pieces from returnPackingDetails when modal opens
  useEffect(() => {
    if (open && returnMode && returnPackingDetails) {
      const pieceKeys = new Set<string>();
      returnPackingDetails.returned_pieces.forEach(piece => {
        pieceKeys.add(`${piece.box_no}-${piece.piece_no}`);
      });
      setSelectedPieces(pieceKeys);
    } else if (open && returnMode && !returnPackingDetails) {
      // New return - start with empty selection
      setSelectedPieces(new Set());
    }
  }, [open, returnMode, returnPackingDetails]);
  
  // Toggle piece selection in return mode
  const togglePieceSelection = (boxNo: number, pieceIndex: number, meters: number) => {
    if (!returnMode) return;
    
    const pieceKey = `${boxNo}-${pieceIndex}`;
    setSelectedPieces(prev => {
      const next = new Set(prev);
      if (next.has(pieceKey)) {
        next.delete(pieceKey);
      } else {
        // Check if piece is already returned
        if (!alreadyReturnedPieces.has(pieceKey)) {
          next.add(pieceKey);
        }
      }
      return next;
    });
  };
  
  // Toggle loose piece selection
  const toggleLoosePieceSelection = (pieceIndex: number) => {
    if (!returnMode) return;
    
    const pieceKey = `loose-${pieceIndex}`;
    setSelectedPieces(prev => {
      const next = new Set(prev);
      if (next.has(pieceKey)) {
        next.delete(pieceKey);
      } else {
        if (!alreadyReturnedPieces.has(pieceKey)) {
          next.add(pieceKey);
        }
      }
      return next;
    });
  };
  
  // Calculate return packing details from selected pieces
  const calculateReturnPackingDetails = (): ReturnPackingDetails => {
    const returnedPieces: ReturnedPiece[] = [];
    let returnedTotalMeters = 0;
    const boxCounts: Map<number, number> = new Map(); // Track pieces per box
    
    // Process boxes
    boxes.forEach(box => {
      let boxPiecesCount = 0;
      box.pieces.forEach((meters, pieceIndex) => {
        const pieceKey = `${box.box_no}-${pieceIndex}`;
        if (selectedPieces.has(pieceKey)) {
          returnedPieces.push({
            box_no: box.box_no,
            piece_no: pieceIndex + 1,
            meters: meters
          });
          returnedTotalMeters += meters;
          boxPiecesCount++;
        }
      });
      if (boxPiecesCount > 0) {
        boxCounts.set(box.box_no, boxPiecesCount);
      }
    });
    
    // Process loose pieces
    loosePieces.forEach((meters, pieceIndex) => {
      const pieceKey = `loose-${pieceIndex}`;
      if (selectedPieces.has(pieceKey)) {
        returnedPieces.push({
          box_no: 0, // 0 indicates loose piece
          piece_no: pieceIndex + 1,
          meters: meters
        });
        returnedTotalMeters += meters;
      }
    });
    
    // Count complete boxes (all pieces in a box are selected)
    let returnedBoxes = 0;
    boxes.forEach(box => {
      const selectedCount = box.pieces.filter((_, pieceIndex) => 
        selectedPieces.has(`${box.box_no}-${pieceIndex}`)
      ).length;
      if (selectedCount === box.pieces.length && box.pieces.length > 0) {
        returnedBoxes++;
      }
    });
    
    return {
      returned_pieces: returnedPieces,
      returned_boxes: returnedBoxes,
      returned_pieces_count: returnedPieces.length,
      returned_total_meters: Math.round(returnedTotalMeters * 100) / 100
    };
  };

  // Reset state when modal opens - Pre-fill with initialData if editing
  // CRITICAL RULE: Load ONLY from packing_details structure, NEVER reconstruct from totals
  useEffect(() => {
    // Clear validation errors when modal opens/closes
    if (!open) {
      setValidationErrors(new Set());
    }
    
    if (open) {
      // DEBUG: Log what we're receiving
      console.log('[PACKING ENTRY MODAL] Modal opened with initialData:', {
        hasInitialData: !!initialData,
        initialData: initialData,
        boxes: initialData?.boxes,
        boxesType: Array.isArray(initialData?.boxes) ? 'array' : typeof initialData?.boxes,
        boxesLength: Array.isArray(initialData?.boxes) ? initialData.boxes.length : 'N/A'
      });
      
      if (initialData) {
        // Edit mode - Pre-fill with existing data
        // STEP 1: Check if detailed structure exists (boxes array with pieces)
        // This is the SOURCE OF TRUTH - if it exists, we MUST use it
        
        // CRITICAL FIX: Check for boxes array more carefully
        // Handle case where packing_details might be a JSON string
        let boxesArray = initialData.boxes;
        if (!boxesArray && typeof initialData === 'object') {
          // Try to find boxes in nested structure
          boxesArray = (initialData as any).boxes || (initialData as any).box || null;
        }
        
        // Also check if initialData itself is a string (JSON)
        if (typeof initialData === 'string') {
          try {
            const parsed = JSON.parse(initialData);
            boxesArray = parsed.boxes || parsed.box || null;
          } catch (e) {
            console.warn('[PACKING ENTRY MODAL] Failed to parse initialData as JSON:', e);
          }
        }
        
        const hasDetailedStructure = boxesArray && Array.isArray(boxesArray) && boxesArray.length > 0;
        
        console.log('[PACKING ENTRY MODAL] Structure check:', {
          hasDetailedStructure,
          boxesArray,
          boxesArrayType: Array.isArray(boxesArray) ? 'array' : typeof boxesArray,
          boxesArrayLength: Array.isArray(boxesArray) ? boxesArray.length : 'N/A'
        });
        
        if (hasDetailedStructure) {
          // DETAILED ENTRY MODE: Structure exists, restore it exactly
          // CRITICAL: Load from structure, NOT from totals
          // All pieces (including 0 values) must be restored exactly as saved
          const restoredBoxes = boxesArray.map((box: any, idx: number) => {
            // Ensure each box has a valid structure
            if (box && typeof box === 'object') {
              const boxNo = typeof box.box_no === 'number' ? box.box_no : (box.boxNo || idx + 1);
              let piecesArray = box.pieces;
              
              // Handle different possible structures
              if (!Array.isArray(piecesArray)) {
                piecesArray = box.piece || box.meters || [];
              }
              
              const pieces = Array.isArray(piecesArray) 
                ? piecesArray.map((p: any, pieceIdx: number) => {
                    const val = typeof p === 'number' ? p : parseFloat(p);
                    const finalVal = isNaN(val) ? 0 : val;
                    // DEBUG: Log each piece value
                    if (pieceIdx < 3) { // Log first 3 pieces
                      console.log(`[PACKING ENTRY MODAL] Restoring piece ${pieceIdx} in box ${idx + 1}:`, {
                        original: p,
                        parsed: val,
                        final: finalVal,
                        type: typeof p
                      });
                    }
                    return finalVal;
                  })
                : [0];
              
              console.log(`[PACKING ENTRY MODAL] Restoring box ${idx + 1}:`, {
                box_no: boxNo,
                pieces: pieces,
                piecesCount: pieces.length,
                piecesValues: pieces.map((p, i) => ({ index: i, value: p })),
                originalBox: box,
                originalPieces: piecesArray
              });
              
              return {
                box_no: boxNo,
                pieces: pieces
              };
            }
            console.warn(`[PACKING ENTRY MODAL] Invalid box structure at index ${idx}:`, box);
            return { box_no: idx + 1, pieces: [0] };
          });
          
          console.log('[PACKING ENTRY MODAL] Restored boxes:', restoredBoxes);
          
          // DEBUG: Log detailed piece values
          restoredBoxes.forEach((box, idx) => {
            console.log(`[PACKING ENTRY MODAL] Restored box ${idx + 1} detailed:`, {
              box_no: box.box_no,
              pieces: box.pieces,
              piecesValues: box.pieces.map((p, i) => ({ index: i, value: p, type: typeof p }))
            });
          });
          
          // CRITICAL FIX: Use functional update to prevent race conditions
          // This ensures the state update uses the latest restored data
          setBoxes(() => {
            console.log('[PACKING ENTRY MODAL] setBoxes functional update called with:', restoredBoxes);
            const finalBoxes = restoredBoxes.length > 0 ? restoredBoxes : [{ box_no: 1, pieces: [0] }];
            console.log('[PACKING ENTRY MODAL] Final boxes being set:', finalBoxes);
            return finalBoxes;
          });
          
          // DEBUG: Verify state was set correctly
          setTimeout(() => {
            console.log('[PACKING ENTRY MODAL] State after setBoxes (async check):', {
              boxesState: restoredBoxes,
              firstBox: restoredBoxes[0],
              firstBoxPieces: restoredBoxes[0]?.pieces,
              firstBoxPiecesValues: restoredBoxes[0]?.pieces?.map((p, i) => ({ index: i, value: p }))
            });
          }, 100);
          
          // Restore loose pieces if they exist in the data structure
          const loosePiecesData = (initialData as any).loose_pieces || (initialData as any).loosePieces || [];
          // Ensure loosePiecesData is an array of numbers (meter values)
          if (Array.isArray(loosePiecesData) && loosePiecesData.length > 0) {
            const restoredLoosePieces = loosePiecesData.map((p: any) => {
              const val = typeof p === 'number' ? p : parseFloat(p);
              return isNaN(val) ? 0 : val;
            });
            console.log('[PACKING ENTRY MODAL] Restored loose pieces:', restoredLoosePieces);
            setLoosePieces(restoredLoosePieces);
          } else {
            setLoosePieces([]);
          }
          // CRITICAL: Always use detailed mode if structure exists
          setActiveTab('detailed');
        } else {
          // QUICK ENTRY MODE (FALLBACK): No structure exists, only totals available
          // This is legacy data or quick entry mode
          // NEVER try to reconstruct structure from totals
          setBoxes([]);
        setLoosePieces([]);
        setQuickBoxes(initialData.total_boxes || 0);
        setQuickPieces(initialData.total_pieces || 0);
        setQuickMeters(initialData.total_meters || 0);
          setActiveTab('quick');
        }
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
  // CRITICAL FIX: Don't add box if we're restoring data (initialData exists)
  useEffect(() => {
    if (open && boxes.length === 0 && loosePieces.length === 0 && activeTab === 'detailed' && !initialData) {
      addBox();
    }
  }, [open, activeTab, initialData]);

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

  // Get packing structure - SOURCE OF TRUTH (exactly as user entered, untouched)
  const getPackingStructure = (): PackingStructure => {
    return {
      boxes: boxes.map(box => ({
        box_no: box.box_no,
        pieces: [...box.pieces] // All pieces, including 0 values
      })),
      loose_pieces: [...loosePieces] // All loose pieces, including 0 values
    };
  };

  // Calculate totals ONLY - accepts structure and returns totals
  // This function does NOT filter or modify structure, only calculates math
  const calculateDetailedTotals = (structure?: PackingStructure): PackingTotals => {
    const packingStructure = structure || getPackingStructure();
    
    // Filter for totals calculation ONLY (does not affect saved structure)
    const validBoxes = packingStructure.boxes.filter(box => 
      box.pieces.some(meters => meters > 0)
    );
    
    const totalBoxes = validBoxes.length;
    
    // Count only pieces with value > 0
    const boxPieces = validBoxes.reduce((sum, box) => 
      sum + box.pieces.filter(meters => meters > 0).length, 0
    );
    
    // Count only loose pieces with value > 0
    const validLoosePieces = packingStructure.loose_pieces.filter(meters => meters > 0);
    const totalPieces = boxPieces + validLoosePieces.length;
    
    // Sum only meters > 0
    const boxMeters = validBoxes.reduce((sum, box) => 
      sum + box.pieces.filter(meters => meters > 0).reduce((pieceSum, meters) => pieceSum + meters, 0), 0
    );
    const looseMeters = validLoosePieces.reduce((sum, meters) => sum + meters, 0);
    const totalMeters = boxMeters + looseMeters;

    // Return ONLY totals (no structure)
    return {
      total_boxes: totalBoxes,
      total_pieces: totalPieces,
      total_meters: parseFloat(totalMeters.toFixed(2))
    };
  };

  // Get quick entry structure (simplified - one virtual box)
  const getQuickPackingStructure = (): PackingStructure => {
    // For quick entry, create a simplified structure
    const virtualBox: PackingBox = {
      box_no: 1,
      pieces: quickMeters > 0 ? [quickMeters] : [] // Single piece representing total meters
    };

    return {
      boxes: quickMeters > 0 ? [virtualBox] : [],
      loose_pieces: []
    };
  };

  // Calculate totals for quick entry
  const calculateQuickTotals = (): PackingTotals => {
    return {
      total_boxes: quickBoxes > 0 ? quickBoxes : 0,
      total_pieces: quickPieces > 0 ? quickPieces : 0,
      total_meters: quickMeters > 0 ? parseFloat(quickMeters.toFixed(2)) : 0
    };
  };

  // Get current packing structure (SOURCE OF TRUTH)
  const currentPackingStructure = activeTab === 'detailed' 
    ? getPackingStructure() 
    : getQuickPackingStructure();

  // Calculate totals (DERIVED - for display only)
  const totals = activeTab === 'detailed' 
    ? calculateDetailedTotals(currentPackingStructure) 
    : calculateQuickTotals();

  // Calculate average meters per piece for quick mode
  const avgMetersPerPiece = quickPieces > 0 ? quickMeters / quickPieces : 0;

  const handleSave = () => {
    if (returnMode && onSaveReturnPacking) {
      // Return mode: save return packing details
      const returnPacking = calculateReturnPackingDetails();
      
      if (returnPacking.returned_pieces.length === 0) {
        // Show error if no pieces selected
        setValidationErrors(prev => new Set(prev).add('no-pieces-selected'));
        setTimeout(() => {
          setValidationErrors(prev => {
            const next = new Set(prev);
            next.delete('no-pieces-selected');
            return next;
          });
        }, 3000);
        return;
      }
      
      console.log('[PACKING ENTRY MODAL] Saving return packing details:', returnPacking);
      onSaveReturnPacking(returnPacking);
    onOpenChange(false);
    } else {
      // Normal mode: save complete structure + calculated totals
      // Structure is SOURCE OF TRUTH, totals are DERIVED
      const packingData: PackingDetails = {
        ...currentPackingStructure, // Full structure (boxes, loose_pieces)
        ...totals // Calculated totals (total_boxes, total_pieces, total_meters)
      };
      
      // DEBUG: Log the complete structure being saved
      console.log('[PACKING ENTRY MODAL] Saving complete structure:', {
        boxes: packingData.boxes,
        loose_pieces: packingData.loose_pieces,
        totals: {
          total_boxes: packingData.total_boxes,
          total_pieces: packingData.total_pieces,
          total_meters: packingData.total_meters
        },
        fullData: packingData
      });
      
      // Verify structure integrity
      if (packingData.boxes && packingData.boxes.length > 0) {
        packingData.boxes.forEach((box, idx) => {
          console.log(`[PACKING ENTRY MODAL] Box ${idx + 1}:`, {
            box_no: box.box_no,
            pieces: box.pieces,
            piecesCount: box.pieces.length
          });
        });
      }
      
      onSave(packingData);
      onOpenChange(false);
    }
  };

  // Validate piece value: must be > 0 and valid number
  const isValidPieceValue = (value: number | string | null | undefined): boolean => {
    if (value === null || value === undefined || value === '') return false;
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    return !isNaN(num) && num > 0;
  };

  const handleKeyPress = (e: React.KeyboardEvent, boxNo: number, pieceIndex: number) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      
      // Get current value from the box
      const box = boxes.find(b => b.box_no === boxNo);
      if (!box) return;
      
      const currentValue = box.pieces[pieceIndex];
      const inputKey = `box-${boxNo}-piece-${pieceIndex}`;
      
      // Validate current value
      if (!isValidPieceValue(currentValue)) {
        // Invalid value: show error, keep focus
        setValidationErrors(prev => new Set(prev).add(inputKey));
        
        // Remove error after 2 seconds
        setTimeout(() => {
          setValidationErrors(prev => {
            const next = new Set(prev);
            next.delete(inputKey);
            return next;
          });
        }, 2000);
        
        // Keep focus on current input
        const currentInput = inputRefs.current[inputKey];
        if (currentInput) {
          currentInput.focus();
          currentInput.select();
        }
        return;
      }
      
      // Valid value: clear error and move to next piece
      setValidationErrors(prev => {
        const next = new Set(prev);
        next.delete(inputKey);
        return next;
      });
      
      // Move to next piece in same box, or add new piece
      const nextPieceIndex = pieceIndex + 1;
      if (nextPieceIndex < box.pieces.length) {
        // Focus next existing piece
        const nextKey = `box-${boxNo}-piece-${nextPieceIndex}`;
        setTimeout(() => {
          inputRefs.current[nextKey]?.focus();
          inputRefs.current[nextKey]?.select();
        }, 50);
      } else {
        // Add new piece and focus it
      addPieceToBox(boxNo);
      }
    }
  };

  const handleLooseKeyPress = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      
      const currentValue = loosePieces[index];
      const inputKey = `loose-piece-${index}`;
      
      // Validate current value
      if (!isValidPieceValue(currentValue)) {
        // Invalid value: show error, keep focus
        setValidationErrors(prev => new Set(prev).add(inputKey));
        
        // Remove error after 2 seconds
        setTimeout(() => {
          setValidationErrors(prev => {
            const next = new Set(prev);
            next.delete(inputKey);
            return next;
          });
        }, 2000);
        
        // Keep focus on current input
        const currentInput = inputRefs.current[inputKey];
        if (currentInput) {
          currentInput.focus();
          currentInput.select();
        }
        return;
      }
      
      // Valid value: clear error and move to next piece
      setValidationErrors(prev => {
        const next = new Set(prev);
        next.delete(inputKey);
        return next;
      });
      
      // Move to next loose piece, or add new one
      const nextIndex = index + 1;
      if (nextIndex < loosePieces.length) {
        // Focus next existing piece
        const nextKey = `loose-piece-${nextIndex}`;
        setTimeout(() => {
          inputRefs.current[nextKey]?.focus();
          inputRefs.current[nextKey]?.select();
        }, 50);
      } else {
        // Add new piece and focus it
      addLoosePiece();
      }
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] bg-gray-900 border-gray-800 text-white max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-800">
          <DialogTitle className="flex items-center gap-3 text-white">
            <div className={cn(
              "p-2 rounded-lg",
              returnMode ? "bg-purple-500/20" : "bg-blue-500/20"
            )}>
              <Package size={20} className={returnMode ? "text-purple-500" : "text-blue-500"} />
            </div>
            <div className="flex items-center gap-2">
              {returnMode ? "RETURN PACKING" : "Packing Entry"}
              {returnMode && (
                <span className="px-2 py-0.5 text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded">
                  RETURN MODE
                </span>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {returnMode ? (
              <>
                Select which pieces to return for <span className="text-purple-400 font-medium">{productName}</span>
                <div className="mt-2 text-xs text-purple-300/70">
                  ✓ Select individual pieces • Original meters preserved • No manual entry
                </div>
              </>
            ) : (
              <>
            Enter box, piece, and meter details for <span className="text-blue-400 font-medium">{productName}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher - Hidden in return mode */}
        {!returnMode && (
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
        )}
        
        {/* Return Mode Summary */}
        {returnMode && (
          <div className="px-6 pt-4">
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Selected:</span>
                <span className="text-purple-400 font-semibold">
                  {calculateReturnPackingDetails().returned_pieces_count} Piece{calculateReturnPackingDetails().returned_pieces_count !== 1 ? 's' : ''} 
                  {calculateReturnPackingDetails().returned_boxes > 0 && ` • ${calculateReturnPackingDetails().returned_boxes} Complete Box${calculateReturnPackingDetails().returned_boxes !== 1 ? 'es' : ''}`}
                  {' • '}
                  {calculateReturnPackingDetails().returned_total_meters.toFixed(2)} M
                </span>
              </div>
            </div>
          </div>
        )}

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
                          {box.pieces.map((meters, pieceIndex) => {
                            // CRITICAL FIX: Handle 0 values properly - don't convert to empty string
                            // If meters is 0, we still want to show 0, not empty
                            // Convert to string for number input (React requirement)
                            const displayValue = (meters !== null && meters !== undefined && meters !== '') 
                              ? String(meters) 
                              : '';
                            
                            // DEBUG: Log what's being rendered (only for first few pieces to avoid spam)
                            if (box.box_no === 1 && pieceIndex < 3) {
                              console.log(`[PACKING ENTRY MODAL] Rendering input box ${box.box_no}, piece ${pieceIndex}:`, {
                                meters,
                                displayValue,
                                metersType: typeof meters,
                                isZero: meters === 0,
                                isEmpty: meters === '' || meters === null || meters === undefined,
                                boxPieces: box.pieces,
                                allPiecesInBox: box.pieces.map((p, i) => ({ index: i, value: p, type: typeof p }))
                              });
                            }
                            
                            const pieceKey = `${box.box_no}-${pieceIndex}`;
                            const isSelected = selectedPieces.has(pieceKey);
                            const isAlreadyReturned = alreadyReturnedPieces.has(pieceKey);
                            const isDisabled = returnMode && isAlreadyReturned;
                            
                            return (
                            <div key={pieceIndex} className={cn(
                              "relative",
                              returnMode && isSelected && "ring-2 ring-purple-500/50 rounded-lg p-1",
                              returnMode && isDisabled && "opacity-50"
                            )}>
                              <div className="flex items-center gap-1">
                                {returnMode && (
                                  <Checkbox
                                    checked={isSelected}
                                    disabled={isDisabled}
                                    onCheckedChange={() => togglePieceSelection(box.box_no, pieceIndex, meters)}
                                    className="h-5 w-5 border-purple-500/50 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                                  />
                                )}
                                <div className="relative flex-1">
                                  <Ruler className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                  <Input
                                    ref={el => inputRefs.current[`box-${box.box_no}-piece-${pieceIndex}`] = el}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={returnMode ? meters.toFixed(2) : displayValue}
                                    onChange={(e) => {
                                      if (returnMode) return; // Read-only in return mode
                                      const newValue = parseFloat(e.target.value) || 0;
                                      updatePiece(box.box_no, pieceIndex, newValue);
                                      
                                      // Clear validation error when user types
                                      const inputKey = `box-${box.box_no}-piece-${pieceIndex}`;
                                      setValidationErrors(prev => {
                                        const next = new Set(prev);
                                        next.delete(inputKey);
                                        return next;
                                      });
                                    }}
                                    onKeyPress={(e) => {
                                      if (!returnMode) handleKeyPress(e, box.box_no, pieceIndex);
                                    }}
                                    disabled={returnMode || isDisabled}
                                    className={cn(
                                      "pl-7 pr-12 h-8 bg-gray-900 text-white text-sm focus:border-blue-500",
                                      returnMode && "cursor-pointer",
                                      validationErrors.has(`box-${box.box_no}-piece-${pieceIndex}`)
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                        : 'border-gray-700',
                                      returnMode && isSelected && "border-purple-500/50 bg-purple-500/5"
                                    )}
                                    placeholder="0.00"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                                    M
                                  </span>
                                </div>
                                {!returnMode && box.pieces.length > 1 && (
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
                              {returnMode && isAlreadyReturned && (
                                <div className="text-xs text-orange-400 mt-0.5">Already returned</div>
                              )}
                            </div>
                            );
                          })}
                        </div>

                        {/* Add Piece to Box - Hidden in return mode */}
                        {!returnMode && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => addPieceToBox(box.box_no)}
                          className="w-full h-7 text-xs border border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/5"
                        >
                          <Plus size={12} className="mr-1" /> Add Piece
                        </Button>
                        )}
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
                    {!returnMode && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addLoosePiece}
                      className="h-7 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                    >
                      <Plus size={14} className="mr-1" /> Add Piece
                    </Button>
                    )}
                  </div>

                  {loosePieces.length === 0 ? (
                    <div className="text-center py-4 text-gray-600 text-xs italic">
                      Optional: Add pieces sold without a box
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {loosePieces.map((meters, index) => {
                        const pieceKey = `loose-${index}`;
                        const isSelected = selectedPieces.has(pieceKey);
                        const isAlreadyReturned = alreadyReturnedPieces.has(pieceKey);
                        const isDisabled = returnMode && isAlreadyReturned;
                        
                        return (
                          <div key={index} className={cn(
                            "flex items-center gap-1",
                            returnMode && isSelected && "ring-2 ring-purple-500/50 rounded-lg p-1",
                            returnMode && isDisabled && "opacity-50"
                          )}>
                            {returnMode && (
                              <Checkbox
                                checked={isSelected}
                                disabled={isDisabled}
                                onCheckedChange={() => toggleLoosePieceSelection(index)}
                                className="h-5 w-5 border-purple-500/50 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                              />
                            )}
                          <div className="relative flex-1">
                            <Ruler className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                            <Input
                              ref={el => inputRefs.current[`loose-piece-${index}`] = el}
                              type="number"
                              step="0.01"
                              min="0"
                                value={returnMode ? (meters || 0).toFixed(2) : (meters || '')}
                                onChange={(e) => {
                                  if (returnMode) return; // Read-only in return mode
                                  const newValue = parseFloat(e.target.value) || 0;
                                  updateLoosePiece(index, newValue);
                                  
                                  // Clear validation error when user types
                                  const inputKey = `loose-piece-${index}`;
                                  setValidationErrors(prev => {
                                    const next = new Set(prev);
                                    next.delete(inputKey);
                                    return next;
                                  });
                                }}
                                onKeyPress={(e) => {
                                  if (!returnMode) handleLooseKeyPress(e, index);
                                }}
                                disabled={returnMode || isDisabled}
                                className={cn(
                                  "pl-7 pr-12 h-8 bg-gray-900 text-white text-sm focus:border-purple-500",
                                  returnMode && "cursor-pointer",
                                  validationErrors.has(`loose-piece-${index}`)
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                    : 'border-gray-700',
                                  returnMode && isSelected && "border-purple-500/50 bg-purple-500/5"
                                )}
                              placeholder="0.00"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                              M
                            </span>
                          </div>
                            {!returnMode && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeLoosePiece(index)}
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20 flex-shrink-0"
                          >
                            <X size={12} />
                          </Button>
                            )}
                            {returnMode && isAlreadyReturned && (
                              <div className="text-xs text-orange-400">Already returned</div>
                            )}
                        </div>
                        );
                      })}
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
                    <strong>Tip:</strong> Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-[10px]">Enter</kbd> after typing a valid meter value (&gt; 0) to move to the next piece. Invalid values (empty or zero) will keep focus on the current field.
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
              className={cn(
                "flex-1 text-white",
                returnMode 
                  ? "bg-purple-600 hover:bg-purple-500" 
                  : "bg-blue-600 hover:bg-blue-500"
              )}
              disabled={returnMode ? selectedPieces.size === 0 : totals.total_meters === 0}
            >
              {returnMode ? "Save Return Packing" : "Save Packing"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};