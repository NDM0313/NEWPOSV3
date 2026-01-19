import React, { useState } from 'react';
import { X, User, Phone, MapPin, Mail } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner";

interface AddSupplierModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (supplier: { id: number; name: string; phone?: string; address?: string; email?: string }) => void;
}

export const AddSupplierModal: React.FC<AddSupplierModalProps> = ({ open, onClose, onSave }) => {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [email, setEmail] = useState("");

    const handleSave = () => {
        if (!name.trim()) {
            toast.error("Supplier name is required");
            return;
        }

        // Generate a new ID (in real app, this would come from backend)
        const newSupplier = {
            id: Date.now(),
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
            email: email.trim(),
        };

        onSave(newSupplier);
        
        // Reset form
        setName("");
        setPhone("");
        setAddress("");
        setEmail("");
        
        toast.success("Supplier added successfully");
    };

    const handleClose = () => {
        setName("");
        setPhone("");
        setAddress("");
        setEmail("");
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />
            
            {/* Modal */}
            <div className="relative bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gray-950/50 border-b border-gray-800">
                    <h3 className="text-lg font-semibold text-white">Add New Supplier</h3>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Name (Required) */}
                    <div className="space-y-2">
                        <Label className="text-orange-400 font-medium text-xs uppercase tracking-wide">
                            Supplier Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter supplier name"
                                className="pl-10 bg-gray-950 border-gray-700 text-white h-10"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSave();
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                        <Label className="text-gray-500 font-medium text-xs uppercase tracking-wide">
                            Phone
                        </Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <Input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Enter phone number"
                                className="pl-10 bg-gray-950 border-gray-700 text-white h-10"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label className="text-gray-500 font-medium text-xs uppercase tracking-wide">
                            Email
                        </Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter email address"
                                className="pl-10 bg-gray-950 border-gray-700 text-white h-10"
                            />
                        </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                        <Label className="text-gray-500 font-medium text-xs uppercase tracking-wide">
                            Address
                        </Label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 text-gray-500" size={16} />
                            <textarea
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Enter address"
                                className="w-full pl-10 pr-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-950/50 border-t border-gray-800">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        className="border-gray-700 text-gray-300 h-10"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="bg-orange-600 hover:bg-orange-500 text-white h-10"
                    >
                        Add Supplier
                    </Button>
                </div>
            </div>
        </div>
    );
};
