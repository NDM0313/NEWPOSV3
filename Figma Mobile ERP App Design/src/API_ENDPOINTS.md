# 🔌 API ENDPOINTS DOCUMENTATION
## Main Din Collection Mobile ERP - Backend Integration

---

## 📋 BASE CONFIGURATION

```
Base URL: https://api.maindincollection.com
API Version: /api/v1
Authentication: Bearer Token (JWT)
Content-Type: application/json
```

---

## 🔐 AUTHENTICATION ENDPOINTS

### 1. Login
```http
POST /api/v1/auth/login
Content-Type: application/json

Request Body:
{
  "username": "admin",
  "password": "password123",
  "branchId": "branch-001" // Optional
}

Response (200 OK):
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "user-001",
      "username": "admin",
      "name": "Admin User",
      "email": "admin@maindincollection.com",
      "role": "Admin",
      "permissions": ["sales.create", "sales.view", "reports.view"],
      "branch": {
        "id": "branch-001",
        "name": "Main Branch",
        "code": "MB-001"
      }
    }
  }
}

Error (401 Unauthorized):
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password"
  }
}
```

### 2. Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 3. Get Current User
```http
GET /api/v1/auth/me
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "id": "user-001",
    "username": "admin",
    "name": "Admin User",
    "email": "admin@maindincollection.com",
    "role": "Admin",
    "permissions": ["sales.create", "sales.view"],
    "branch": { ... }
  }
}
```

### 4. Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

Request Body:
{
  "refreshToken": "refresh_token_here"
}

Response (200 OK):
{
  "success": true,
  "data": {
    "token": "new_access_token",
    "refreshToken": "new_refresh_token"
  }
}
```

---

## 👥 CUSTOMERS ENDPOINTS

### 1. Get All Customers
```http
GET /api/v1/customers
Authorization: Bearer {token}
Query Parameters: ?search=Ahmed&limit=20&offset=0&sortBy=name&order=asc

Response (200 OK):
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "cust-001",
        "name": "Ahmed Retailers",
        "phone": "+92-300-1234567",
        "email": "ahmed@example.com",
        "address": "Karachi, Pakistan",
        "balance": 5000,
        "createdAt": "2026-01-15T10:30:00Z",
        "updatedAt": "2026-02-10T14:20:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### 2. Create Customer
```http
POST /api/v1/customers
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "name": "New Customer",
  "phone": "+92-300-9999999",
  "email": "customer@example.com",
  "address": "Address here"
}

Response (201 Created):
{
  "success": true,
  "data": {
    "id": "cust-002",
    "name": "New Customer",
    "phone": "+92-300-9999999",
    "email": "customer@example.com",
    "address": "Address here",
    "balance": 0,
    "createdAt": "2026-02-13T10:00:00Z"
  }
}
```

### 3. Get Customer by ID
```http
GET /api/v1/customers/{id}
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "id": "cust-001",
    "name": "Ahmed Retailers",
    "phone": "+92-300-1234567",
    "balance": 5000,
    "recentOrders": [...],
    "totalOrders": 45,
    "totalPurchases": 250000
  }
}
```

### 4. Update Customer
```http
PUT /api/v1/customers/{id}
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "name": "Updated Name",
  "phone": "+92-300-1234567"
}

Response (200 OK):
{
  "success": true,
  "data": { ... updated customer ... }
}
```

---

## 🛒 SALES ENDPOINTS

### 1. Get All Sales Orders
```http
GET /api/v1/sales/orders
Authorization: Bearer {token}
Query Parameters: ?status=completed&startDate=2026-01-01&endDate=2026-02-13&customerId=cust-001

Response (200 OK):
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "sale-001",
        "orderNumber": "SO-2026-0001",
        "type": "regular", // or "studio"
        "customer": {
          "id": "cust-001",
          "name": "Ahmed Retailers",
          "phone": "+92-300-1234567"
        },
        "items": [
          {
            "id": "item-001",
            "product": {
              "id": "prod-001",
              "name": "Cotton Fabric",
              "sku": "FAB-001"
            },
            "quantity": 10,
            "rate": 500,
            "total": 5000
          }
        ],
        "subtotal": 5000,
        "discount": 500,
        "total": 4500,
        "paid": 4500,
        "due": 0,
        "status": "completed",
        "paymentMethod": "cash",
        "notes": "Urgent order",
        "createdBy": {
          "id": "user-001",
          "name": "Admin User"
        },
        "createdAt": "2026-02-13T10:00:00Z",
        "completedAt": "2026-02-13T10:30:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

### 2. Create Sale Order
```http
POST /api/v1/sales/orders
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "type": "regular",
  "customerId": "cust-001",
  "items": [
    {
      "productId": "prod-001",
      "quantity": 10,
      "rate": 500,
      "variation": "White",
      "packing": {
        "bags": 2,
        "itemsPerBag": 5
      }
    }
  ],
  "discount": 500,
  "payment": {
    "amount": 4500,
    "method": "cash",
    "accountId": "acc-cash-001"
  },
  "notes": "Urgent order",
  "branchId": "branch-001"
}

