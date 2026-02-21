# Backend Integration Example
## Complete Working Code for ERP System Connection

---

## 📁 Step 1: Create API Client

Create file: `/src/api/client.ts`

```typescript
/**
 * API Client for Main Din Collection ERP
 * Handles all HTTP requests to backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
}

class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', headers = {}, body, params } = options;

  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const queryString = new URLSearchParams(params).toString();
    url += `?${queryString}`;
  }

  // Get auth token
  const token = localStorage.getItem('authToken');

  // Build request config
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...headers,
    },
  };

  // Add body for POST/PUT requests
  if (body && (method === 'POST' || method === 'PUT')) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);

    // Handle different response statuses
    if (response.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
      throw new ApiError('Unauthorized', 401, null);
    }

    if (response.status === 403) {
      throw new ApiError('Forbidden - Insufficient permissions', 403, null);
    }

    if (response.status === 404) {
      throw new ApiError('Resource not found', 404, null);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ApiError(
        errorData?.message || 'API request failed',
        response.status,
        errorData
      );
    }

    // Parse JSON response
    const data = await response.json();
    return data;

  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network error or other issues
    console.error('API Request Failed:', error);
    throw new ApiError('Network error or server unavailable', 0, error);
  }
}

// Export convenient methods
export const api = {
  get: <T>(endpoint: string, params?: Record<string, string>) =>
    apiRequest<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, body: any) =>
    apiRequest<T>(endpoint, { method: 'POST', body }),

  put: <T>(endpoint: string, body: any) =>
    apiRequest<T>(endpoint, { method: 'PUT', body }),

  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE' }),
};
```

---

## 📁 Step 2: Create Services

### Authentication Service

Create file: `/src/services/authService.ts`

```typescript
import { api } from '../api/client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'manager' | 'staff' | 'viewer';
  };
}

export const authService = {
  /**
   * Login user and get auth token
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    
    // Store token in localStorage
    localStorage.setItem('authToken', response.token);
    
    return response;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout', {});
    } finally {
      // Always clear local storage
      localStorage.removeItem('authToken');
    }
  },

  /**
   * Get current user profile
   */
  getCurrentUser: async () => {
    return api.get('/auth/me');
  },

  /**
   * Refresh auth token
   */
  refreshToken: async (): Promise<{ token: string }> => {
    return api.post('/auth/refresh', {});
  },
};
```

### Sales Service

Create file: `/src/services/salesService.ts`

```typescript
import { api } from '../api/client';

export interface SaleItem {
  productId: string;
  productName: string;
  variation: {
    size?: string;
    color?: string;
    fabric?: string;
  };
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  saleNumber: string;
  customerId: string;
  customerName: string;
  branchId: string;
  saleType: 'regular' | 'studio';
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'bank' | 'credit';
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  paidAmount: number;
  remainingAmount: number;
  status: 'pending' | 'completed' | 'cancelled';
  notes: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface CreateSaleData {
  customerId: string;
  saleType: 'regular' | 'studio';
  items: SaleItem[];
  paymentMethod: 'cash' | 'bank' | 'credit';
  paidAmount: number;
  notes?: string;
}

export interface SaleFilters {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  status?: string;
  saleType?: string;
}

export const salesService = {
  /**
   * Create new sale
   */
  createSale: async (data: CreateSaleData): Promise<Sale> => {
    return api.post<Sale>('/sales', data);
  },

  /**
   * Get all sales with optional filters
   */
  getSales: async (filters?: SaleFilters): Promise<Sale[]> => {
    return api.get<Sale[]>('/sales', filters as any);
  },

  /**
   * Get single sale by ID
   */
  getSaleById: async (id: string): Promise<Sale> => {
    return api.get<Sale>(`/sales/${id}`);
  },

  /**
   * Update existing sale
   */
  updateSale: async (id: string, data: Partial<Sale>): Promise<Sale> => {
    return api.put<Sale>(`/sales/${id}`, data);
  },

  /**
   * Cancel/Delete sale
   */
  deleteSale: async (id: string): Promise<void> => {
    return api.delete<void>(`/sales/${id}`);
  },

  /**
   * Get sales summary/stats
   */
  getSalesSummary: async (dateFrom?: string, dateTo?: string) => {
    return api.get('/sales/summary', { dateFrom, dateTo } as any);
  },
};
```

