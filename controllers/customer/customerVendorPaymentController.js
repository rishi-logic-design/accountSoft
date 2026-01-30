const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const { VendorPaymentDetailsModel } = require("../../models");

exports.getVendorPaymentDetailsForCustomer = asyncHandler(async (req, res) => {
  const vendorId = req.user.vendorId;

  if (!vendorId) {
    return error(res, "Vendor ID not found for customer", 400);
  }

  const record = await VendorPaymentDetailsModel.findOne({
    where: { vendorId },
    attributes: [
      "bankName",
      "accountNumber",
      "ifscCode",
      "upiId",
      "qrCodeAttachment",
    ],
  });

  if (!record) {
    return error(res, "Vendor payment details not found", 404);
  }

  success(res, record, "Vendor payment details fetched");
});
