import { useState } from 'react';
import { User } from '../../App';
import { SalesHome } from './SalesHome';
import { SelectCustomer } from './SelectCustomer';
import { AddProducts } from './AddProducts';
import { SaleSummary } from './SaleSummary';
import { PaymentDialog } from './PaymentDialog';
import { SaleConfirmation } from './SaleConfirmation';

type SalesStep = 'home' | 'customer' | 'products' | 'summary' | 'payment' | 'confirmation';

interface SalesModuleProps {
  onBack: () => void;
  user: User;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  variation?: string;
  total: number;
  packingData?: {
    boxes: Array<{ id: string; pieces: Array<{ id: string; quantity: number }> }>;
    loosePieces: Array<{ id: string; quantity: number }>;
    totalQuantity: number;
    pieceCount?: number; // For lumpsum mode
  };
}

export interface SaleData {
  customer: Customer | null;
  products: Product[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  notes: string;
  saleType: 'regular' | 'studio'; // Sale Type
}

export function SalesModule({ onBack, user }: SalesModuleProps) {
  const [step, setStep] = useState<SalesStep>('home');
  const [saleData, setSaleData] = useState<SaleData>({
    customer: null,
    products: [],
    subtotal: 0,
    discount: 0,
    shipping: 0,
    tax: 0,
    total: 0,
    notes: '',
    saleType: 'regular', // Default Sale Type
  });
  const [paymentComplete, setPaymentComplete] = useState(false);

  const handleStepBack = () => {
    switch (step) {
      case 'customer':
        setStep('home');
        break;
      case 'products':
        setStep('customer');
        break;
      case 'summary':
        setStep('products');
        break;
      case 'payment':
        setStep('summary');
        break;
      case 'confirmation':
        setStep('home');
        break;
      default:
        onBack();
    }
  };

  const handleNewSale = () => {
    setStep('customer');
  };

  const handleCustomerSelect = (customer: Customer, saleType: 'regular' | 'studio') => {
    setSaleData({ ...saleData, customer, saleType });
    setStep('products');
  };

  const handleProductsUpdate = (products: Product[]) => {
    const subtotal = products.reduce((sum, p) => sum + p.total, 0);
    const total = subtotal - saleData.discount + saleData.shipping + saleData.tax;
    setSaleData({ ...saleData, products, subtotal, total });
  };

  const handleNextToSummary = () => {
    setStep('summary');
  };

  const handleSummaryUpdate = (data: Partial<SaleData>) => {
    const newData = { ...saleData, ...data };
    const total = newData.subtotal - newData.discount + newData.shipping + newData.tax;
    setSaleData({ ...newData, total });
  };

  const handleProceedToPayment = () => {
    setStep('payment');
  };

  const handlePaymentComplete = () => {
    setPaymentComplete(true);
    setStep('confirmation');
  };

  const handleNewSaleFromConfirmation = () => {
    setSaleData({
      customer: null,
      products: [],
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
      notes: '',
      saleType: 'regular', // Reset Sale Type
    });
    setPaymentComplete(false);
    setStep('customer');
  };

  const handleBackToHome = () => {
    setSaleData({
      customer: null,
      products: [],
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
      notes: '',
      saleType: 'regular', // Reset Sale Type
    });
    setPaymentComplete(false);
    onBack();
  };

  return (
    <>
      {step === 'home' && (
        <SalesHome onBack={onBack} onNewSale={handleNewSale} />
      )}

      {step === 'customer' && (
        <SelectCustomer 
          onBack={handleStepBack} 
          onSelect={handleCustomerSelect}
        />
      )}

      {step === 'products' && (
        <AddProducts
          onBack={handleStepBack}
          customer={saleData.customer!}
          initialProducts={saleData.products}
          onProductsUpdate={handleProductsUpdate}
          onNext={handleNextToSummary}
        />
      )}

      {step === 'summary' && (
        <SaleSummary
          onBack={handleStepBack}
          saleData={saleData}
          onUpdate={handleSummaryUpdate}
          onProceedToPayment={handleProceedToPayment}
        />
      )}

      {step === 'payment' && (
        <PaymentDialog
          onBack={handleStepBack}
          totalAmount={saleData.total}
          onComplete={handlePaymentComplete}
        />
      )}

      {step === 'confirmation' && (
        <SaleConfirmation
          saleData={saleData}
          onNewSale={handleNewSaleFromConfirmation}
          onBackToHome={handleBackToHome}
        />
      )}
    </>
  );
}