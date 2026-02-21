const purchasePaymentService = require("../../services/vendor/purchasePaymentService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

exports.createPayment = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const payment = await purchasePaymentService.createPayment(
    vendorId,
    req.body,
  );
  success(res, payment, "Purchase payment created successfully", 201);
});

exports.listPayments = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { sellerId, method, status, fromDate, toDate, page, size, search } =
    req.query;

  const result = await purchasePaymentService.listPayments({
    vendorId,
    sellerId,
    method,
    status,
    fromDate,
    toDate,
    page: page || 1,
    size: size || 20,
    search,
  });

  success(res, result, "Purchase payments retrieved successfully");
});

exports.getPaymentById = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  const payment = await purchasePaymentService.getPaymentById(id, vendorId);
  success(res, payment, "Purchase payment retrieved successfully");
});

exports.deletePayment = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  await purchasePaymentService.deletePayment(id, vendorId);
  success(res, null, "Purchase payment deleted successfully");
});

exports.getSellerOutstanding = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { sellerId } = req.params;
  const result = await purchasePaymentService.getSellerOutstanding(
    vendorId,
    sellerId,
  );
  success(res, result, "Seller outstanding retrieved successfully");
});

exports.getSellerPendingPurchases = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { sellerId } = req.params;
  const result = await purchasePaymentService.getSellerPendingPurchases(
    vendorId,
    sellerId,
  );
  success(res, result, "Pending purchases retrieved successfully");
});
