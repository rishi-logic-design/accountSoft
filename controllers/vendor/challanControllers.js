const challanService = require("../../services/vendor/challanService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const { whatsappLink } = require("../../utils/whatsappHelper");

exports.createChallan = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const challan = await challanService.createChallan(vendorId, req.body);
  success(res, challan, "Challan created", 201);
});

exports.listChallans = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const { page, size, search, fromDate, toDate, status } = req.query;
  const list = await challanService.listChallans({
    vendorId,
    page,
    size,
    search,
    fromDate,
    toDate,
    status,
    sortBy,
    sortOrder,
  });
  success(res, list);
});

exports.getChallanById = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const result = await challanService.getChallanById(req.params.id, vendorId);
  success(res, result);
});

exports.markChallanPaid = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const payload = req.body;
  const result = await challanService.markChallanPaid(
    req.params.id,
    vendorId,
    payload
  );
  success(res, result, "Payment processed");
});

exports.sendChallanWhatsapp = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const { phone, defaultMessage } =
    await challanService.getWhatsappDataForChallan(req.params.id, vendorId);
  if (!phone) return error(res, "Customer phone not found", 400);
  const message = req.body.message || defaultMessage;
  const link = whatsappLink(phone, message);
  success(res, { phone, link }, "WhatsApp link ready");
});

exports.deleteChallan = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  await challanService.deleteChallan(req.params.id, vendorId);
  success(res, null, "Challan deleted");
});

exports.downloadChallanPdf = asyncHandler(async (req, res) => {
  const user = req.user || {};

  const vendorId = user.role === "vendor" ? user.id : req.query.vendorId;
  if (!vendorId) {
    return error(res, "vendorId is required for admin", 400);
  }

  const buffer = await challanService.generateChallanPdf(
    req.params.id,
    vendorId
  );
  if (!buffer) {
    return error(res, "Failed to generate PDF", 500);
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=challan_${req.params.id}.pdf`
  );

  res.send(buffer);
});
