import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, Download, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useSupabase } from '@/app/context/SupabaseContext';
import { contactService } from '@/app/services/contactService';
import { toast } from 'sonner';

const CONTACT_CSV_COLUMNS: Record<string, string> = {
  name: 'name',
  type: 'type',
  email: 'email',
  phone: 'phone',
  mobile: 'mobile',
  address: 'address',
  city: 'city',
  state: 'state',
  country: 'country',
  notes: 'notes',
  'opening balance': 'opening_balance',
  opening_balance: 'opening_balance',
};

interface ParsedContactRow {
  name: string;
  type: 'customer' | 'supplier' | 'both';
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
  opening_balance?: number;
}

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CONTACT_CSV_TEMPLATE = `name,type,email,phone,address,city,notes
John Customer,customer,john@example.com,0300-1234567,123 Main St,Karachi,Customer since 2024
Jane Supplier,supplier,jane@example.com,0300-7654321,456 Trade Ave,Lahore,Preferred supplier
ABC Trading,both,abc@trading.com,021-1234567,789 Business Rd,Islamabad,Both customer and supplier`;

export const ImportContactsModal = ({ isOpen, onClose, onSuccess }: ImportContactsModalProps) => {
  const { companyId } = useSupabase();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [parsedRows, setParsedRows] = useState<ParsedContactRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setParsedRows([]);
    setImportStatus('idle');
    setImportError(null);
    setImportedCount(0);
  }, []);

  const parseCSV = useCallback((text: string): ParsedContactRow[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const colMap: Record<string, number> = {};
    header.forEach((h, i) => {
      const key = CONTACT_CSV_COLUMNS[h] || h;
      colMap[key] = i;
    });
    const nameIdx = colMap.name ?? header.findIndex((h) => CONTACT_CSV_COLUMNS[h] === 'name');
    const typeIdx = colMap.type ?? header.findIndex((h) => CONTACT_CSV_COLUMNS[h] === 'type');
    if (nameIdx < 0) return [];

    const rows: ParsedContactRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map((c) => c.trim());
      const name = (cells[nameIdx] ?? '').trim();
      if (!name) continue;
      const typeRaw = (cells[typeIdx ?? -1] ?? 'customer').toLowerCase();
      const type: 'customer' | 'supplier' | 'both' =
        typeRaw === 'supplier' ? 'supplier' : typeRaw === 'both' ? 'both' : 'customer';

      rows.push({
        name,
        type,
        email: (cells[colMap.email ?? -1] ?? '').trim() || undefined,
        phone: (cells[colMap.phone ?? -1] ?? '').trim() || undefined,
        mobile: (cells[colMap.mobile ?? -1] ?? '').trim() || undefined,
        address: (cells[colMap.address ?? -1] ?? '').trim() || undefined,
        city: (cells[colMap.city ?? -1] ?? '').trim() || undefined,
        state: (cells[colMap.state ?? -1] ?? '').trim() || undefined,
        country: (cells[colMap.country ?? -1] ?? '').trim() || undefined,
        notes: (cells[colMap.notes ?? -1] ?? '').trim() || undefined,
        opening_balance: parseFloat(cells[colMap.opening_balance ?? -1] ?? '') || undefined,
      });
    }
    return rows;
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? '');
        const rows = parseCSV(text);
        if (rows.length === 0) {
          toast.error('No valid rows found. CSV must have a header row and at least one row with "name" column.');
          return;
        }
        setSelectedFile(file);
        setParsedRows(rows);
      };
      reader.readAsText(file);
    },
    [parseCSV]
  );

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
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CONTACT_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_import_template.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    toast.success('Template downloaded');
  };

  const handleImport = async () => {
    if (!selectedFile || !companyId || parsedRows.length === 0) return;

    setImportStatus('processing');
    setImportError(null);

    try {
      let successCount = 0;
      for (const row of parsedRows) {
        await contactService.createContact({
          company_id: companyId,
          type: row.type,
          name: row.name,
          email: row.email || undefined,
          phone: row.phone || undefined,
          mobile: row.mobile || undefined,
          address: row.address || undefined,
          city: row.city || undefined,
          state: row.state || undefined,
          country: row.country || undefined,
          notes: row.notes || undefined,
          opening_balance: row.opening_balance,
          is_active: true,
        });
        successCount++;
      }

      setImportedCount(successCount);
      setImportStatus('success');
      toast.success(`Imported ${successCount} contact(s) successfully`);
      onSuccess?.();
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      setImportError(msg);
      setImportStatus('error');
      toast.error('Import failed: ' + msg);
    }
  };

  const handleClose = () => {
    onClose();
    resetState();
  };

  if (!isOpen) return null;

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999]" onClick={handleClose} />

      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Upload size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Import Contacts</h2>
                <p className="text-xs text-gray-400 mt-0.5">Upload CSV to bulk import contacts</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-colors flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2">CSV Format</h3>
                  <ul className="text-xs text-gray-300 space-y-1">
                    <li>• <strong>name</strong> (required), <strong>type</strong> (customer / supplier / both)</li>
                    <li>• Optional: email, phone, mobile, address, city, state, country, notes, opening_balance</li>
                    <li>• Download the template below and fill in your data</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-white mb-3 block">Step 1: Download Template</label>
              <Button
                type="button"
                variant="outline"
                className="h-12 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white gap-2"
                onClick={downloadTemplate}
              >
                <Download size={16} />
                Download CSV Template
              </Button>
            </div>

            <div>
              <label className="text-sm font-semibold text-white mb-3 block">Step 2: Upload File</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 transition-all',
                  isDragging ? 'border-blue-500 bg-blue-500/10' : selectedFile ? 'border-green-500 bg-green-500/10' : 'border-gray-700 bg-gray-800/30'
                )}
              >
                {selectedFile ? (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 mx-auto flex items-center justify-center mb-3">
                      <FileText size={32} className="text-green-500" />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400 mb-1">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                    <p className="text-xs text-green-400 mb-3">{parsedRows.length} contact(s) ready to import</p>
                    <button onClick={() => { setSelectedFile(null); setParsedRows([]); }} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-700 mx-auto flex items-center justify-center mb-3">
                      <Upload size={32} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">Drag and drop your CSV here</p>
                    <p className="text-xs text-gray-400 mb-4">or</p>
                    <label className="inline-block">
                      <input type="file" accept=".csv" onChange={handleFileInputChange} className="hidden" />
                      <span className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg cursor-pointer inline-block transition-colors">
                        Browse Files
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-3">Supports: CSV only</p>
                  </div>
                )}
              </div>
            </div>

            {parsedRows.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-700">
                <p className="text-xs text-gray-400 mb-2">Preview (first 10 rows):</p>
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 text-gray-400">Name</th>
                      <th className="text-left px-2 py-1.5 text-gray-400">Type</th>
                      <th className="text-left px-2 py-1.5 text-gray-400">Email</th>
                      <th className="text-left px-2 py-1.5 text-gray-400">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-t border-gray-800">
                        <td className="px-2 py-1.5 text-gray-300">{r.name}</td>
                        <td className="px-2 py-1.5 text-gray-400">{r.type}</td>
                        <td className="px-2 py-1.5 text-gray-400">{r.email || '—'}</td>
                        <td className="px-2 py-1.5 text-gray-400">{r.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 10 && <p className="text-xs text-gray-500 px-2 py-1">+ {parsedRows.length - 10} more</p>}
              </div>
            )}

            {importStatus !== 'idle' && (
              <div
                className={cn(
                  'p-4 rounded-xl border',
                  importStatus === 'processing' && 'bg-blue-500/10 border-blue-500/30',
                  importStatus === 'success' && 'bg-green-500/10 border-green-500/30',
                  importStatus === 'error' && 'bg-red-500/10 border-red-500/30'
                )}
              >
                <div className="flex items-center gap-3">
                  {importStatus === 'processing' && (
                    <>
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-blue-400">Processing import...</span>
                    </>
                  )}
                  {importStatus === 'success' && (
                    <>
                      <CheckCircle2 size={20} className="text-green-500" />
                      <span className="text-sm text-green-400">Imported {importedCount} contact(s) successfully!</span>
                    </>
                  )}
                  {importStatus === 'error' && (
                    <>
                      <AlertCircle size={20} className="text-red-500" />
                      <span className="text-sm text-red-400">{importError || 'Import failed.'}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
            <Button onClick={handleClose} variant="outline" className="h-10 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white">
              {importStatus === 'success' ? 'Close' : 'Cancel'}
            </Button>
            {importStatus !== 'success' && (
              <Button
                onClick={handleImport}
                disabled={!selectedFile || parsedRows.length === 0 || importStatus === 'processing'}
                className="h-10 bg-blue-600 hover:bg-blue-500 text-white gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importStatus === 'processing' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Import {parsedRows.length} Contact(s)
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
};
