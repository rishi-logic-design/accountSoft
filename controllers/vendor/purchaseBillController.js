const purchaseBillService = require("../../services/vendor/purchaseBillService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

exports.createBill = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const bill = await purchaseBillService.createBill(vendorId, req.body);
  success(res, bill, "Purchase bill created successfully", 201);
});

exports.listBills = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { sellerId, page, size, search, status, fromDate, toDate } = req.query;

  const result = await purchaseBillService.listBills({
    vendorId,
    sellerId,
    page: page || 1,
    size: size || 20,
    search,
    status,
    fromDate,
    toDate,
  });

  success(res, result, "Purchase bills retrieved successfully");
});

exports.getBillById = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  const bill = await purchaseBillService.getBillById(id, vendorId);
  success(res, bill, "Purchase bill retrieved successfully");
});

exports.deleteBill = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  await purchaseBillService.deleteBill(id, vendorId);
  success(res, null, "Purchase bill deleted successfully");
});
