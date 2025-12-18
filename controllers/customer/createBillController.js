const asyncHandler = require("../utils/asyncHandler");
const { success, error } = require("../utils/apiResponse");
const createBillService = require("../services/createBill.service");

exports.computePrice = asyncHandler(async (req, res) => {
  const payload = req.body;
  const result = await createBillService.computePrice(payload);
  success(res, result);
});

exports.createBill = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const payload = req.body;
  const bill = await createBillService.createBillFromItems(vendorId, payload);
  success(res, bill, "Bill created", 201);
});
