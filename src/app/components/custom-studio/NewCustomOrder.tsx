import React, { useState } from 'react';
import { 
  User, 
  Calendar, 
  Scissors, 
  Save, 
  ArrowLeft,
  Ruler,
  AlertCircle
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { CalendarDatePicker } from "../ui/CalendarDatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";

// Mock Customer Data
const customers = [
  { id: '1', name: 'Mrs. Saad', type: 'Retail', phone: '+92 300 1234567' },
  { id: '2', name: 'Bridal Boutique Lahore', type: 'Wholesale', phone: '+92 321 9876543' },
  { id: '3', name: 'Zara Ahmed', type: 'Retail', phone: '+92 333 5556667' },
  { id: '4', name: 'Karachi Fabrics', type: 'Wholesale', phone: '+92 21 111222333' },
];

export const NewCustomOrder = ({ onBack }: { onBack?: () => void }) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const isWholesale = selectedCustomer?.type === 'Wholesale';

  return (
    <div 
      className="flex flex-col h-full animate-in fade-in duration-300"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)'
      }}
    >
      
      {/* Header */}
      <div 
        className="flex items-center justify-between p-6 border-b"
        style={{
          borderColor: 'var(--color-border-primary)',
          backgroundColor: 'rgba(17, 24, 39, 0.5)'
        }}
      >
        <div className="flex items-center gap-4">
          {onBack && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack}
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              <ArrowLeft size={20} />
            </Button>
          )}
          <div>
            <h1 
              className="text-2xl font-bold flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <Scissors style={{ color: 'var(--color-primary)' }} />
              New Custom Order
            </h1>
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Create a new bespoke or wholesale order.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            style={{
              borderColor: 'var(--color-border-secondary)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </Button>
          <Button 
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)',
              boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
            }}
          >
            <Save className="mr-2 h-4 w-4" /> Create Order
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Customer Selection Card */}
          <Card 
            style={{
              backgroundColor: 'rgba(31, 41, 55, 0.5)',
              borderColor: 'var(--color-border-primary)'
            }}
          >
            <CardHeader>
              <CardTitle 
                className="text-lg font-semibold flex items-center justify-between"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <span>Customer Details</span>
                {isWholesale && (
                  <Badge 
                    variant="secondary"
                    style={{
                      backgroundColor: 'rgba(168, 85, 247, 0.2)',
                      color: 'var(--color-wholesale)',
                      borderColor: 'rgba(168, 85, 247, 0.3)'
                    }}
                  >
                    [Wholesale Order]
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Select Customer</Label>
                  <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                    <SelectTrigger 
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        borderColor: 'var(--color-border-secondary)',
                        color: 'var(--color-text-primary)'
                      }}
                    >
                      <SelectValue placeholder="Search customer..." />
                    </SelectTrigger>
                    <SelectContent 
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderColor: 'var(--color-border-primary)',
                        color: 'var(--color-text-primary)'
                      }}
                    >
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center justify-between w-full gap-2">
                            <span>{c.name}</span>
                            <span 
                              className="text-xs ml-2"
                              style={{ color: 'var(--color-text-tertiary)' }}
                            >
                              ({c.type})
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isWholesale && (
                    <div 
                      className="flex items-center gap-2 text-xs p-2 rounded border mt-2"
                      style={{
                        color: 'var(--color-wholesale)',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        borderColor: 'rgba(168, 85, 247, 0.2)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <AlertCircle size={14} />
                      Bulk pricing rules will be applied for this order.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Due Date</Label>
                  <CalendarDatePicker 
                    className="[&::-webkit-calendar-picker-indicator]:invert"
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Details Card */}
          <Card 
            style={{
              backgroundColor: 'rgba(31, 41, 55, 0.5)',
              borderColor: 'var(--color-border-primary)'
            }}
          >
            <CardHeader>
              <CardTitle 
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Order Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Item Name</Label>
                  <Input 
                    placeholder="e.g. Red Bridal Lehenga"
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Design Reference (SKU)</Label>
                  <Input 
                    placeholder="Optional"
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label style={{ color: 'var(--color-text-secondary)' }}>Measurements / Notes</Label>
                <div className="relative">
                  <Textarea 
                    placeholder="Enter specific measurements or customization notes..."
                    className="min-h-[120px]"
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  <Ruler 
                    className="absolute right-3 top-3 h-5 w-5"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};