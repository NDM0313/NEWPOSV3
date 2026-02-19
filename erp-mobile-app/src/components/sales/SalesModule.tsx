import { useState } from 'react';
import type { User } from '../../types';
import { SalesHome } from './SalesHome';
import { SelectCustomer } from './SelectCustomer';
import { AddProducts } from './AddProducts';
import { SaleSummary } from './SaleSummary';
import { PaymentDialog } from './PaymentDialog';
import { SaleConfirmation } from './SaleConfirmation';

export type SalesStep = 'home' | 'customer' | 'products' | 'summary' | 'payment' | 'confirmation';

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
  saleType: 'regular' | 'studio';
}

interface SalesModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
}

export function SalesModule({ onBack, user: _user, companyId }: SalesModuleProps) {
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
    saleType: 'regular',
  });

  const handleStepBack = () => {
    if (step === 'customer') setStep('home');
    else if (step === 'products') setStep('customer');
    else if (step === 'summary') setStep('products');
    else if (step === 'payment') setStep('summary');
    else if (step === 'confirmation') setStep('home');
    else onBack();
  };

  const handleNewSale = () => setStep('customer');
  const handleCustomerSelect = (customer: Customer, saleType: 'regular' | 'studio') => {
    setSaleData((prev) => ({ ...prev, customer, saleType }));
    setStep('products');
  };
  const handleProductsUpdate = (products: Product[]) => {
    const subtotal = products.reduce((sum, p) => sum + p.total, 0);
    setSaleData((prev) => ({ ...prev, products, subtotal, total: subtotal - prev.discount + prev.shipping + prev.tax }));
  };
  const handleNextToSummary = () => setStep('summary');
  const handleSummaryUpdate = (data: Partial<SaleData>) => {
    setSaleData((prev) => {
      const next = { ...prev, ...data };
      next.total = next.subtotal - next.discount + next.shipping + next.tax;
      return next;
    });
  };
  const handleProceedToPayment = () => setStep('payment');
  const handlePaymentComplete = () => setStep('confirmation');
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
      saleType: 'regular',
    });
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
      saleType: 'regular',
    });
    onBack();
  };

  if (step === 'home') return <SalesHome onBack={onBack} onNewSale={handleNewSale} />;
  if (step === 'customer') return <SelectCustomer companyId={companyId} onBack={handleStepBack} onSelect={handleCustomerSelect} />;
  if (step === 'products' && saleData.customer)
    return (
      <AddProducts
        companyId={companyId}
        onBack={handleStepBack}
        customer={saleData.customer}
        initialProducts={saleData.products}
        onProductsUpdate={handleProductsUpdate}
        onNext={handleNextToSummary}
      />
    );
  if (step === 'summary') return <SaleSummary onBack={handleStepBack} saleData={saleData} onUpdate={handleSummaryUpdate} onProceedToPayment={handleProceedToPayment} />;
  if (step === 'payment') return <PaymentDialog onBack={handleStepBack} totalAmount={saleData.total} onComplete={handlePaymentComplete} />;
  if (step === 'confirmation') return <SaleConfirmation saleData={saleData} onNewSale={handleNewSaleFromConfirmation} onBackToHome={handleBackToHome} />;
  return null;
}
