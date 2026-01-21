const billService = require("../../services/vendor/billService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const { whatsappLink } = require("../../utils/whatsappHelper");

exports.createBill = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const payload = req.body;
  const bill = await billService.createBill(vendorId, payload);
  success(res, bill, "Bill created", 201);
});

exports.listBills = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const { page, size, search, fromDate, toDate, pageSize, status, customerId } =
    req.query;
  const list = await billService.listBills({
    vendorId,
    customerId,
    page,
    size: size || pageSize,
    search,
    fromDate,
    toDate,
    status,
  });
  success(res, list);
});

exports.getBill = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const result = await billService.getBillById(req.params.id, vendorId);
  success(res, result);
});

exports.markBillPaid = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const payload = req.body;
  const result = await billService.markBillPaid(
    req.params.id,
    vendorId,
    payload,
  );
  success(res, result, "Payment recorded");
});

exports.editBill = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const payload = req.body;
  const updated = await billService.editBill(req.params.id, vendorId, payload);
  success(res, updated, "Bill updated");
});

exports.generateBillPdf = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const buffer = await billService.generateBillPdf(req.params.id, vendorId);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=bill_${req.params.id}.pdf`,
  );
  res.send(buffer);
});

exports.sendBillWhatsapp = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const { phone, link, message } = await billService.getWhatsappLinkForBill(
    req.params.id,
    vendorId,
    req.body.message,
  );
  success(res, { phone, link, message }, "WhatsApp link ready");
});

exports.deleteBill = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  await billService.deleteBill(req.params.id, vendorId); // optional - implement in service if you want
  success(res, null, "Bill deleted");
});

exports.getVendorPendingBillTotal = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : req.query.vendorId || req.body.vendorId;

  if (!vendorId) {
    return error(res, "vendorId is required", 400);
  }

  const result = await billService.getVendorPendingBillTotal(vendorId);
  success(res, result, "Vendor pending bill total fetched");
});
