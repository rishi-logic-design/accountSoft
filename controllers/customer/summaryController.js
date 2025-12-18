const summaryService = require("../../services/customer/summaryService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

exports.getSummary = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : Number(req.query.vendorId || req.user.id);
  const { fromDate, toDate } = req.query;
  const summary = await summaryService.getVendorSummary(vendorId, {
    fromDate,
    toDate,
  });
  success(res, summary);
});