### Contacts Service

Create file: `/src/services/contactsService.ts`

```typescript
import { api } from '../api/client';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  roles: ('customer' | 'supplier' | 'worker')[];
  customerDetails?: {
    creditLimit: number;
    outstandingBalance: number;
  };
  supplierDetails?: {
    paymentTerms: string;
    outstandingPayable: number;
  };
  workerDetails?: {
    type: 'Tailor' | 'Cutting Master' | 'Stitching Master' | 'Helper';
    skills: string[];
    dailyRate: number;
  };
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactData {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  roles: ('customer' | 'supplier' | 'worker')[];
  customerDetails?: any;
  supplierDetails?: any;
  workerDetails?: any;
}

export const contactsService = {
  /**
   * Create new contact
   */
  createContact: async (data: CreateContactData): Promise<Contact> => {
    return api.post<Contact>('/contacts', data);
  },

  /**
   * Get all contacts
   */
  getContacts: async (filters?: { role?: string; status?: string }): Promise<Contact[]> => {
    return api.get<Contact[]>('/contacts', filters as any);
  },

  /**
   * Get single contact
   */
  getContactById: async (id: string): Promise<Contact> => {
    return api.get<Contact>(`/contacts/${id}`);
  },

  /**
   * Update contact
   */
  updateContact: async (id: string, data: Partial<Contact>): Promise<Contact> => {
    return api.put<Contact>(`/contacts/${id}`, data);
  },

  /**
   * Delete contact
   */
  deleteContact: async (id: string): Promise<void> => {
    return api.delete<void>(`/contacts/${id}`);
  },

  /**
   * Get contact activity log
   */
  getContactActivity: async (id: string) => {
    return api.get(`/contacts/${id}/activity`);
  },
};
```

### Reports Service

Create file: `/src/services/reportsService.ts`

```typescript
import { api } from '../api/client';

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  customerId?: string;
  workerId?: string;
  accountId?: string;
}

export const reportsService = {
  /**
   * Get sales reports
   */
  getSalesReport: async (filters: ReportFilters) => {
    return api.get('/reports/sales', filters as any);
  },

  /**
   * Get purchase reports
   */
  getPurchaseReport: async (filters: ReportFilters) => {
    return api.get('/reports/purchases', filters as any);
  },

  /**
   * Get worker ledger
   */
  getWorkerLedger: async (workerId: string, filters: ReportFilters) => {
    return api.get(`/reports/workers/${workerId}`, filters as any);
  },

  /**
   * Get account ledger
   */
  getAccountLedger: async (accountId: string, filters: ReportFilters) => {
    return api.get(`/reports/accounts/${accountId}`, filters as any);
  },

  /**
   * Export report as PDF
   */
  exportPDF: async (reportType: string, filters: any) => {
    return api.post('/reports/export-pdf', { reportType, filters });
  },
};
```

---

## 📁 Step 3: Update Components

### Update LoginScreen.tsx

```typescript
import { useState } from 'react';
import { authService } from '../services/authService';

export function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authService.login({ email, password });
      onLogin(response.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
      <form onSubmit={handleLogin} className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6">Login</h1>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-12 px-4 bg-[#1F2937] border border-[#374151] rounded-lg text-white mb-3"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-12 px-4 bg-[#1F2937] border border-[#374151] rounded-lg text-white mb-4"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-[#6366F1] hover:bg-[#5558E3] text-white rounded-lg font-medium disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
```

### Update SalesModule.tsx

