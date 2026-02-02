const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const service = require("../../services/customer/customerChallanService");

exports.getMyChallans = asyncHandler(async (req, res) => {
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

exports.getMyChallan = asyncHandler(async (req, res) => {
  const customerId = req.user.id;

  const challan = await service.getById(req.params.id, customerId);

  if (!challan) {
    return error(res, "Challan not found", 404);
  }

  const response = {
    ...challan.toJSON(),
    items: challan.items || [],
  };

  success(res, response);
});
exports.downloadMyChallanPdf = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const challanId = req.params.challanId;

  const buffer = await service.generateMyChallanPdf(challanId, customerId);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=challan_${challanId}.pdf`,
  );

  res.send(buffer);
});
