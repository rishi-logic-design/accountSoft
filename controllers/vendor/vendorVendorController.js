const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const vendorVendorService = require("../../services/vendor/vendorVendorService");

exports.createVendorVendor = asyncHandler(async (req, res) => {
  console.log("🔥 [VendorVendor] Create Request:", req.body);

  const { vendorName, mobile } = req.body;

  if (!vendorName || !mobile) {
    return error(res, "Vendor name and mobile number are required", 400);
  }

  const vendorVendor = await vendorVendorService.createVendorVendor(
    req.body,
    req.user.id,
  );

  console.log("✅ [VendorVendor] Created:", vendorVendor.id);
  return success(res, vendorVendor, "Vendor added successfully", 201);
});

exports.getVendorVendors = asyncHandler(async (req, res) => {
  console.log("🔥 [VendorVendor] Get All Request:", req.query);

  const data = await vendorVendorService.getVendorVendors(
    req.user.id,
    req.query,
  );

  console.log(`📦 [VendorVendor] Found ${data.total} vendors`);
  return success(res, data);
});

exports.getVendorVendorById = asyncHandler(async (req, res) => {
  console.log("🔥 [VendorVendor] Get By ID:", req.params.id);

  const vendorVendor = await vendorVendorService.getVendorVendorById(
    req.params.id,
    req.user.id,
  );

  return success(res, vendorVendor);
});

exports.updateVendorVendor = asyncHandler(async (req, res) => {
  console.log("🔥 [VendorVendor] Update Request:", req.params.id, req.body);

  const vendorVendor = await vendorVendorService.updateVendorVendor(
    req.params.id,
    req.user.id,
    req.body,
  );

  console.log("✅ [VendorVendor] Updated:", vendorVendor.id);
  return success(res, vendorVendor, "Vendor updated successfully");
});

exports.deleteVendorVendor = asyncHandler(async (req, res) => {
  console.log("🔥 [VendorVendor] Delete Request:", req.params.id);

  await vendorVendorService.deleteVendorVendor(req.params.id, req.user.id);

  console.log("🗑️ [VendorVendor] Deleted:", req.params.id);
  return success(res, null, "Vendor deleted successfully");
});