Response (201 Created):
{
  "success": true,
  "data": {
    "id": "sale-002",
    "orderNumber": "SO-2026-0002",
    "customer": { ... },
    "items": [ ... ],
    "total": 4500,
    "status": "completed",
    "accountingEntries": [
      {
        "id": "entry-001",
        "debit": { "account": "Cash", "amount": 4500 },
        "credit": { "account": "Sales", "amount": 4500 }
      }
    ]
  }
}
```

### 3. Get Sale Order by ID
```http
GET /api/v1/sales/orders/{id}
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "id": "sale-001",
    "orderNumber": "SO-2026-0001",
    "customer": { ... },
    "items": [ ... ],
    "timeline": [
      {
        "status": "created",
        "timestamp": "2026-02-13T10:00:00Z",
        "user": "Admin User"
      },
      {
        "status": "completed",
        "timestamp": "2026-02-13T10:30:00Z",
        "user": "Admin User"
      }
    ]
  }
}
```

---

## 📦 PRODUCTS ENDPOINTS

### 1. Get All Products
```http
GET /api/v1/products
Authorization: Bearer {token}
Query Parameters: ?search=fabric&category=fabrics&inStock=true

Response (200 OK):
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod-001",
        "name": "Cotton Fabric",
        "sku": "FAB-001",
        "barcode": "1234567890123",
        "category": "Fabrics",
        "unit": "Meter",
        "costPrice": 450,
        "wholesalePrice": 500,
        "retailPrice": 550,
        "stock": 100,
        "minStock": 20,
        "variations": ["White", "Black", "Blue"],
        "images": [
          "https://cdn.maindincollection.com/products/fab-001-1.jpg",
          "https://cdn.maindincollection.com/products/fab-001-2.jpg"
        ],
        "description": "High quality cotton fabric",
        "isActive": true,
        "createdAt": "2026-01-01T00:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

### 2. Create Product
```http
POST /api/v1/products
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "name": "Silk Fabric",
  "sku": "FAB-002",
  "category": "Fabrics",
  "unit": "Meter",
  "costPrice": 1100,
  "wholesalePrice": 1200,
  "retailPrice": 1300,
  "stock": 50,
  "minStock": 10,
  "variations": ["Red", "Blue"],
  "images": [
    "https://cdn.maindincollection.com/products/fab-002-1.jpg"
  ],
  "description": "Premium silk fabric"
}

Response (201 Created):
{
  "success": true,
  "data": { ... created product ... }
}
```

### 3. Update Stock
```http
PATCH /api/v1/products/{id}/stock
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "quantity": 20,
  "operation": "add", // or "subtract" or "set"
  "reason": "Purchase Order PO-001",
  "notes": "Stock replenishment"
}

Response (200 OK):
{
  "success": true,
  "data": {
    "id": "prod-001",
    "previousStock": 100,
    "newStock": 120,
    "stockHistory": [ ... ]
  }
}
```

---

## 🏢 SUPPLIERS ENDPOINTS

### 1. Get All Suppliers
```http
GET /api/v1/suppliers
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "suppliers": [
      {
        "id": "supp-001",
        "name": "ABC Textiles",
        "phone": "+92-300-1111111",
        "email": "abc@textiles.com",
        "address": "Karachi",
        "balance": 50000, // Amount we owe them
        "createdAt": "2026-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

## 🛍️ PURCHASE ENDPOINTS

### 1. Get All Purchase Orders
```http
GET /api/v1/purchases/orders
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "purchase-001",
        "orderNumber": "PO-2026-0001",
        "supplier": {
          "id": "supp-001",
          "name": "ABC Textiles",
          "phone": "+92-300-1111111"
        },
        "items": [ ... ],
        "total": 100000,
        "paid": 50000,
        "due": 50000,
        "status": "partial",
        "createdAt": "2026-02-10T10:00:00Z"
      }
    ]
  }
}
```

### 2. Create Purchase Order
```http
POST /api/v1/purchases/orders
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "supplierId": "supp-001",
  "items": [
    {
      "productId": "prod-001",
      "quantity": 100,
      "rate": 450
    }
  ],
  "discount": 0,
  "payment": {
    "amount": 45000,
    "method": "bank",
    "accountId": "acc-bank-001"
  },
  "notes": "Bulk order"
}