```typescript
import { useState, useEffect } from 'react';
import { salesService, Sale } from '../../services/salesService';

export function SalesDashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await salesService.getSales();
      setSales(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSale = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sale?')) return;

    try {
      await salesService.deleteSale(id);
      setSales(sales.filter(s => s.id !== id));
      // Show success toast
    } catch (err: any) {
      alert('Failed to delete sale: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <div className="text-white">Loading sales...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] p-4">
      <h1 className="text-xl font-bold text-white mb-4">Sales Dashboard</h1>
      
      {sales.map(sale => (
        <div key={sale.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-3">
          <div className="flex justify-between">
            <div>
              <p className="text-white font-medium">{sale.saleNumber}</p>
              <p className="text-sm text-[#9CA3AF]">{sale.customerName}</p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold">Rs. {sale.total.toLocaleString()}</p>
              <p className="text-xs text-[#9CA3AF]">{sale.status}</p>
            </div>
          </div>
          
          <button
            onClick={() => handleDeleteSale(sale.id)}
            className="mt-3 px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-sm"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Create Sale with API

```typescript
import { salesService, CreateSaleData } from '../../services/salesService';

const handleSubmitSale = async () => {
  const saleData: CreateSaleData = {
    customerId: selectedCustomer.id,
    saleType: saleType,
    items: items,
    paymentMethod: paymentMethod,
    paidAmount: paidAmount,
    notes: notes,
  };

  setLoading(true);

  try {
    const result = await salesService.createSale(saleData);
    
    // Show success message
    alert(`Sale created successfully! Sale #${result.saleNumber}`);
    
    // Navigate to confirmation or dashboard
    navigateToConfirmation(result);
    
  } catch (error: any) {
    alert('Failed to create sale: ' + error.message);
  } finally {
    setLoading(false);
  }
};
```

---

## 📁 Step 4: Add Environment Variables

Create file: `.env`

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=Main Din Collection ERP
VITE_APP_VERSION=1.0.0
```

For production: `.env.production`

```env
VITE_API_BASE_URL=https://api.yourdomain.com/api
VITE_APP_NAME=Main Din Collection ERP
VITE_APP_VERSION=1.0.0
```

---

## 📁 Step 5: Add Error Handling

Create file: `/src/utils/errorHandler.ts`

```typescript
import { toast } from 'sonner';

export function handleApiError(error: any, customMessage?: string) {
  console.error('API Error:', error);

  let message = customMessage || 'An error occurred';

  if (error.status === 401) {
    message = 'Session expired. Please login again.';
    // Redirect to login
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
  } else if (error.status === 403) {
    message = 'You do not have permission to perform this action.';
  } else if (error.status === 404) {
    message = 'Resource not found.';
  } else if (error.status === 500) {
    message = 'Server error. Please try again later.';
  } else if (error.message) {
    message = error.message;
  }

  toast.error(message);
}
```

Usage in components:

```typescript
import { handleApiError } from '../../utils/errorHandler';

try {
  await salesService.createSale(data);
  toast.success('Sale created successfully!');
} catch (error) {
  handleApiError(error, 'Failed to create sale');
}
```

---

## 📁 Step 6: Add Loading States

Create file: `/src/components/common/LoadingSpinner.tsx`

```typescript
export function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#6366F1] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[#9CA3AF]">Loading...</p>
      </div>
    </div>
  );
}
```

Create file: `/src/components/common/ErrorMessage.tsx`

```typescript
interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
      <div className="bg-red-500/10 border border-red-500 rounded-xl p-6 max-w-md text-center">
        <p className="text-red-500 mb-4">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-red-500 text-white rounded-lg"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## 📁 Step 7: Testing Your Integration

### Test Script

Create file: `/src/tests/apiTest.ts`

```typescript
import { salesService } from '../services/salesService';
import { contactsService } from '../services/contactsService';
import { authService } from '../services/authService';

