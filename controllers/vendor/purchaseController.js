const purchaseService = require("../../services/vendor/purchaseService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

exports.createPurchase = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const purchase = await purchaseService.createPurchase(vendorId, req.body);
  success(res, purchase, "Purchase bill created successfully", 201);
});

exports.listPurchases = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { page, size, search, status, fromDate, toDate } = req.query;

  const result = await purchaseService.listPurchases({
    vendorId,
    page: page || 1,
    size: size || 20,
    search,
    status,
    fromDate,
    toDate,
  });

  success(res, result, "Purchase bills retrieved successfully");
});

exports.getPurchaseById = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  const purchase = await purchaseService.getPurchaseById(id, vendorId);
  success(res, purchase, "Purchase bill retrieved successfully");
});

exports.deletePurchase = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  await purchaseService.deletePurchase(id, vendorId);
  success(res, null, "Purchase bill deleted successfully");
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  const { status } = req.body;
  const purchase = await purchaseService.updatePurchaseStatus(
    id,
    vendorId,
    status,
  );
  success(res, purchase, "Purchase status updated successfully");
});
