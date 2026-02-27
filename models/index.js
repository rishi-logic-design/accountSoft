const { sequelize, Sequelize } = require("../db/connect");

const User = require("./vendor/userModel");
const Vendor = require("./vendor/vendorModel");
const Plan = require("./vendor/planModel");
const Subscription = require("./vendor/subcriptionModel");
const customerModel = require("./vendor/customerModel");
const transactionModel = require("./vendor/transactionModel");
const Category = require("./vendor/categoryModel");
const Size = require("./vendor/sizeModel");
const Product = require("./vendor/productModel");
const ProductSize = require("./vendor/productSizeModel");
const Challan = require("./vendor/challanModel");
const ChallanItem = require("./vendor/challanItemModel");
const Bill = require("./vendor/billModel");
const BillItem = require("./vendor/billItemModel");
const Payment = require("./vendor/paymentModel");
const Firm = require("./vendor/firmModel");
const GstSlab = require("./vendor/gstSlabModel");
const CustomerOtp = require("./customer/customerOtpModel");
const VendorGstNumber = require("./vendor/vendorGstNumberModel");
const VendorPaymentDetails = require("./vendor/vendorPaymentDetails");
const NotificationModelFactory = require("./vendor/notificationModel");
const InvoiceSettings = require("./vendor/invoiceSettingsModel");
const VendorVendor = require("./vendor/vendorVendorModel");
const PurchaseBill = require("./vendor/purchaseBillModel");
const PurchasePayment = require("./vendor/purchasePaymentModel");
const Purchase = require("./vendor/purchaseModel");
const PurchaseItem = require("./vendor/purchaseItemModel");
const InventoryCategory = require("./vendor/inventoryCategoryModel");
const Inventory = require("./vendor/inventoryModel");
const CreditNote = require("./vendor/creditNoteModel");
const CreditNoteItem = require("./vendor/creditNoteItemModel");
const Service = require("./vendor/serviceModel");
const SalesDebitNote = require("./vendor/salesDebitNoteModel");
const SalesDebitNoteItem = require("./vendor/salesDebitNoteItemModel");
const Account = require("./vendor/accountModel");
const AccountTransaction = require("./vendor/accountTransactionModel");
const SalesDebitNotePayment = require("./vendor/salesDebitNotePaymentModel");
const BulkExport = require("./vendor/bulkExportModel");

const UserModel = User(sequelize, Sequelize);
const VendorModel = Vendor(sequelize, Sequelize);
const PlanModel = Plan(sequelize, Sequelize);
const SubscriptionModel = Subscription(sequelize, Sequelize);
const CustomerModel = customerModel(sequelize, Sequelize);
const TransactionModel = transactionModel(sequelize, Sequelize);
const CategoryModel = Category(sequelize, Sequelize);
const SizeModel = Size(sequelize, Sequelize);
const ProductModel = Product(sequelize, Sequelize);
const ProductSizeModel = ProductSize(sequelize, Sequelize);
const ChallanModel = Challan(sequelize, Sequelize);
const ChallanItemModel = ChallanItem(sequelize, Sequelize);
const BillModel = Bill(sequelize, Sequelize);
const BillItemModel = BillItem(sequelize, Sequelize);
const PaymentModel = Payment(sequelize, Sequelize);
const FirmModel = Firm(sequelize, Sequelize);
const GstSlabModel = GstSlab(sequelize, Sequelize);
const CustomerOtpModel = CustomerOtp(sequelize, Sequelize);
const VendorGstNumberModel = VendorGstNumber(sequelize, Sequelize);
const VendorPaymentDetailsModel = VendorPaymentDetails(sequelize, Sequelize);
const NotificationModel = NotificationModelFactory(sequelize, Sequelize);
const InvoiceSettingsModel = InvoiceSettings(sequelize, Sequelize);
const VendorVendorModel = VendorVendor(sequelize, Sequelize);
const PurchaseBillModel = PurchaseBill(sequelize, Sequelize);
const PurchasePaymentModel = PurchasePayment(sequelize, Sequelize);
const PurchaseModel = Purchase(sequelize, Sequelize);
const PurchaseItemModel = PurchaseItem(sequelize, Sequelize);
const InventoryCategoryModel = InventoryCategory(sequelize, Sequelize);
const InventoryModel = Inventory(sequelize, Sequelize);
const CreditNoteModel = CreditNote(sequelize, Sequelize);
const CreditNoteItemModel = CreditNoteItem(sequelize, Sequelize);
const ServiceModel = Service(sequelize, Sequelize);
const SalesDebitNoteModel = SalesDebitNote(sequelize, Sequelize);
const SalesDebitNoteItemModel = SalesDebitNoteItem(sequelize, Sequelize);
const AccountModel = Account(sequelize, Sequelize);
const AccountTransactionModel = AccountTransaction(sequelize, Sequelize);
const SalesDebitNotePaymentModel = SalesDebitNotePayment(sequelize, Sequelize);
const BulkExportModel = BulkExport(sequelize, Sequelize);

