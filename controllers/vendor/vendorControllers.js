const { VendorModel, SubscriptionModel, PlanModel } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const { Op } = require("sequelize");

exports.createVendor = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Create Vendor Request:", req.body);
  console.log("👤 Created By User ID:", req.user?.id);

  const {
    vendorName,
    businessName,
    mobile,
    email,
    gst,
    address,
    bankAccount,
    expiryDate,
    status,
  } = req.body;

  // Validation
  if (!vendorName || !mobile) {
    console.log("❌ Validation Failed: Missing required fields");
    return error(res, "Vendor name and mobile number are required", 400);
  }

  // Check if vendor with same mobile already exists
  const existingVendor = await VendorModel.findOne({
    where: { mobile },
  });

  if (existingVendor) {
    console.log("❌ Vendor Creation Failed: Mobile number already exists");
    return error(res, "Vendor with this mobile number already exists", 409);
  }

  const vendor = await VendorModel.create({
    vendorName,
    businessName,
    mobile,
    email,
    gst,
    address,
    bankAccount,
    expiryDate,
    status: status || "Active",
    createdBy: req.user.id,
  });

  console.log("✅ Vendor Created Successfully:", vendor?.dataValues);

  success(res, vendor, "Vendor created successfully", 201);
});

exports.updateVendor = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Update Vendor Request:", req.params, req.body);

  const { id } = req.params;
  const vendor = await VendorModel.findByPk(id);
  console.log("🔍 Vendor Lookup Result:", vendor ? "Found" : "Not Found");

  if (!vendor) {
    console.log("❌ Vendor Update Failed: Vendor not found");
    return error(res, "Vendor not found", 404);
  }

  if (req.body.mobile && req.body.mobile !== vendor.mobile) {
    const existingVendor = await VendorModel.findOne({
      where: {
        mobile: req.body.mobile,
        id: { [Op.ne]: id },
      },
    });

    if (existingVendor) {
      return error(res, "Vendor with this mobile number already exists", 409);
    }
  }

  await vendor.update(req.body);
  console.log("✅ Vendor Updated Successfully:", vendor?.dataValues);

  success(res, vendor, "Vendor updated successfully");
});

exports.getVendors = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Get Vendors Request:", req.query);

  const { page = 1, size = 20, search, status } = req.query;
  const where = {};

  if (search) {
    where[Op.or] = [
      { vendorName: { [Op.like]: `%${search}%` } },
      { businessName: { [Op.like]: `%${search}%` } },
      { mobile: { [Op.like]: `%${search}%` } },
    ];
    console.log("🔎 Search Filter Applied");
  }

  if (status) {
    where.status = status;
    console.log("🔎 Status Filter Applied:", status);
  }

  const vendors = await VendorModel.findAndCountAll({
    where,
    limit: parseInt(size, 10),
    offset: (page - 1) * size,
    order: [["createdAt", "DESC"]],
  });

  console.log(`📦 Found ${vendors.count} vendors`);
  success(res, {
    total: vendors.count,
    rows: vendors.rows,
    page: parseInt(page),
    totalPages: Math.ceil(vendors.count / size),
  });
});

exports.getVendorById = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Get Vendor By ID Request:", req.params.id);

  const vendor = await VendorModel.findByPk(req.params.id);

  console.log("🔍 Vendor Lookup Result:", vendor ? "Found" : "Not Found");

  if (!vendor) {
    console.log("❌ Vendor not found with ID:", req.params.id);
    return error(res, "Vendor not found", 404);
  }

  console.log("✅ Vendor Data Retrieved Successfully");
  success(res, vendor);
});

exports.deleteVendor = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Delete Vendor Request:", req.params.id);

  const vendor = await VendorModel.findByPk(req.params.id);
  console.log("🔍 Vendor Lookup Result:", vendor ? "Found" : "Not Found");

  if (!vendor) {
    console.log("❌ Delete Failed: Vendor not found");
    return error(res, "Vendor not found", 404);
  }

  await vendor.destroy();
  console.log("🗑️ Vendor Deleted Successfully:", req.params.id);

  success(res, null, "Vendor deleted successfully", 200);
});