Response (201 Created):
{
  "success": true,
  "data": {
    "id": "purchase-002",
    "orderNumber": "PO-2026-0002",
    "supplier": { ... },
    "items": [ ... ],
    "total": 45000,
    "accountingEntries": [ ... ]
  }
}
```

---

## 👗 RENTAL ENDPOINTS

### 1. Get All Rentals
```http
GET /api/v1/rentals
Authorization: Bearer {token}
Query Parameters: ?status=active&customerId=cust-001

Response (200 OK):
{
  "success": true,
  "data": {
    "rentals": [
      {
        "id": "rental-001",
        "rentalNumber": "RNT-2026-0001",
        "customer": { ... },
        "items": [ ... ],
        "bookingDate": "2026-02-13T10:00:00Z",
        "eventDate": "2026-02-20T00:00:00Z",
        "deliveryDate": "2026-02-19T14:00:00Z",
        "returnDate": null,
        "status": "active", // booking, delivered, active, returned, cancelled
        "rentalAmount": 10000,
        "securityDeposit": 5000,
        "total": 15000,
        "paid": 15000,
        "notes": "Wedding event"
      }
    ]
  }
}
```

### 2. Create Rental Booking
```http
POST /api/v1/rentals
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "customerId": "cust-001",
  "items": [
    {
      "productId": "prod-rental-001",
      "quantity": 1,
      "rentalDays": 3,
      "ratePerDay": 1000
    }
  ],
  "eventDate": "2026-02-20T00:00:00Z",
  "deliveryDate": "2026-02-19T14:00:00Z",
  "securityDeposit": 5000,
  "payment": {
    "amount": 8000,
    "method": "cash"
  }
}

Response (201 Created):
{
  "success": true,
  "data": { ... created rental ... }
}
```

### 3. Update Rental Status
```http
PATCH /api/v1/rentals/{id}/status
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "status": "delivered",
  "deliveryDate": "2026-02-19T15:00:00Z",
  "notes": "Delivered successfully"
}

Response (200 OK):
{
  "success": true,
  "data": { ... updated rental ... }
}
```

---

## 🎨 STUDIO ENDPOINTS

### 1. Get All Productions
```http
GET /api/v1/studio/productions
Authorization: Bearer {token}
Query Parameters: ?status=in-production

Response (200 OK):
{
  "success": true,
  "data": {
    "productions": [
      {
        "id": "studio-001",
        "productionNumber": "STD-2026-0001",
        "customer": { ... },
        "items": [ ... ],
        "stages": [
          {
            "id": "stage-001",
            "name": "Cutting",
            "status": "completed",
            "completedAt": "2026-02-12T10:00:00Z"
          },
          {
            "id": "stage-002",
            "name": "Stitching",
            "status": "in-progress",
            "assignedTo": "Worker 1"
          }
        ],
        "status": "in-production",
        "createdAt": "2026-02-10T10:00:00Z",
        "expectedCompletion": "2026-02-25T00:00:00Z"
      }
    ]
  }
}
```

---

## 💰 ACCOUNTS ENDPOINTS

### 1. Get All Accounts
```http
GET /api/v1/accounts
Authorization: Bearer {token}
Query Parameters: ?type=Asset

Response (200 OK):
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "acc-001",
        "code": "1000",
        "name": "Cash in Hand",
        "type": "Asset",
        "balance": 150000,
        "isActive": true
      },
      {
        "id": "acc-002",
        "code": "4000",
        "name": "Sales",
        "type": "Revenue",
        "balance": 500000,
        "isActive": true
      }
    ]
  }
}
```

### 2. Get Ledger
```http
GET /api/v1/accounts/{id}/ledger
Authorization: Bearer {token}
Query Parameters: ?startDate=2026-01-01&endDate=2026-02-13

