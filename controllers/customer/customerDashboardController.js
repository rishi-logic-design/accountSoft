const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const service = require("../../services/customer/customerDashboardService");

exports.dashboard = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const data = await service.summary(customerId);
  success(res, data);
});
