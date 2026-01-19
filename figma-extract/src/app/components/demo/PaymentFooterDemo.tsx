import React from "react";
import { PaymentFooterWidget } from "../transactions/PaymentFooterWidget";
import { ArrowLeft, ShoppingCart, Package } from "lucide-react";
import { Button } from "../ui/button";

export function PaymentFooterDemo() {
  return (
    <div className="min-h-screen bg-[#111827] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Payment Footer Widget</h1>
            <p className="text-sm text-gray-400">
              Modern payment interface with visual method selector
            </p>
          </div>
        </div>

        {/* Sale Invoice Demo */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white">
            <ShoppingCart className="size-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Sale Invoice</h2>
          </div>

          {/* Mock Invoice Summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-white font-medium">Rs 85,000</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Tax (5%)</span>
                <span className="text-white font-medium">Rs 4,250</span>
              </div>
              <div className="border-t border-gray-700 pt-3 flex justify-between">
                <span className="text-white font-semibold">Total Amount</span>
                <span className="text-2xl font-bold text-blue-500">
                  Rs 89,250
                </span>
              </div>
            </div>
          </div>

          {/* Payment Footer for Sale */}
          <PaymentFooterWidget transactionType="sale" />
        </div>

        {/* Purchase Invoice Demo */}
        <div className="space-y-4 mt-12">
          <div className="flex items-center gap-2 text-white">
            <Package className="size-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Purchase Invoice</h2>
          </div>

          {/* Mock Invoice Summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-white font-medium">Rs 125,000</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Discount</span>
                <span className="text-green-500 font-medium">- Rs 5,000</span>
              </div>
              <div className="border-t border-gray-700 pt-3 flex justify-between">
                <span className="text-white font-semibold">Total Amount</span>
                <span className="text-2xl font-bold text-orange-500">
                  Rs 120,000
                </span>
              </div>
            </div>
          </div>

          {/* Payment Footer for Purchase */}
          <PaymentFooterWidget transactionType="purchase" />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-6 border-t border-gray-800">
          <Button variant="outline" className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
            Save Draft
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            Complete Transaction
          </Button>
        </div>
      </div>
    </div>
  );
}
