const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const firmService = require("../../services/vendor/firmService.js");


exports.getFirm = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;

  if (!vendorId) {
    return error(res, "Unauthorized", 401);
  }

  const firm = await firmService.getFirm(vendorId);

  if (!firm) {
    return success(res, { firm: null }, "No firm details found");
  }

  success(res, { firm }, "Firm details fetched successfully");
});

exports.upsertFirm = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;

  if (!vendorId) {
    return error(res, "Unauthorized", 401);
  }

  const {
    firmName,
    addressLine1,
    addressLine2,
    city,
    state,
    pincode,
    gstNumber,
    phone,
    email,
    extra,
  } = req.body;

  // Basic validation
  if (!firmName || !city || !state) {
    return error(res, "Firm name, city, and state are required", 400);
  }

  // Validate GST number format if provided
  if (gstNumber) {
    const gstRegex =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(gstNumber)) {
      return error(res, "Invalid GST number format", 400);
    }
  }

  // Validate pincode if provided
  if (pincode && !/^[0-9]{6}$/.test(pincode)) {
    return error(res, "Invalid pincode format. Must be 6 digits", 400);
  }

  const payload = {
    firmName,
    addressLine1: addressLine1 || null,
    addressLine2: addressLine2 || null,
    city,
    state,
    pincode: pincode || null,
    gstNumber: gstNumber || null,
    phone: phone || null,
    email: email || null,
    extra: extra || null,
  };

  const saved = await firmService.upsertFirm(vendorId, payload);

  success(res, { firm: saved }, "Firm details saved successfully");
});


exports.updateFirm = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;

  if (!vendorId) {
    return error(res, "Unauthorized", 401);
  }

  const existingFirm = await firmService.getFirm(vendorId);

  if (!existingFirm) {
    return error(res, "Firm not found. Please create firm details first", 404);
  }

  const updates = req.body;

  // Validate GST number if being updated
  if (updates.gstNumber) {
    const gstRegex =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(updates.gstNumber)) {
      return error(res, "Invalid GST number format", 400);
    }
  }

  // Validate pincode if being updated
  if (updates.pincode && !/^[0-9]{6}$/.test(updates.pincode)) {
    return error(res, "Invalid pincode format. Must be 6 digits", 400);
  }

  const updated = await firmService.updateFirm(vendorId, updates);

  success(res, { firm: updated }, "Firm details updated successfully");
});


exports.deleteFirm = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;

  if (!vendorId) {
    return error(res, "Unauthorized", 401);
  }

  await firmService.deleteFirm(vendorId);

  success(res, { message: "Firm details deleted successfully" }, "Deleted");
});
