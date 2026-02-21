const vendorBillService = require("../../services/vendor/vendorBillService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

exports.createBill = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const bill = await vendorBillService.createBill(vendorId, req.body);
  success(res, bill, "Vendor bill created successfully", 201);
});

exports.listBills = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { sellerId, page, size, search, status, fromDate, toDate } = req.query;

  const result = await vendorBillService.listBills({
    vendorId,
    sellerId,
    page: page || 1,
    size: size || 20,
    search,
    status,
    fromDate,
    toDate,
  });

  success(res, result, "Vendor bills retrieved successfully");
});

exports.getBillById = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  const bill = await vendorBillService.getBillById(id, vendorId);
  success(res, bill, "Vendor bill retrieved successfully");
});

exports.deleteBill = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  await vendorBillService.deleteBill(id, vendorId);
  success(res, null, "Vendor bill deleted successfully");
});
