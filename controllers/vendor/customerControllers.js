const customerService = require("../../services/vendor/customerService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

exports.createCustomer = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const payload = req.body;
  const customer = await customerService.createCustomer(vendorId, payload);
  success(res, customer, "Customer created", 201);
});

exports.updateCustomer = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const updated = await customerService.updateCustomer(
    vendorId,
    req.params.id,
    req.body
  );
  success(res, updated, "Customer updated");
});

exports.deleteCustomer = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  await customerService.deleteCustomer(vendorId, req.params.id);
  success(res, null, "Customer deleted");
});

exports.listCustomers = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : req.query.vendorId || req.user.id;
  const { page, size, search } = req.query;
  const list = await customerService.getCustomerList(vendorId, {
    page,
    size,
    search,
  });
  success(res, list);
});

exports.getCustomerDetail = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : req.query.vendorId || req.user.id;
  const detail = await customerService.getCustomerDetail(
    vendorId,
    req.params.id
  );
  success(res, detail);
});

exports.addTransaction = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const { customerId } = req.params;
  const payload = req.body; // amount, type, description, challanNumber, transactionDate
  const result = await customerService.addTransaction(
    vendorId,
    customerId,
    payload
  );
  success(res, result, "Transaction added", 201);
});

exports.transactionReport = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : req.query.vendorId || req.user.id;
  const rows = await customerService.getTransactionReport(vendorId, {
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
    customerId: req.query.customerId,
  });
  // For now return JSON; frontend can convert to CSV/pdf
  success(res, rows);
});