// Vendor - Customer
VendorModel.hasMany(NotificationModel, {
  foreignKey: "userId",
  constraints: false,
  scope: { userRole: "VENDOR" },
  as: "notifications",
});

CustomerModel.belongsTo(VendorModel, {
  foreignKey: "createdBy",
  as: "vendor",
});

// Customer - Notification
CustomerModel.hasMany(NotificationModel, {
  foreignKey: "userId",
  constraints: false,
  scope: { userRole: "CUSTOMER" },
  as: "notifications",
});

TransactionModel.belongsTo(CustomerModel, {
  foreignKey: {
    name: "customerId",
    allowNull: true,
  },
  as: "customer",
  onDelete: "SET NULL",
});

// Vendor - Transaction
VendorModel.hasMany(TransactionModel, {
  foreignKey: "vendorId",
  as: "vendorTransactions",
});
TransactionModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// Category - Product
CategoryModel.hasMany(ProductModel, {
  foreignKey: "categoryId",
  as: "products",
});
ProductModel.belongsTo(CategoryModel, {
  foreignKey: "categoryId",
  as: "category",
});

// Product - Size (Many-to-Many through ProductSize)
ProductModel.belongsToMany(SizeModel, {
  through: ProductSizeModel,
  foreignKey: "productId",
  otherKey: "sizeId",
  as: "sizes",
});
SizeModel.belongsToMany(ProductModel, {
  through: ProductSizeModel,
  foreignKey: "sizeId",
  otherKey: "productId",
  as: "products",
});

// Product - ProductSize (One-to-Many)
ProductModel.hasMany(ProductSizeModel, {
  foreignKey: "productId",
  as: "productSizes",
});
ProductSizeModel.belongsTo(ProductModel, {
  foreignKey: "productId",
  as: "product",
});

// Size - ProductSize
SizeModel.hasMany(ProductSizeModel, {
  foreignKey: "sizeId",
  as: "productSizes",
});
ProductSizeModel.belongsTo(SizeModel, {
  foreignKey: "sizeId",
  as: "size",
});

// Vendor - Challan
VendorModel.hasMany(ChallanModel, {
  foreignKey: "vendorId",
  as: "challans",
});
ChallanModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// Customer - Challan
CustomerModel.hasMany(ChallanModel, {
  foreignKey: "customerId",
  as: "challans",
});
ChallanModel.belongsTo(CustomerModel, {
  foreignKey: "customerId",
  as: "customer",
});

// Challan - ChallanItem
ChallanModel.hasMany(ChallanItemModel, {
  foreignKey: "challanId",
  as: "items",
});
ChallanItemModel.belongsTo(ChallanModel, {
  foreignKey: "challanId",
  as: "challan",
});
ChallanItemModel.belongsTo(CategoryModel, {
  foreignKey: "categoryId",
  as: "category",
});

// Vendor - Bill
VendorModel.hasMany(BillModel, {
  foreignKey: "vendorId",
  as: "bills",
});
BillModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// Customer - Bill
CustomerModel.hasMany(BillModel, {
  foreignKey: "customerId",
  as: "bills",
});
BillModel.belongsTo(CustomerModel, {
  foreignKey: "customerId",
  as: "customer",
});

// Bill - BillItem
BillModel.hasMany(BillItemModel, {
  foreignKey: "billId",
  as: "items",
});
BillItemModel.belongsTo(BillModel, {
  foreignKey: "billId",
  as: "bill",
});

// Challan - BillItem
ChallanModel.hasMany(BillItemModel, {
  foreignKey: "challanId",
  as: "billItems",
});