export async function testAPIs() {
  console.log('🧪 Starting API Tests...\n');

  try {
    // Test Authentication
    console.log('1. Testing Authentication...');
    const authResult = await authService.login({
      email: 'admin@maindin.com',
      password: 'admin123'
    });
    console.log('✅ Login successful:', authResult.user.name);

    // Test Get Sales
    console.log('\n2. Testing Get Sales...');
    const sales = await salesService.getSales();
    console.log(`✅ Retrieved ${sales.length} sales`);

    // Test Get Contacts
    console.log('\n3. Testing Get Contacts...');
    const contacts = await contactsService.getContacts();
    console.log(`✅ Retrieved ${contacts.length} contacts`);

    // Test Create Contact
    console.log('\n4. Testing Create Contact...');
    const newContact = await contactsService.createContact({
      name: 'Test Customer',
      phone: '0300-1234567',
      roles: ['customer'],
    });
    console.log('✅ Contact created:', newContact.id);

    // Test Create Sale
    console.log('\n5. Testing Create Sale...');
    const newSale = await salesService.createSale({
      customerId: newContact.id,
      saleType: 'regular',
      items: [
        {
          productId: 'p1',
          productName: 'Test Product',
          variation: { size: 'M' },
          quantity: 2,
          price: 500,
          subtotal: 1000,
        }
      ],
      paymentMethod: 'cash',
      paidAmount: 1000,
    });
    console.log('✅ Sale created:', newSale.saleNumber);

    console.log('\n🎉 All tests passed!');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run in browser console:
// import { testAPIs } from './tests/apiTest';
// testAPIs();
```

---

## 📁 Step 8: Full Example - Sales Flow

Complete integration example:

```typescript
// File: /src/components/sales/CreateSaleFlow.tsx

import { useState } from 'react';
import { salesService } from '../../services/salesService';
import { contactsService } from '../../services/contactsService';
import { handleApiError } from '../../utils/errorHandler';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { toast } from 'sonner';

export function CreateSaleFlow() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // State
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState(0);

  // Load customers
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await contactsService.getContacts({ role: 'customer' });
      setCustomers(data);
    } catch (error) {
      handleApiError(error, 'Failed to load customers');
    }
  };

  // Submit sale
  const handleSubmit = async () => {
    setLoading(true);

    try {
      const saleData = {
        customerId: selectedCustomer.id,
        saleType: 'regular',
        items: items,
        paymentMethod: paymentMethod,
        paidAmount: paidAmount,
      };

      const result = await salesService.createSale(saleData);
      
      toast.success(`Sale created! #${result.saleNumber}`);
      
      // Navigate to confirmation
      setStep(6);
      
    } catch (error) {
      handleApiError(error, 'Failed to create sale');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // Render steps...
  return (
    <div className="min-h-screen bg-[#111827]">
      {/* Step content */}
    </div>
  );
}
```

---

## ✅ Integration Checklist

### Backend Setup
- [ ] Create database tables
- [ ] Implement authentication endpoints
- [ ] Implement CRUD endpoints for all modules
- [ ] Add validation and error handling
- [ ] Set up CORS
- [ ] Deploy backend server

### Frontend Integration
- [ ] Create API client (`/src/api/client.ts`)
- [ ] Create all service files
- [ ] Update LoginScreen with authService
- [ ] Update all modules to use services
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test all workflows
- [ ] Update environment variables

### Testing
- [ ] Test authentication flow
- [ ] Test sales creation
- [ ] Test contact management
- [ ] Test reports generation
- [ ] Test on mobile device
- [ ] Test on tablet

---

## 🚀 You're Ready!

With this integration example, you can now:

1. ✅ Connect frontend to your backend
2. ✅ Handle authentication
3. ✅ Create, read, update, delete data
4. ✅ Handle errors gracefully
5. ✅ Show loading states
6. ✅ Test the integration

**Next Step**: Start building your backend API! 🎉

---

*Last Updated: February 11, 2026*
