const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const service = require("../../services/customer/customerChallanService");

exports.getMyChallans = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const data = await service.list(customerId);
  success(res, data);
});

exports.getMyChallan = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const data = await service.getById(req.params.id, customerId);
  success(res, data);
});