// Vendor - Payment
VendorModel.hasMany(PaymentModel, {
  foreignKey: "vendorId",
  as: "payments",
});
PaymentModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// Customer - Payment
CustomerModel.hasMany(PaymentModel, {
  foreignKey: "customerId",
  as: "customerPayments",
});
PaymentModel.belongsTo(CustomerModel, {
  foreignKey: "customerId",
  as: "customer",
});

// Vendor - Firm
VendorModel.hasOne(FirmModel, {
  foreignKey: "vendorId",
  as: "firm",
});
FirmModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// Vendor - GstSlab
VendorModel.hasMany(GstSlabModel, {
  foreignKey: "vendorId",
  as: "gstSlabs",
});
GstSlabModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

VendorModel.hasOne(VendorGstNumberModel, {
  foreignKey: "vendorId",
  as: "gstNumber",
});
VendorGstNumberModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

VendorModel.hasOne(VendorPaymentDetailsModel, {
  foreignKey: "vendorId",
  as: "paymentDetails",
});
VendorPaymentDetailsModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

PlanModel.hasMany(SubscriptionModel, {
  foreignKey: "planId",
  as: "subscriptions",
});
SubscriptionModel.belongsTo(PlanModel, {
  foreignKey: "planId",
  as: "plan",
});

// Vendor - Subscription
VendorModel.hasMany(SubscriptionModel, {
  foreignKey: "vendorId",
  as: "subscriptions",
});
SubscriptionModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

//  Vendor - InvoiceSettings
VendorModel.hasOne(InvoiceSettingsModel, {
  foreignKey: "vendorId",
  as: "invoiceSettings",
});
InvoiceSettingsModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// Vendor (Buyer) - PurchaseBill
VendorModel.hasMany(PurchaseBillModel, {
  foreignKey: "vendorId",
  as: "purchaseBills",
});
PurchaseBillModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "buyer",
});

// VendorVendor (Seller) - PurchaseBill
VendorVendorModel.hasMany(PurchaseBillModel, {
  foreignKey: "sellerId",
  as: "bills",
});
PurchaseBillModel.belongsTo(VendorVendorModel, {
  foreignKey: "sellerId",
  as: "seller",
});

// Vendor - PurchasePayment
VendorModel.hasMany(PurchasePaymentModel, {
  foreignKey: "vendorId",
  as: "purchasePayments",
});
PurchasePaymentModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "buyer",
});

// VendorVendor - PurchasePayment
VendorVendorModel.hasMany(PurchasePaymentModel, {
  foreignKey: "sellerId",
  as: "incomingPayments",
});
PurchasePaymentModel.belongsTo(VendorVendorModel, {
  foreignKey: "sellerId",
  as: "seller",
});

// Vendor (Buyer) - Purchase
VendorModel.hasMany(PurchaseModel, {
  foreignKey: "vendorId",
  as: "purchases",
});
PurchaseModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "buyer",
});

// VendorVendor (Seller) - Purchase
VendorVendorModel.hasMany(PurchaseModel, {
  foreignKey: "sellerId",
  as: "vendorPurchases",
});
PurchaseModel.belongsTo(VendorVendorModel, {
  foreignKey: "sellerId",
  as: "seller",
});

// Purchase - PurchaseItem
PurchaseModel.hasMany(PurchaseItemModel, {
  foreignKey: "purchaseId",
  as: "items",
});
PurchaseItemModel.belongsTo(PurchaseModel, {
  foreignKey: "purchaseId",
  as: "purchase",
});

// Product - PurchaseItem (Optional link)
ProductModel.hasMany(PurchaseItemModel, {
  foreignKey: "productId",
  as: "purchaseItems",
});
PurchaseItemModel.belongsTo(ProductModel, {
  foreignKey: "productId",
  as: "product",
});

// Inventory - Vendor
VendorModel.hasMany(InventoryModel, {
  foreignKey: "vendorId",
  as: "inventories",
});
InventoryModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// InventoryCategory - Vendor
VendorModel.hasMany(InventoryCategoryModel, {
  foreignKey: "vendorId",
  as: "inventoryCategories",
});
InventoryCategoryModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// Inventory - InventoryCategory
InventoryCategoryModel.hasMany(InventoryModel, {
  foreignKey: "categoryId",
  as: "items",
});
InventoryModel.belongsTo(InventoryCategoryModel, {
  foreignKey: "categoryId",
  as: "category",
});

