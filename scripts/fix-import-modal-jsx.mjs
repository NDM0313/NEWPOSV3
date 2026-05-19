import fs from 'fs';
import path from 'path';

const root = path.resolve('src/app/components/products');
const logicPath = path.join(root, '_ImportProductsModal.logic.tsx');
const outPath = path.join(root, 'ImportProductsModal.tsx');

// Read current file, keep everything before "if (!isOpen)"
const current = fs.readFileSync(outPath, 'utf8');
const split = current.indexOf('  if (!isOpen) return null;');
if (split < 0) throw new Error('split not found');
const logic = current.slice(0, split);

const jsx = `  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={handleClose} role="presentation" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl pointer-events-auto max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <motionHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Upload size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Import Products</h2>
                <p className="text-xs text-gray-400">CSV workbench — validate in preview, then import</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </motionHeader>

          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex gap-3">
              <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
              <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                <li><strong>name</strong> required; <strong>selling_price</strong> required.</li>
                <li>Sample template uses example categories — enable auto-create or use your catalog names.</li>
                <li>Variation rows: same name + sku + <strong>variation_name</strong>.</li>
              </ul>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={autoGenerateSku} onChange={(e) => setAutoGenerateSku(e.target.checked)} className="rounded border-gray-600 bg-gray-800 text-blue-500" />
              Auto-generate SKU (Settings → Numbering → Production)
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={autoCreateCatalog} onChange={(e) => setAutoCreateCatalog(e.target.checked)} className="rounded border-gray-600 bg-gray-800 text-blue-500" />
              Create missing categories, units, and brands during import
            </label>

            <div>
              <p className="text-sm font-semibold text-white mb-2">Step 1: Download template</p>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-11 bg-gray-800 border-gray-700 text-white gap-2" onClick={() => downloadTemplate(true)}>
                  <Download size={16} /> Blank template
                </Button>
                <Button type="button" variant="outline" className="flex-1 h-11 bg-gray-800 border-gray-700 text-white gap-2" onClick={() => downloadTemplate(false)}>
                  <Download size={16} /> Sample with examples
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-white mb-2">Step 2: Upload file</p>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileSelect(file);
                }}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 transition-all',
                  isDragging ? 'border-blue-500 bg-blue-500/10' : selectedFile ? 'border-green-500 bg-green-500/10' : 'border-gray-700 bg-gray-800/30'
                )}
              >
                {selectedFile ? (
                  <div className="text-center">
                    <FileText size={32} className="text-green-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-white">{selectedFile.name}</p>
                    <p className="text-xs text-green-400 mt-1">{parsedRows.length} row(s) parsed</p>
                    <button type="button" onClick={() => { setSelectedFile(null); setParsedRows([]); }} className="text-xs text-red-400 mt-2 hover:text-red-300">Remove file</button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload size={32} className="text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-white mb-2">Drag and drop CSV here</p>
                    <label className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg cursor-pointer">
                      Browse
                      <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }} className="hidden" />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {parsedRows.length > 0 && (
              <CsvPreviewDataGrid
                columns={PREVIEW_COLUMNS}
                rows={previewRecords}
                rowErrors={previewRowErrors}
                caption={validatingPreview ? 'Validating rows…' : \`Preview (\${parsedRows.length} row(s)) — fix [E] errors before import\`}
                maxHeightClass="max-h-[min(360px,45vh)]"
              />
            )}

            {summary && (
              <motionSummary>
                <p className="font-semibold text-white text-sm">Summary</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-400">Created: {summary.created}</span>
                  <span className="text-amber-400">Skipped: {summary.skipped}</span>
                  <span className="text-red-400">Failed: {summary.failed}</span>
                </div>
                {summary.errors.length > 0 && (
                  <>
                    <ul className="text-xs text-gray-300 max-h-24 overflow-y-auto space-y-0.5">
                      {summary.errors.slice(0, 8).map((e, i) => (
                        <li key={i}>Row {e.rowIndex}: {e.productName} — {e.message}</li>
                      ))}
                    </ul>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={downloadErrorReport}>
                      <Download size={12} className="mr-1" /> Download error report
                    </Button>
                  </>
                )}
              </motionSummary>
            )}

            {importStatus !== 'idle' && (
              <div className={cn(
                'p-4 rounded-xl border flex items-center gap-3 text-sm',
                importStatus === 'processing' && 'bg-blue-500/10 border-blue-500/30 text-blue-400',
                importStatus === 'success' && 'bg-green-500/10 border-green-500/30 text-green-400',
                importStatus === 'error' && 'bg-red-500/10 border-red-500/30 text-red-400'
              )}>
                {importStatus === 'processing' && <span>Processing import…</span>}
                {importStatus === 'success' && (<><CheckCircle2 size={18} /><span>Imported {importedCount} product(s)</span></>)}
                {importStatus === 'error' && (<><AlertCircle size={18} /><span>{importError ?? 'Import finished with issues'}</span></>)}
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
                disabled={!selectedFile || parsedRows.length === 0 || importStatus === 'processing' || validatingPreview || blockingErrorCount > 0}
                className="h-10 bg-blue-600 hover:bg-blue-500 text-white gap-2 disabled:opacity-50"
              >
                {importStatus === 'processing' ? 'Importing…' : \`Import \${parsedRows.length} Product(s)\`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
`;

// Fix placeholder tags
const fixed = (logic + jsx)
  .replace(/<motionHeader>/g, '<motionHeader>')
  .replace(/<\/motionHeader>/g, '</motionHeader>')
  .replace(/<motionSummary>/g, '<motionSummary>')
  .replace(/<\/motionSummary>/g, '</motionSummary>');

const final = fixed
  .replace(/<motionHeader>/g, '<div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">')
  .replace(/<\/motionHeader>/g, '</div>')
  .replace(/<motionSummary>/g, '<div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-2">')
  .replace(/<\/motionSummary>/g, '</motionSummary>')
  .replace(/<\/motionSummary>/g, '</div>');

fs.writeFileSync(outPath, final);
console.log('Wrote', outPath);
