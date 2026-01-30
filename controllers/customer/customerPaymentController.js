const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const service = require("../../services/customer/customerPaymentService");

exports.getMyPayments = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const data = await service.list(customerId);
  success(res, data);
});