// CreditNote - CreditNoteItem
CreditNoteModel.hasMany(CreditNoteItemModel, {
  foreignKey: "creditNoteId",
  as: "items",
});
CreditNoteItemModel.belongsTo(CreditNoteModel, {
  foreignKey: "creditNoteId",
  as: "creditNote",
});

// Vendor - CreditNote
VendorModel.hasMany(CreditNoteModel, {
  foreignKey: "vendorId",
  as: "creditNotes",
});
CreditNoteModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// SalesDebitNote - SalesDebitNoteItem
SalesDebitNoteModel.hasMany(SalesDebitNoteItemModel, {
  foreignKey: "salesDebitNoteId",
  as: "items",
});
SalesDebitNoteItemModel.belongsTo(SalesDebitNoteModel, {
  foreignKey: "salesDebitNoteId",
  as: "salesDebitNote",
});

// Vendor - SalesDebitNote
VendorModel.hasMany(SalesDebitNoteModel, {
  foreignKey: "vendorId",
  as: "salesDebitNotes",
});
SalesDebitNoteModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// Customer - SalesDebitNote
CustomerModel.hasMany(SalesDebitNoteModel, {
  foreignKey: "customerId",
  as: "salesDebitNotes",
});
SalesDebitNoteModel.belongsTo(CustomerModel, {
  foreignKey: "customerId",
  as: "customer",
});

// SalesDebitNote - SalesDebitNotePayment
SalesDebitNoteModel.hasMany(SalesDebitNotePaymentModel, {
  foreignKey: "salesDebitNoteId",
  as: "notePayments",
});
SalesDebitNotePaymentModel.belongsTo(SalesDebitNoteModel, {
  foreignKey: "salesDebitNoteId",
  as: "salesDebitNote",
});

// Account - SalesDebitNotePayment
AccountModel.hasMany(SalesDebitNotePaymentModel, {
  foreignKey: "accountId",
  as: "notePayments",
});
SalesDebitNotePaymentModel.belongsTo(AccountModel, {
  foreignKey: "accountId",
  as: "account",
});

// Vendor - Service
VendorModel.hasMany(ServiceModel, {
  foreignKey: "vendorId",
  as: "services",
});
ServiceModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// Customer - CreditNote
CreditNoteModel.belongsTo(CustomerModel, {
  foreignKey: "customerId",
  as: "customer",
});

// Vendor - Account
VendorModel.hasMany(AccountModel, {
  foreignKey: "vendorId",
  as: "accounts",
});
AccountModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// Vendor - AccountTransaction
VendorModel.hasMany(AccountTransactionModel, {
  foreignKey: "vendorId",
  as: "accountTransactions",
});
AccountTransactionModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
});

// Account - AccountTransaction
AccountModel.hasMany(AccountTransactionModel, {
  foreignKey: "accountId",
  as: "transactions",
});
AccountTransactionModel.belongsTo(AccountModel, {
  foreignKey: "accountId",
  as: "account",
});

// AccountTransaction - Account (for transfers)
AccountTransactionModel.belongsTo(AccountModel, {
  foreignKey: "toAccountId",
  as: "toAccount",
});

module.exports = {
  sequelize,
  Sequelize,
  UserModel,
  VendorModel,
  PlanModel,
  SubscriptionModel,
  CustomerModel,
  TransactionModel,

  Category: CategoryModel,
  Size: SizeModel,
  Product: ProductModel,
  ProductSize: ProductSizeModel,

  CategoryModel,
  SizeModel,
  ProductModel,
  ProductSizeModel,

  ChallanModel,
  ChallanItemModel,
  BillModel,
  BillItemModel,
  PaymentModel,
  FirmModel,
  GstSlabModel,
  CustomerOtpModel,
  VendorGstNumberModel,
  VendorPaymentDetailsModel,

  Notification: NotificationModel,
  InvoiceSettingsModel,
  VendorVendorModel,
  PurchaseBillModel,
  PurchasePaymentModel,
  PurchaseModel,
  PurchaseItemModel,
  InventoryModel,
  InventoryCategoryModel,
  CreditNoteModel,
  CreditNoteItemModel,
  ServiceModel,
  SalesDebitNoteModel,
  SalesDebitNoteItemModel,
  AccountModel,
  AccountTransactionModel,
  SalesDebitNotePaymentModel,
  BulkExportModel,
};
