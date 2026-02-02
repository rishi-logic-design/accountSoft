const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const { CustomerModel } = require("../../models");

exports.getCustomerGstNumber = asyncHandler(async (req, res) => {
  const customerId = req.user.customerId;

  if (!customerId) {
    return error(res, "Customer ID not found", 400);
  }

  const record = await CustomerModel.findOne({
    where: { id: customerId },
  });

  if (!record) {
    return error(res, "GST Number not found", 404);
  }

  success(res, record, "Customer GST number fetched");
});

exports.createOrUpdateCustomerGstNumber = asyncHandler(async (req, res) => {
  const customerId = req.user.customerId;

  if (!customerId) {
    return error(res, "Customer ID not found", 400);
  }

  const { gstNumber } = req.body;

  if (!gstNumber) {
    return error(res, "GST Number is required", 400);
  }

  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  if (!gstRegex.test(gstNumber)) {
    return error(res, "Invalid GST Number format", 400);
  }

  const [record, created] = await CustomerModel.findOrCreate({
    where: { id: customerId },
    defaults: { gstNumber },
  });

  if (!created) {
    await record.update({ gstNumber });
  }

  success(
    res,
    record,
    created
      ? "GST Number created successfully"
      : "GST Number updated successfully",
    created ? 201 : 200,
  );
});
