const invoiceSettingsService = require("../../services/vendor/invoiceSettingsService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

exports.getInvoiceSettings = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;

  if (!vendorId) {
    return error(res, "vendorId is required", 400);
  }

  const settings = await invoiceSettingsService.getInvoiceSettings(vendorId);
  success(res, settings, "Invoice settings fetched successfully");
});

exports.updateInvoiceSettings = asyncHandler(async (req, res) => {
  const vendorId = req.user.role === "vendor" ? req.user.id : req.body.vendorId;

  if (!vendorId) {
    return error(res, "vendorId is required", 400);
  }

  const settings = await invoiceSettingsService.updateInvoiceSettings(
    vendorId,
    req.body,
  );

  success(res, settings, "Invoice settings updated successfully");
});

exports.getNextInvoiceNumber = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const requestedNumber = req.query.requestedNumber
    ? parseInt(req.query.requestedNumber)
    : null;

  if (!vendorId) {
    return error(res, "vendorId is required", 400);
  }

  const invoiceInfo = await invoiceSettingsService.getNextInvoiceNumber(
    vendorId,
    requestedNumber,
  );

  success(res, invoiceInfo, "Next invoice number fetched successfully");
});

exports.checkInvoiceNumber = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const { number } = req.query;

  if (!vendorId || !number) {
    return error(res, "vendorId and number are required", 400);
  }

  const availability =
    await invoiceSettingsService.checkInvoiceNumberAvailability(
      vendorId,
      number,
    );

  success(res, availability);
});

exports.getTemplatePreview = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;

  if (!vendorId) {
    return error(res, "vendorId is required", 400);
  }

  const preview =
    await invoiceSettingsService.getInvoiceTemplatePreview(vendorId);
  success(res, preview, "Template preview fetched successfully");
});
