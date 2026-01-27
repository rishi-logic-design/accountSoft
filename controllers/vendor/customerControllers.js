const customerService = require("../../services/vendor/customerService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const {
  CustomerModel,
  ChallanModel,
  TransactionModel,
} = require("../../models");
const challanService = require("../../services/vendor/challanService");

exports.createCustomer = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Create Customer Request:", req.body);
  console.log("👤 Created By User ID:", req.user?.id);

  const { vendorId, ...customerData } = req.body;

  // Validate vendorId
  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const customer = await customerService.createCustomer(vendorId, customerData);

  console.log("✅ Customer Created Successfully:", customer?.id);
  success(res, customer, "Customer created successfully", 201);
});

exports.updateCustomer = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Update Customer Request:", req.params.id, req.body);

  const { vendorId, ...customerData } = req.body;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const updated = await customerService.updateCustomer(
    vendorId,
    req.params.id,
    customerData,
  );

  console.log("✅ Customer Updated Successfully:", updated?.id);
  success(res, updated, "Customer updated successfully");
});

exports.deleteCustomer = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Delete Customer Request:", req.params.id);

  const { vendorId } = req.query;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  await customerService.deleteCustomer(vendorId, req.params.id);

  console.log("✅ Customer Deleted Successfully:", req.params.id);
  success(res, null, "Customer deleted successfully");
});

exports.listCustomers = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Get Customers Request:", req.query);

  const { vendorId, page, size, search } = req.query;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const list = await customerService.getCustomerList(vendorId, {
    page,
    size,
    search,
  });

  console.log(`📦 Found ${list.total} customers for vendor ${vendorId}`);
  success(res, list);
});

exports.searchCustomers = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Search Customers Request:", req.query);

  const { vendorId, q } = req.query;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  if (!q || q.trim() === "") {
    return error(res, "Search query is required", 400);
  }

  const customers = await customerService.searchCustomers(vendorId, q);

  console.log(`🔎 Found ${customers.length} customers matching query "${q}"`);

  success(
    res,
    {
      total: customers.length,
      rows: customers,
    },
    "Customers found successfully",
  );
});

exports.getCustomerDetail = asyncHandler(async (req, res) => {
  const vendorId = req.user.vendorId;
  const { id: customerId } = req.params;

  const customer = await CustomerModel.findOne({
    where: {
      id: customerId,
      createdBy: vendorId, 
    },
  });

  if (!customer) {
    return res.status(404).json({
      success: false,
      message: "Customer not found",
    });
  }

  const challans = await ChallanModel.findAll({
    where: { customerId, vendorId },
    order: [["challanDate", "DESC"]],
  });

  const challansWithDue = await Promise.all(
    challans.map(async (c) => {
      const detail = await challanService.getChallanById(c.id, vendorId);

      return {
        id: c.id,
        challanNumber: c.challanNumber,
        challanDate: c.challanDate,
        totalAmount: c.totalWithGST,
        due: detail.due,
        status:
          detail.due === 0
            ? "paid"
            : detail.due < c.totalWithGST
              ? "partial"
              : "pending",
      };
    }),
  );

  const totalDue = challansWithDue.reduce((sum, c) => sum + Number(c.due), 0);

  return res.json({
    success: true,
    data: {
      customer,
      challans: challansWithDue,
      due: totalDue,
    },
  });
});

exports.addTransaction = asyncHandler(async (req, res) => {
  console.log(
    "🔥 Incoming Add Transaction Request:",
    req.params.customerId,
    req.body,
  );

  const { vendorId } = req.body;
  const { customerId } = req.params;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const result = await customerService.addTransaction(
    vendorId,
    customerId,
    req.body,
  );

  console.log("✅ Transaction Added Successfully");
  success(res, result, "Transaction added successfully", 201);
});

exports.transactionReport = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Transaction Report Request:", req.query);

  const { vendorId } = req.query;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const rows = await customerService.getTransactionReport(vendorId, {
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
    customerId: req.query.customerId,
  });

  console.log(`📊 Generated report with ${rows.length} transactions`);
  success(res, rows);
});

exports.getCustomerCountByVendor = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Get Customer Count Request");

  const counts = await customerService.getCustomerCountByVendor();

  console.log("✅ Customer counts retrieved successfully");
  success(res, counts);
});
