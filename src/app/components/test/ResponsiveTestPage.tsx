/**
 * Responsive test page – tables, drawers, sheets, forms
 * Test Pages > Responsive Test
 */
import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog';

const SAMPLE_ROWS = [
  { id: 1, name: 'Product A', sku: 'SKU-001', price: 1500, qty: 10 },
  { id: 2, name: 'Product B', sku: 'SKU-002', price: 2300, qty: 5 },
  { id: 3, name: 'Product C', sku: 'SKU-003', price: 890, qty: 25 },
];

export function ResponsiveTestPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-white">Responsive Test</h1>
      <p className="text-sm text-gray-400">Tables, sheets, dialogs, forms. Test on mobile.</p>

      {/* 1. Table with horizontal scroll */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-2">Table (overflow-x-auto)</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900/50">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-gray-400">ID</th>
                <th className="px-4 py-3 text-left text-gray-400">Name</th>
                <th className="px-4 py-3 text-left text-gray-400">SKU</th>
                <th className="px-4 py-3 text-right text-gray-400">Price</th>
                <th className="px-4 py-3 text-right text-gray-400">Qty</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.map((r) => (
                <tr key={r.id} className="border-b border-gray-800/50">
                  <td className="px-4 py-3 text-white">{r.id}</td>
                  <td className="px-4 py-3 text-white">{r.name}</td>
                  <td className="px-4 py-3 text-gray-400">{r.sku}</td>
                  <td className="px-4 py-3 text-right text-white">{r.price}</td>
                  <td className="px-4 py-3 text-right text-white">{r.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Form */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-2">Form</h2>
        <div className="space-y-4 max-w-md">
          <div>
            <Label className="text-gray-400">Name</Label>
            <Input className="mt-1 bg-gray-900 border-gray-700 text-white w-full" placeholder="Enter name" />
          </div>
          <div>
            <Label className="text-gray-400">Amount</Label>
            <Input className="mt-1 bg-gray-900 border-gray-700 text-white w-full" type="number" placeholder="0" />
          </div>
          <Button className="w-full sm:w-auto">Save</Button>
        </div>
      </section>

      {/* 3. Sheet (drawer) */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-2">Sheet (drawer)</h2>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline">Open Sheet</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full max-w-full sm:max-w-md bg-gray-900 border-gray-800 text-white flex flex-col">
            <SheetHeader>
              <SheetTitle className="text-white">Details</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-gray-400">Content here. Buttons below.</p>
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-800 shrink-0">
              <Button className="flex-1 sm:flex-none" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button className="flex-1 sm:flex-none">Save</Button>
            </div>
          </SheetContent>
        </Sheet>
      </section>

      {/* 4. Dialog */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-2">Dialog</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-800 text-white w-[95vw] max-w-full sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Confirm</DialogTitle>
            </DialogHeader>
            <p className="text-gray-400">Dialog content. Full width on mobile.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button>OK</Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
