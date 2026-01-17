import React, { useState } from "react";
import { Plus, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";

interface QuickAddItem {
  value: string;
  label: string;
}

interface QuickAddDropdownProps {
  placeholder: string;
  items: QuickAddItem[];
  onAddNew: (name: string) => void;
  addNewLabel: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const QuickAddDropdown = ({
  placeholder,
  items,
  onAddNew,
  addNewLabel,
  value,
  onValueChange,
}: QuickAddDropdownProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  const handleAddNew = () => {
    if (newItemName.trim()) {
      onAddNew(newItemName);
      setNewItemName("");
      setIsModalOpen(false);
    }
  };

  const handleOpenAddModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSelectOpen(false);
    setTimeout(() => {
      setIsModalOpen(true);
    }, 100);
  };

  return (
    <>
      <Select value={value} onValueChange={onValueChange} open={isSelectOpen} onOpenChange={setIsSelectOpen}>
        <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-gray-900 border-gray-800 text-white">
          {/* Regular items */}
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}

          {/* Divider */}
          <div className="h-px bg-gray-700 my-2 mx-2" />

          {/* Add New Button */}
          <button
            onClick={handleOpenAddModal}
            className="w-full flex items-center gap-2 px-2 py-2.5 text-blue-500 hover:bg-gray-800 transition-colors rounded-sm cursor-pointer"
          >
            <Plus size={16} />
            <span className="font-medium">{addNewLabel}</span>
          </button>
        </SelectContent>
      </Select>

      {/* Quick Add Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[400px] bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{addNewLabel}</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter the name and save to add it to the list.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="new-item" className="text-gray-200">
              Name *
            </Label>
            <Input
              id="new-item"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Enter name..."
              className="bg-gray-800 border-gray-700 text-white mt-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNew();
                }
              }}
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsModalOpen(false);
                setNewItemName("");
              }}
              className="text-gray-400 hover:text-white hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddNew}
              disabled={!newItemName.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
            >
              <Check size={16} />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};