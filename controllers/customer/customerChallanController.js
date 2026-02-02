const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const challanService = require("../../services/vendor/challanService");
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

exports.downloadChallanByPdf = asyncHandler(async (req, res) => {
  const { challanId } = req.params;
  const customerId = req.user.id;

  const pdfBuffer = await challanService.generateChallanPdfForCustomer(
    challanId,
    customerId,
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=challan-${challanId}.pdf`,
  );

  res.send(pdfBuffer);
});
