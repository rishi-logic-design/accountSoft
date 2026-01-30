const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const service = require("../../services/customer/customerPaymentService");

exports.getMyPayments = asyncHandler(async (req, res) => {
  const customerId = req.user.id;

  const { page = 1, size = 20, method, status, fromDate, toDate } = req.query;

  const data = await service.list(customerId, {
    page,
    size,
    method,
    status,
    fromDate,
    toDate,
  });

  success(res, data);
});
