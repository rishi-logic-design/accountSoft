const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const service = require("../../services/customer/createBillservice");

exports.getMyBills = asyncHandler(async (req, res) => {
  const customerId = req.user.id;

  const { page = 1, size = 20, search, status, fromDate, toDate } = req.query;

  const data = await service.list(customerId, {
    page,
    size,
    search,
    status,
    fromDate,
    toDate,
  });

  success(res, data);
});

exports.getMyBill = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const data = await service.getById(req.params.id, customerId);
  success(res, data);
});
