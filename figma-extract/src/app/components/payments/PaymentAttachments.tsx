import React, { useRef, useState } from 'react';
import { Upload, File, Image as ImageIcon, FileText, X, Eye, Paperclip, Receipt, CreditCard } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';

export type DocumentType = 'invoice' | 'bank-slip';

export interface PaymentAttachment {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileUrl: string; // In real app, this would be uploaded to server/storage
    uploadedAt: Date;
    documentType: DocumentType; // NEW: Invoice or Bank Slip
}

interface PaymentAttachmentsProps {
    attachments: PaymentAttachment[];
    onAttachmentsChange: (attachments: PaymentAttachment[]) => void;
    disabled?: boolean;
}

export const PaymentAttachments: React.FC<PaymentAttachmentsProps> = ({
    attachments,
    onAttachmentsChange,
    disabled = false
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType>('bank-slip');

    const handleFileSelect = (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const validFiles = Array.from(files).filter(file => {
            // Accept images and PDFs
            const isValid = file.type.startsWith('image/') || file.type === 'application/pdf';
            if (!isValid) {
                toast.error(`${file.name} is not a valid file type. Only images and PDFs are allowed.`);
            }
            return isValid;
        });

        if (validFiles.length === 0) return;

        const newAttachments: PaymentAttachment[] = validFiles.map(file => ({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileUrl: URL.createObjectURL(file), // In real app, upload to server
            uploadedAt: new Date(),
            documentType: selectedDocumentType, // Attach selected type
        }));

        onAttachmentsChange([...attachments, ...newAttachments]);
        toast.success(`${newAttachments.length} file(s) attached as ${selectedDocumentType === 'invoice' ? 'Invoice' : 'Bank Slip'}`);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const handleRemove = (attachmentId: string) => {
        onAttachmentsChange(attachments.filter(a => a.id !== attachmentId));
        toast.success('Attachment removed');
    };

    const handleView = (attachment: PaymentAttachment) => {
        window.open(attachment.fileUrl, '_blank');
    };

    const getFileIcon = (fileType: string) => {
        if (fileType.startsWith('image/')) {
            return <ImageIcon size={16} className="text-blue-400" />;
        } else if (fileType === 'application/pdf') {
            return <FileText size={16} className="text-red-400" />;
        }
        return <File size={16} className="text-gray-400" />;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getDocumentTypeBadge = (docType: DocumentType) => {
        if (docType === 'invoice') {
            return (
                <Badge className="bg-purple-600/20 text-purple-400 border border-purple-600/30 text-[10px] px-1.5 py-0 h-5">
                    <Receipt size={10} className="mr-1" />
                    Invoice
                </Badge>
            );
        } else {
            return (
                <Badge className="bg-green-600/20 text-green-400 border border-green-600/30 text-[10px] px-1.5 py-0 h-5">
                    <CreditCard size={10} className="mr-1" />
                    Bank Slip
                </Badge>
            );
        }
    };

    return (
        <div className="space-y-3">
            {/* Document Type Selector */}
            <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">Document Type</label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setSelectedDocumentType('invoice')}
                        disabled={disabled}
                        className={`
                            px-3 py-2 rounded-lg text-xs font-medium transition-all border
                            ${selectedDocumentType === 'invoice'
                                ? 'bg-purple-600/20 border-purple-600 text-purple-400'
                                : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                            }
                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                    >
                        <Receipt size={14} className="inline mr-1.5" />
                        Invoice
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedDocumentType('bank-slip')}
                        disabled={disabled}
                        className={`
                            px-3 py-2 rounded-lg text-xs font-medium transition-all border
                            ${selectedDocumentType === 'bank-slip'
                                ? 'bg-green-600/20 border-green-600 text-green-400'
                                : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                            }
                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                    >
                        <CreditCard size={14} className="inline mr-1.5" />
                        Bank Slip
                    </button>
                </div>
            </div>

            {/* Upload Area */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !disabled && fileInputRef.current?.click()}
                className={`
                    relative border-2 border-dashed rounded-lg p-4 transition-all cursor-pointer
                    ${isDragging 
                        ? 'border-blue-500 bg-blue-500/10' 
                        : 'border-gray-700 bg-gray-950/50 hover:border-gray-600 hover:bg-gray-950'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                    disabled={disabled}
                />
                <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <div className="p-2 rounded-full bg-gray-800">
                        <Upload size={20} className="text-gray-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">
                            <span className="text-blue-400 font-medium">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                            Images or PDFs (max 10MB each)
                        </p>
                    </div>
                </div>
            </div>

            {/* Attachments List */}
            {attachments.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Paperclip size={12} />
                        <span>{attachments.length} attachment{attachments.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {attachments.map((attachment) => (
                            <div
                                key={attachment.id}
                                className="flex items-center gap-3 bg-gray-950 border border-gray-800 rounded-lg p-2.5 hover:border-gray-700 transition-colors"
                            >
                                {/* File Icon/Thumbnail */}
                                <div className="shrink-0">
                                    {attachment.fileType.startsWith('image/') ? (
                                        <div className="w-10 h-10 rounded bg-gray-900 border border-gray-800 overflow-hidden">
                                            <img
                                                src={attachment.fileUrl}
                                                alt={attachment.fileName}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded bg-gray-900 border border-gray-800 flex items-center justify-center">
                                            {getFileIcon(attachment.fileType)}
                                        </div>
                                    )}
                                </div>

                                {/* File Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-xs text-white font-medium truncate">
                                            {attachment.fileName}
                                        </p>
                                        {getDocumentTypeBadge(attachment.documentType)}
                                    </div>
                                    <p className="text-[10px] text-gray-500">
                                        {formatFileSize(attachment.fileSize)}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleView(attachment);
                                        }}
                                        className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-blue-400 transition-colors"
                                        title="View"
                                    >
                                        <Eye size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemove(attachment.id);
                                        }}
                                        className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-red-400 transition-colors"
                                        title="Remove"
                                        disabled={disabled}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
