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
    <div 
      className="min-h-screen font-sans"
      style={{
        backgroundColor: '#F9FAFB',
        color: '#111827'
      }}
    >
      
      {/* 1. Header (Brand) */}
      <header 
        className="border-b sticky top-0 z-20"
        style={{
          backgroundColor: '#FFFFFF',
          borderBottomColor: '#F3F4F6',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        }}
      >
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack} 
                className="p-2 -ml-2 rounded-full transition-colors"
                style={{ color: '#6B7280' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#000000';
                  e.currentTarget.style.backgroundColor = '#F3F4F6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#6B7280';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div 
              className="h-8 w-8 rounded-lg flex items-center justify-center font-serif font-bold text-lg"
              style={{
                backgroundColor: '#000000',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              D
            </div>
            <div>
              <h1 
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: '#111827' }}
              >
                Din Collection
              </h1>
              <p 
                className="text-[10px] font-medium"
                style={{ color: '#6B7280' }}
              >
                BESPOKE COUTURE
              </p>
            </div>
          </div>
          <div className="text-right">
            <span 
              className="block text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: '#9CA3AF' }}
            >
              Order No
            </span>
            <span 
              className="block text-sm font-bold"
              style={{ color: '#111827' }}
            >
              #{orderData.id.split('-')[1]}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24 space-y-6">
        
        {/* 2. Hero Card */}
        <div 
          className="rounded-2xl p-6 border relative overflow-hidden"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#F3F4F6',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div className="absolute top-0 right-0 p-4" style={{ opacity: 0.05 }}>
            <Package size={120} />
          </div>
          
          <div className="relative z-10">
            <span 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border"
              style={{
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                borderColor: '#DBEAFE',
                borderRadius: 'var(--radius-full)'
              }}
            >
              <span className="relative flex h-2 w-2">
                <span 
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: '#60A5FA' }}
                ></span>
                <span 
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{
                    backgroundColor: '#3B82F6',
                    borderRadius: 'var(--radius-full)'
                  }}
                ></span>
              </span>
              In Stitching Phase
            </span>

            <h2 
              className="text-2xl font-serif font-bold mb-1"
              style={{ color: '#111827' }}
            >
              {orderData.item}
            </h2>
            <p 
              className="text-sm mb-6"
              style={{ color: '#6B7280' }}
            >
              Ordered by {orderData.customer}
            </p>

            <div 
              className="flex items-center gap-4 p-4 rounded-xl border"
              style={{
                backgroundColor: '#F9FAFB',
                borderColor: '#F3F4F6',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div 
                className="h-10 w-10 rounded-full flex items-center justify-center border shadow-sm"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5E7EB',
                  color: '#4B5563',
                  borderRadius: 'var(--radius-full)',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <p 
                  className="text-xs uppercase tracking-wide font-medium"
                  style={{ color: '#6B7280' }}
                >
                  Estimated Delivery
                </p>
                <p 
                  className="text-lg font-bold"
                  style={{ color: '#111827' }}
                >
                  {orderData.estDelivery}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Vertical Timeline */}
        <div 
          className="rounded-2xl p-6 border"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#F3F4F6',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
          }}
        >
          <h3 
            className="text-lg font-bold mb-6"
            style={{ color: '#111827' }}
          >
            Order Journey
          </h3>
          
          <div 
            className="relative pl-4 space-y-8"
            style={{
              position: 'relative'
            }}
          >
            <div 
              className="absolute left-[27px] top-2 bottom-2 w-0.5"
              style={{ backgroundColor: '#F3F4F6' }}
            ></div>
            {orderData.timeline.map((step, index) => {
              const isLast = index === orderData.timeline.length - 1;
              const isCompleted = step.status === 'completed';
              const isActive = step.status === 'active';

              return (
                <div key={step.id} className="relative flex items-start gap-4">
                  {/* Dot/Icon */}
                  <div 
                    className="z-10 h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-500"
                    style={{
                      backgroundColor: isCompleted 
                        ? '#000000' 
                        : isActive 
                        ? '#FFFFFF' 
                        : '#FFFFFF',
                      borderColor: isCompleted 
                        ? '#000000' 
                        : isActive 
                        ? '#3B82F6' 
                        : '#E5E7EB',
                      color: isCompleted 
                        ? '#FFFFFF' 
                        : isActive 
                        ? '#3B82F6' 
                        : '#D1D5DB',
                      borderRadius: 'var(--radius-full)',
                      boxShadow: isActive ? '0 0 0 4px rgba(59, 130, 246, 0.15)' : 'none'
                    }}
                  >
                    {isCompleted ? <CheckCircle2 size={14} /> : 
                     isActive ? <Circle size={10} fill="currentColor" /> :
                     <Circle size={10} />}
                  </div>

                  {/* Content */}
                  <div 
                    className="flex-1 pt-0.5"
                    style={{ opacity: (!isCompleted && !isActive) ? 0.5 : 1 }}
                  >
                    <div className="flex justify-between items-start">
                      <h4 
                        className="font-bold text-sm"
                        style={{
                          color: isActive ? '#2563EB' : '#111827'
                        }}
                      >
                        {step.title}
                      </h4>
                      <span 
                        className="text-xs font-mono"
                        style={{ color: '#6B7280' }}
                      >
                        {step.date}
                      </span>
                    </div>
                    {isActive && (
                      <p 
                        className="text-xs mt-1 font-medium animate-pulse"
                        style={{ color: '#3B82F6' }}
                      >
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
          <h3 
            className="text-sm font-bold uppercase tracking-wider px-1"
            style={{ color: '#111827' }}
          >
            Work in Progress
          </h3>
          <div className="grid grid-cols-2 gap-3">
             <div 
               className="aspect-square rounded-xl overflow-hidden border relative group"
               style={{
                 backgroundColor: '#E5E7EB',
                 borderColor: '#F3F4F6',
                 borderRadius: 'var(--radius-xl)'
               }}
             >
                <img 
                  src="https://images.unsplash.com/photo-1605289982774-9a6fef564df8?auto=format&fit=crop&q=80&w=400" 
                  alt="Fabric Detail" 
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div 
                  className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3"
                >
                   <p 
                     className="text-white text-xs font-medium"
                     style={{ color: '#FFFFFF' }}
                   >
                     Fabric Selection
                   </p>
                </div>
             </div>
             <div 
               className="aspect-square rounded-xl overflow-hidden border relative group"
               style={{
                 backgroundColor: '#E5E7EB',
                 borderColor: '#F3F4F6',
                 borderRadius: 'var(--radius-xl)'
               }}
             >
                <img 
                  src="https://images.unsplash.com/photo-1596473536124-647135540812?auto=format&fit=crop&q=80&w=400" 
                  alt="Stitching Detail" 
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div 
                  className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3"
                >
                   <p 
                     className="text-white text-xs font-medium"
                     style={{ color: '#FFFFFF' }}
                   >
                     Hand Embroidery
                   </p>
                </div>
             </div>
          </div>
        </div>

      </main>

      {/* 5. Footer Actions */}
      <div 
        className="fixed bottom-0 left-0 right-0 border-t p-4 z-20"
        style={{
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F3F4F6',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.05)'
        }}
      >
        <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
          <Button 
            variant="outline"
            className="h-12 font-semibold rounded-xl"
            style={{
              borderColor: '#E5E7EB',
              color: '#374151'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F9FAFB';
              e.currentTarget.style.color = '#000000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#374151';
            }}
            onClick={() => window.open('https://maps.google.com', '_blank')}
          >
            <MapPin className="mr-2 h-4 w-4" />
            Locate Shop
          </Button>
          <Button 
            className="h-12 font-bold rounded-xl"
            style={{
              backgroundColor: '#25D366',
              color: '#FFFFFF',
              boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#128C7E';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#25D366';
            }}
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
