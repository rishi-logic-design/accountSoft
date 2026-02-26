# AccountSoft ERP — Backend API

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-v5.1-000000?style=for-the-badge&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Sequelize](https://img.shields.io/badge/Sequelize-v6-52B0E7?style=for-the-badge&logo=sequelize&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)

**A production-grade, multi-tenant ERP REST API for small and medium-sized businesses.**  
Handles invoicing, inventory, procurement, accounting, reporting, and subscription management.

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Authentication](#authentication)
- [Multi-Tenancy](#multi-tenancy)

---

## Overview

AccountSoft ERP is a comprehensive backend system designed to digitize and automate the financial operations of small and medium businesses. Built with a **service-oriented architecture**, the system supports **multi-tenant vendor isolation**, meaning each business (vendor) sees only its own data.

The API powers mobile and web applications used for:
- Creating and sharing GST-compliant invoices (PDF generation)
- Managing customers, suppliers, and their full ledger history
- Tracking inventory, purchases, and payments
- Generating business reports (product-wise, party-wise sales & purchases)
- Managing bank/cash accounts with contra entries

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (React / Mobile)           │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS REST
┌────────────────────────▼────────────────────────────┐
│              Express.js HTTP Server                  │
│  ┌──────────────────────────────────────────────┐   │
│  │   Auth Middleware (JWT + Role Guard)          │   │
│  └──────────────┬───────────────────────────────┘   │
│  ┌──────────────▼───────────────────────────────┐   │
│  │   Route Layer  (30+ resource routers)         │   │
│  └──────────────┬───────────────────────────────┘   │
│  ┌──────────────▼───────────────────────────────┐   │
│  │   Controller Layer  (request/response)        │   │
│  └──────────────┬───────────────────────────────┘   │
│  ┌──────────────▼───────────────────────────────┐   │
│  │   Service Layer  (all business logic)         │   │
│  └──────────────┬───────────────────────────────┘   │
│  ┌──────────────▼───────────────────────────────┐   │
│  │   Sequelize ORM  (37 models, MySQL)           │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         │
         ┌───────────────▼──────────────┐
         │       MySQL 8 (Aiven Cloud)   │
         └──────────────────────────────┘
```

The codebase strictly separates concerns into three layers:
1. **Routes** — only declare endpoints and apply middleware
2. **Controllers** — parse HTTP request, call service, return response
3. **Services** — contain all business logic, database queries, and transactions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js v5 |
| Database | MySQL 8 (hosted on Aiven Cloud) |
| ORM | Sequelize v6 |
| Authentication | JWT (jsonwebtoken) |
| Password Hashing | bcryptjs |
| PDF Generation | Playwright Chromium + PDFKit |
| Template Engine | Handlebars |
| File Uploads | Multer |
| CSV Export | json2csv |
| Scheduled Jobs | node-cron |
| Environment | dotenv (separate dev/prod configs) |

---

## Features

### 👤 Authentication & Multi-Tenancy
- JWT-based authentication with role-based access control (`superadmin`, `admin`, `vendor`, `customer`)
- Every resource is scoped to `vendorId` — complete data isolation between businesses
- Token expiry with configurable duration
- Separate customer-facing auth flow

### 🧾 Invoicing & Billing
- Create GST-compliant invoices directly or from delivery challans
- Auto-incrementing invoice numbering with custom prefix support
- **5 invoice templates** (HTML/Handlebars) — rendered to PDF via Playwright Chromium
- Invoice editing, partial payments, payment history tracking
- WhatsApp sharing integration
- Credit Notes (sales returns)

### 📦 Inventory & Products
- Product catalog with categories and size variants (Many-to-Many)
- Inventory tracking with categorization
- Delivery Challans — convert to invoices in bulk

### 🛒 Purchase Management
- Complete purchase lifecycle: Purchase Orders → Purchase Bills → Payments
- Vendor (Supplier) management with ledger history
- Sales Debit Notes (purchase returns) with payment recording
- Account balance auto-update on every transaction

### 💰 Accounting & Ledger
- **Customer Ledger** — Bills, Payments, Credit Notes with running balance
- **Vendor/Supplier Ledger** — Purchases, Payments, Debit Notes
- **Cash & Bank Accounts** — opening balance, deposits, withdrawals
- **Contra Entry** — bank-to-bank and cash-to-bank transfers
- Balance Adjustment with full audit trail via `account_transactions` table

### 📊 Business Reports
- Product-Wise Sales Report — ranked by revenue
- Product-Wise Purchase Report
- Party-Wise Sales Report — ranked by customer revenue
- Party-Wise Purchase Report — ranked by supplier spend
- All reports support date filtering and pagination

### 🔔 Notifications
- Vendor and customer notification system
- Role-scoped notification retrieval

### 🔄 Scheduled Jobs
- node-cron based scheduled tasks (e.g., subscription expiry checks)

---

## Database Schema

The system has **37 Sequelize models** organized around the following entity groups:

```
Users & Auth          UserModel, VendorModel, CustomerModel
Plans & Billing       PlanModel, SubscriptionModel
Firm & Settings       FirmModel, InvoiceSettingsModel, VendorGstNumberModel
Products              CategoryModel, ProductModel, SizeModel, ProductSizeModel
Challans              ChallanModel, ChallanItemModel
Sales                 BillModel, BillItemModel, PaymentModel
Credit Notes          CreditNoteModel, CreditNoteItemModel
Purchases             PurchaseModel, PurchaseItemModel, PurchaseBillModel
Purchase Payments     PurchasePaymentModel
Debit Notes           SalesDebitNoteModel, SalesDebitNoteItemModel, SalesDebitNotePaymentModel
Suppliers             VendorVendorModel, VendorPaymentDetails
Accounts              AccountModel, AccountTransactionModel
Inventory             InventoryModel, InventoryCategoryModel
Services              ServiceModel
Notifications         NotificationModel
```

Key design decisions:
- **Paranoid deletes** on all financial records (soft delete with `deletedAt`)
- **DECIMAL(12,2)** for all monetary values to avoid floating-point errors
- **ENUM status fields** for lifecycle management (e.g., `pending → partial → paid`)
- **JSON columns** for flexible data (addresses, adjusted invoices, attachment URLs)

---

## API Reference

### Base URL
```
Development:  http://localhost:5000
Production:   https://your-api-domain.com
```

### Authentication
All protected routes require:
```
Authorization: Bearer <JWT_TOKEN>
```

### Endpoints Overview

#### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register new vendor |
| `POST` | `/auth/login` | Login, returns JWT |
| `POST` | `/auth/refresh` | Refresh token |

#### Customers
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/customers` | List all customers (paginated) |
| `POST` | `/api/customers` | Create customer |
| `PUT` | `/api/customers/:id` | Update customer |
| `DELETE` | `/api/customers/:id` | Soft delete customer |

#### Invoices (Bills)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/bills` | Create invoice (from challans or direct items) |
| `GET` | `/api/bills` | List invoices with filters |
| `GET` | `/api/bills/:id` | Get invoice with payment history |
| `PUT` | `/api/bills/:id` | Edit invoice |
| `DELETE` | `/api/bills/:id` | Delete invoice |
| `GET` | `/api/bills/:id/html` | Render invoice HTML (Handlebars template) |
| `GET` | `/api/bills/:id/pdf` | Download invoice PDF |
| `POST` | `/api/bills/:id/payment` | Record payment |

#### Ledger
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ledger/customers` | Customer list with balances |
| `GET` | `/api/ledger/customers/:id` | Customer ledger with entries |
| `GET` | `/api/ledger/vendors` | Vendor list with balances |
| `GET` | `/api/ledger/vendors/:id` | Vendor ledger with entries |
| `GET` | `/api/ledger/accounts` | Cash/Bank account list with balances |
| `GET` | `/api/ledger/accounts/:id` | Account transaction ledger |

#### Cash & Bank Accounts
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/accounts` | List accounts |
| `POST` | `/api/accounts` | Create account |
| `PUT` | `/api/accounts/:id` | Update account |
| `DELETE` | `/api/accounts/:id` | Delete account |
| `POST` | `/api/accounts/adjust-balance` | Manual deposit / withdrawal |
| `POST` | `/api/accounts/contra-entry` | Transfer between accounts |

#### Sales Debit Notes
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/sales-debit-notes` | Create debit note |
| `GET` | `/api/sales-debit-notes` | List debit notes |
| `GET` | `/api/sales-debit-notes/:id` | Get single debit note |
| `PUT` | `/api/sales-debit-notes/:id` | Update debit note |
| `DELETE` | `/api/sales-debit-notes/:id` | Delete debit note |
| `POST` | `/api/sales-debit-notes/record-payment` | Record payment against note |

#### Reports
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reports/product-wise-sales` | Product-wise sales summary |
| `GET` | `/api/reports/product-wise-purchase` | Product-wise purchase summary |
| `GET` | `/api/reports/party-wise-sales` | Party (customer) wise sales |
| `GET` | `/api/reports/party-wise-purchase` | Party (supplier) wise purchases |

> All list endpoints support: `?page=1&size=20&search=&fromDate=&toDate=`

---

## Getting Started

### Prerequisites
- Node.js 18+
- MySQL 8 (local or cloud)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/accountsoft-erp.git
cd accountsoft-erp/backend

# Install dependencies
npm install

# Set up environment
cp .env.development .env
# Edit .env with your database credentials

# Start development server (with --watch for hot reload)
npm start
```

The server starts on `http://localhost:5000`.  
On first run, Sequelize automatically syncs all 37 tables to your database.

### Health Check
```
GET /health
→ { "status": "OK", "timestamp": "..." }
```

---

## Project Structure

```
backend/
├── server.js                  # Entry point — Express app + DB sync + server start
├── package.json
├── .env.development
├── .env.production
│
├── db/
│   └── connect.js             # Sequelize DB connection
│
├── models/
│   ├── index.js               # All models + associations (relations)
│   └── vendor/                # 37 Sequelize model definitions
│
├── routes/
│   ├── Vendors/               # 30 vendor-facing route files
│   └── Customer/              # Customer-facing route files
│
├── controllers/
│   └── vendor/                # Request handlers (thin layer)
│
├── services/
│   └── vendor/                # All business logic lives here
│
├── middleware/
│   ├── authMiddleware.js      # JWT verification + user hydration
│   ├── roleMiddleware.js      # Role-based access guard
│   ├── errorMiddleware.js     # Global error handler
│   └── upload.js              # Multer file upload config
│
├── utils/
│   ├── templateRenderer.js    # Handlebars template engine
│   ├── pdfGenerator.js        # Playwright PDF generation
│   ├── asyncHandler.js        # Async error wrapper
│   └── ...
│
├── templates/
│   └── invoices/              # 5 HTML invoice templates (invoice1–5.html)
│
└── cron/                      # node-cron scheduled jobs
```

---

## Authentication

The system supports three user roles, each with a separate authentication flow:

| Role | Description | Token Source |
|---|---|---|
| `vendor` | Business owner — full access to their own data | `/auth/login` |
| `customer` | End customer — read-only access to their invoices | `/auth/customer/login` |
| `admin` / `superadmin` | Platform administrator | `/auth/admin/login` |

The `authMiddleware.js` verifies the JWT, identifies the role, hydrates `req.user`, and passes to the next middleware. The `roleMiddleware.js` then ensures the user has the required role for the route.

---

## Multi-Tenancy

Every database table that stores business data contains a `vendorId` column.  
All service functions accept `vendorId` as the first argument and include it in every query's `WHERE` clause.  
This guarantees **complete data isolation** between tenants — no business can ever access another's data, even if they share the same database.

```js
// Example from billService.js
exports.listBills = async ({ vendorId, ... }) => {
  const where = {};
  if (vendorId) where.vendorId = vendorId;   // ← always scoped
  return BillModel.findAndCountAll({ where, ... });
};
```

---

## License

This project is proprietary software developed for AccountSoft ERP.  
All rights reserved © 2026.

---

<div align="center">
Built with ❤️ using Node.js · Express · Sequelize · MySQL
</div>
