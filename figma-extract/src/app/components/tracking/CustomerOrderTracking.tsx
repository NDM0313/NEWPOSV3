import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  MapPin, 
  MessageCircle, 
  Package, 
  Clock,
  ArrowLeft,
  ShoppingBag
} from 'lucide-react';
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { motion } from "motion/react";

// Mock Tracking Data
const orderData = {
  id: "ORD-8821",
  customer: "Mrs. Saad",
  item: "Red Bridal Lehenga (Custom)",
  estDelivery: "12 Jan, 2025",
  status: "Stitching",
  timeline: [
    { id: 1, title: "Order Booked", date: "01 Jan", status: "completed", icon: ShoppingBag },
    { id: 2, title: "Fabric Sourced", date: "02 Jan", status: "completed", icon: Package },
    { id: 3, title: "Dyeing Process", date: "04 Jan", status: "completed", icon: CheckCircle2 },
    { id: 4, title: "Stitching Phase", date: "In Progress", status: "active", icon: Clock },
    { id: 5, title: "Quality Check", date: "Pending", status: "pending", icon: CheckCircle2 },
    { id: 6, title: "Ready for Pickup", date: "Est. 12 Jan", status: "pending", icon: MapPin },
  ]
};

export const CustomerOrderTracking = ({ onBack }: { onBack?: () => void }) => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-gold-200">
      
      {/* 1. Header (Brand) */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-2 -ml-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="h-8 w-8 bg-black rounded-lg flex items-center justify-center text-white font-serif font-bold text-lg">
              D
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Din Collection</h1>
              <p className="text-[10px] text-gray-500 font-medium">BESPOKE COUTURE</p>
            </div>
          </div>
          <div className="text-right">
            <span className="block text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Order No</span>
            <span className="block text-sm font-bold text-gray-900">#{orderData.id.split('-')[1]}</span>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24 space-y-6">
        
        {/* 2. Hero Card */}
        <div className="bg-white rounded-2xl p-6 shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Package size={120} />
          </div>
          
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider mb-4 border border-blue-100">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              In Stitching Phase
            </span>

            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-1">{orderData.item}</h2>
            <p className="text-gray-500 text-sm mb-6">Ordered by {orderData.customer}</p>

            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-sm text-gray-600">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Estimated Delivery</p>
                <p className="text-lg font-bold text-gray-900">{orderData.estDelivery}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Vertical Timeline */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Order Journey</h3>
          
          <div className="relative pl-4 space-y-8 before:absolute before:left-[27px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
            {orderData.timeline.map((step, index) => {
              const isLast = index === orderData.timeline.length - 1;
              const isCompleted = step.status === 'completed';
              const isActive = step.status === 'active';

              return (
                <div key={step.id} className="relative flex items-start gap-4">
                  {/* Dot/Icon */}
                  <div className={cn(
                    "z-10 h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-500",
                    isCompleted ? "bg-black border-black text-white" : 
                    isActive ? "bg-white border-blue-500 text-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.15)]" : 
                    "bg-white border-gray-200 text-gray-300"
                  )}>
                    {isCompleted ? <CheckCircle2 size={14} /> : 
                     isActive ? <Circle size={10} fill="currentColor" /> :
                     <Circle size={10} />}
                  </div>

                  {/* Content */}
                  <div className={cn("flex-1 pt-0.5", !isCompleted && !isActive && "opacity-50")}>
                    <div className="flex justify-between items-start">
                      <h4 className={cn("font-bold text-sm", isActive ? "text-blue-600" : "text-gray-900")}>
                        {step.title}
                      </h4>
                      <span className="text-xs font-mono text-gray-500">{step.date}</span>
                    </div>
                    {isActive && (
                      <p className="text-xs text-blue-500 mt-1 font-medium animate-pulse">
                        Currently working on this stage...
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Media Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider px-1">Work in Progress</h3>
          <div className="grid grid-cols-2 gap-3">
             <div className="aspect-square bg-gray-200 rounded-xl overflow-hidden border border-gray-100 relative group">
                <img 
                  src="https://images.unsplash.com/photo-1605289982774-9a6fef564df8?auto=format&fit=crop&q=80&w=400" 
                  alt="Fabric Detail" 
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                   <p className="text-white text-xs font-medium">Fabric Selection</p>
                </div>
             </div>
             <div className="aspect-square bg-gray-200 rounded-xl overflow-hidden border border-gray-100 relative group">
                <img 
                  src="https://images.unsplash.com/photo-1596473536124-647135540812?auto=format&fit=crop&q=80&w=400" 
                  alt="Stitching Detail" 
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                   <p className="text-white text-xs font-medium">Hand Embroidery</p>
                </div>
             </div>
          </div>
        </div>

      </main>

      {/* 5. Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
          <Button 
            variant="outline"
            className="h-12 border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-black font-semibold rounded-xl"
            onClick={() => window.open('https://maps.google.com', '_blank')}
          >
            <MapPin className="mr-2 h-4 w-4" />
            Locate Shop
          </Button>
          <Button 
            className="h-12 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold rounded-xl shadow-lg shadow-green-600/20"
            onClick={() => window.open('https://wa.me/', '_blank')}
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Need Help?
          </Button>
        </div>
      </div>

    </div>
  );
};
