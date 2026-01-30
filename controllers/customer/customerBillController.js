const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const service = require("../../services/customer/createBillservice");

exports.getMyBills = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const data = await service.list(customerId);
  success(res, data);
});

exports.getMyBill = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const data = await service.getById(req.params.id, customerId);
  success(res, data);
});
