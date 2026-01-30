const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const { CustomerModel } = require("../../models");

exports.getMyProfile = asyncHandler(async (req, res) => {
  if (req.user.role !== "customer") {
    return error(res, "Unauthorized", 403);
  }

  const customerId = req.user.id;

  const customer = await CustomerModel.findByPk(customerId);

  if (!customer) {
    return error(res, "Customer not found", 404);
  }

  success(res, customer, "Customer profile fetched");
});

exports.updateMyProfile = asyncHandler(async (req, res) => {
  if (req.user.role !== "customer") {
    return error(res, "Unauthorized", 403);
  }

  const customerId = req.user.id;

  const customer = await CustomerModel.findByPk(customerId);

  if (!customer) {
    return error(res, "Customer not found", 404);
  }

  const allowedFields = [
    "customerName",
    "businessName",
    "email",
    "gstNumber",
    "image",
  ];

  const updateData = {};
  allowedFields.forEach((key) => {
    if (req.body[key] !== undefined) {
      updateData[key] = req.body[key];
    }
  });

  await customer.update(updateData);

  success(res, customer, "Profile updated successfully");
});