Response (200 OK):
{
  "success": true,
  "data": {
    "account": { ... },
    "openingBalance": 100000,
    "entries": [
      {
        "id": "entry-001",
        "date": "2026-02-13T10:00:00Z",
        "description": "Sale to Ahmed Retailers - SO-2026-0001",
        "debit": 4500,
        "credit": 0,
        "balance": 104500,
        "reference": {
          "type": "sale",
          "id": "sale-001",
          "number": "SO-2026-0001"
        }
      }
    ],
    "closingBalance": 150000
  }
}
```

### 3. Create Journal Entry
```http
POST /api/v1/accounts/entries
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "date": "2026-02-13T10:00:00Z",
  "description": "Expense payment",
  "entries": [
    {
      "accountId": "acc-expense-001",
      "debit": 5000,
      "credit": 0
    },
    {
      "accountId": "acc-cash-001",
      "debit": 0,
      "credit": 5000
    }
  ],
  "reference": {
    "type": "expense",
    "id": "exp-001"
  }
}

Response (201 Created):
{
  "success": true,
  "data": {
    "id": "journal-001",
    "entryNumber": "JE-2026-0001",
    "date": "2026-02-13T10:00:00Z",
    "entries": [ ... ]
  }
}
```

---

## 📊 REPORTS ENDPOINTS

### 1. Sales Summary Report
```http
GET /api/v1/reports/sales-summary
Authorization: Bearer {token}
Query Parameters: ?startDate=2026-01-01&endDate=2026-02-13&branchId=branch-001

Response (200 OK):
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-01-01",
      "end": "2026-02-13"
    },
    "summary": {
      "totalOrders": 150,
      "totalSales": 500000,
      "totalDiscount": 25000,
      "netSales": 475000,
      "cashSales": 300000,
      "creditSales": 175000
    },
    "topCustomers": [ ... ],
    "topProducts": [ ... ],
    "dailySales": [ ... ]
  }
}
```

### 2. Inventory Report
```http
GET /api/v1/reports/inventory
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod-001",
        "name": "Cotton Fabric",
        "currentStock": 100,
        "minStock": 20,
        "stockValue": 45000,
        "status": "sufficient"
      }
    ],
    "summary": {
      "totalProducts": 50,
      "totalStockValue": 2500000,
      "lowStockItems": 5,
      "outOfStockItems": 2
    }
  }
}
```

### 3. Generate PDF Report
```http
POST /api/v1/reports/generate-pdf
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "type": "sales-summary",
  "startDate": "2026-01-01",
  "endDate": "2026-02-13",
  "format": "pdf"
}

Response (200 OK):
{
  "success": true,
  "data": {
    "url": "https://cdn.maindincollection.com/reports/sales-summary-2026-02-13.pdf",
    "expiresAt": "2026-02-14T10:00:00Z"
  }
}
```

---

## 📈 DASHBOARD ENDPOINTS

### 1. Get Dashboard Stats
```http
GET /api/v1/dashboard/stats
Authorization: Bearer {token}
Query Parameters: ?period=today

Response (200 OK):
{
  "success": true,
  "data": {
    "sales": {
      "today": 15000,
      "thisWeek": 85000,
      "thisMonth": 350000,
      "trend": "+12%" // compared to previous period
    },
    "orders": {
      "pending": 5,
      "completed": 45,
      "cancelled": 2
    },
    "inventory": {
      "lowStock": 8,
      "outOfStock": 3,
      "totalValue": 2500000
    },
    "accounts": {
      "cash": 150000,
      "bank": 500000,
      "receivables": 200000,
      "payables": 150000
    }
  }
}
```

---

## ❌ ERROR RESPONSES

### Standard Error Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "Field specific error"
    }
  }
}
```

### Common Error Codes
- `INVALID_CREDENTIALS` - Wrong username/password
- `UNAUTHORIZED` - Missing or invalid token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid input data
- `DUPLICATE_ENTRY` - Resource already exists
- `INSUFFICIENT_STOCK` - Not enough inventory
- `TRANSACTION_FAILED` - Database transaction failed

---

## 🔄 PAGINATION

All list endpoints support pagination:

```
Query Parameters:
- limit: Number of items per page (default: 20, max: 100)
- offset: Number of items to skip (default: 0)
- sortBy: Field to sort by (default: createdAt)
- order: Sort order (asc|desc) (default: desc)
```

---

## 🔍 SEARCH & FILTERS

Most endpoints support:
- `search`: Text search across relevant fields
- `startDate` & `endDate`: Date range filters
- `status`: Filter by status
- `customerId`: Filter by customer
- `branchId`: Filter by branch

---

**Note**: Replace `{id}` with actual resource IDs in URLs.

*Last Updated: February 13, 2026*
