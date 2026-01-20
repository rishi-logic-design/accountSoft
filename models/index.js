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

// Vendor - Customer
VendorModel.hasMany(CustomerModel, {
  foreignKey: "createdBy",
  as: "customers",
});
CustomerModel.belongsTo(VendorModel, {
  foreignKey: "createdBy",
  as: "vendor",
});

// Customer - Transaction
CustomerModel.hasMany(TransactionModel, {
  foreignKey: "customerId",
  as: "transactions",
});
TransactionModel.belongsTo(CustomerModel, {
  foreignKey: "customerId",
  as: "customer",
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

// Vendor - Subscription (ADD THESE)
VendorModel.hasMany(SubscriptionModel, {
  foreignKey: "vendorId",
  as: "subscriptions",
});
SubscriptionModel.belongsTo(VendorModel, {
  foreignKey: "vendorId",
  as: "vendor",
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
};
