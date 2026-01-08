const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const { VendorPaymentDetailsModel } = require("../../models");
const { validateIFSCCode } = require("../../utils/paymentUtil");

exports.createOrUpdatePaymentDetails = asyncHandler(async (req, res) => {
  const vendorId =
    req.user?.role === "vendor" ? req.user.id : req.body.vendorId;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const { bankName, accountNumber, ifscCode, upiId, qrCodeAttachment } =
    req.body;

  if (ifscCode) {
    const ifscValidation = validateIFSCCode(ifscCode);
    if (!ifscValidation.isValid) {
      return error(res, ifscValidation.message, 400);
    }
  }

  if (upiId) {
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    if (!upiRegex.test(upiId)) {
      return error(res, "Invalid UPI ID format", 400);
    }
  }

  const [record, created] = await VendorPaymentDetailsModel.findOrCreate({
    where: { vendorId },
    defaults: { bankName, accountNumber, ifscCode, upiId, qrCodeAttachment },
  });

  if (!created) {
    await record.update({
      bankName,
      accountNumber,
      ifscCode,
      upiId,
      qrCodeAttachment,
    });
  }

  success(
    res,
    record,
    created
      ? "Payment details created successfully"
      : "Payment details updated successfully",
    created ? 201 : 200
  );
});

exports.getPaymentDetails = asyncHandler(async (req, res) => {
  const vendorId =
    req.user?.role === "vendor" ? req.user.id : req.query.vendorId;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const record = await VendorPaymentDetailsModel.findOne({
    where: { vendorId },
  });

  if (!record) {
    return error(res, "Payment details not found", 404);
  }

  success(res, record, "Payment details retrieved successfully");
});
