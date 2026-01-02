const paymentService = require("../../services/vendor/paymentService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

exports.createPayment = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const payload = req.body;

  const payment = await paymentService.createPayment(vendorId, payload);

  success(res, payment, "Payment created successfully", 201);
});

exports.listPayments = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const {
    type,
    customerId,
    method,
    status,
    fromDate,
    toDate,
    page,
    size,
    search,
  } = req.query;

  const list = await paymentService.listPayments({
    vendorId,
    type,
    customerId,
    method,
    status,
    fromDate,
    toDate,
    page: page || 1,
    size: size || 20,
    search,
  });

  success(res, list, "Payments retrieved successfully");
});

exports.getPayment = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const result = await paymentService.getPaymentById(req.params.id, vendorId);

  success(res, result, "Payment retrieved successfully");
});

exports.updatePayment = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const payload = req.body;

  const payment = await paymentService.updatePayment(
    req.params.id,
    vendorId,
    payload
  );

  success(res, payment, "Payment updated successfully");
});

exports.deletePayment = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;

  await paymentService.deletePayment(req.params.id, vendorId);

  success(res, null, "Payment deleted successfully");
});

exports.getPaymentStats = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const { fromDate, toDate } = req.query;

  const stats = await paymentService.getPaymentStats(vendorId, {
    fromDate,
    toDate,
  });

  success(res, stats, "Payment statistics retrieved successfully");
});
