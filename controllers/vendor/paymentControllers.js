const paymentService = require("../../services/vendor/paymentService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

exports.createPayment = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const payload = req.body;
  const payment = await paymentService.createPayment(vendorId, payload);
  success(res, payment, "Payment created", 201);
});

exports.listPayments = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const { type, customerId, method, fromDate, toDate, page, size } = req.query;
  const list = await paymentService.listPayments({
    vendorId,
    type,
    customerId,
    method,
    fromDate,
    toDate,
    page: page || 1,
    size: size || 20,
  });
  success(res, list);
});

exports.getPayment = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const result = await paymentService.getPaymentById(req.params.id, vendorId);
  success(res, result);
});

exports.deletePayment = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  await paymentService.deletePayment(req.params.id, vendorId);
  success(res, null, "Payment deleted");
});
