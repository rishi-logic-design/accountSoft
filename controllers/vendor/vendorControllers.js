const { VendorModel, SubscriptionModel, PlanModel } = require("../../models/vendor/vendorModel");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const { Op } = require("sequelize");
// 🟢 Create Vendor
exports.createVendor = asyncHandler(async (req, res) => {
  console.log("📥 Incoming Create Vendor Request:", req.body);
  console.log("👤 Created By User ID:", req.user?.id);

  const { vendorName, businessName, address, subscriptionDate, expiryDate } = req.body;

  const vendor = await VendorModel.create({
    vendorName,
    businessName,
    address,
    subscriptionDate,
    expiryDate,
    createdBy: req.user.id,
  });

  console.log("✅ Vendor Created Successfully:", vendor?.dataValues);

  success(res, vendor, "Vendor created", 201);
});

// 🟣 Update Vendor
exports.updateVendor = asyncHandler(async (req, res) => {
  console.log("📥 Incoming Update Vendor Request:", req.params, req.body);

  const { id } = req.params;
  const vendor = await VendorModel.findByPk(id);
  console.log("🔍 Vendor Lookup Result:", vendor ? "Found" : "Not Found");

  if (!vendor) {
    console.log("❌ Vendor Update Failed: Vendor not found");
    return error(res, "Vendor not found", 404);
  }

  await vendor.update(req.body);
  console.log("✅ Vendor Updated Successfully:", vendor?.dataValues);

  success(res, vendor, "Vendor updated");
});

// 🟠 Get All Vendors
exports.getVendors = asyncHandler(async (req, res) => {
  console.log("📥 Incoming Get Vendors Request:", req.query);

  const { page = 1, size = 20, search } = req.query;
  const where = {};

  if (search) {
    where.vendorName = { [Op.like]: `%${search}%` };
    console.log("🔎 Search Filter Applied:", where.vendorName);
  }

  const vendors = await VendorModel.findAndCountAll({
    where,
    limit: parseInt(size, 10),
    offset: (page - 1) * size,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: SubscriptionModel,
        as: "subscription",
        include: [{ model: PlanModel, as: "plan" }],
      },
    ],
  });

  console.log(`📦 Found ${vendors.count} vendors`);
  success(res, { total: vendors.count, rows: vendors.rows });
});

// 🔵 Get Vendor by ID
exports.getVendorById = asyncHandler(async (req, res) => {
  console.log("📥 Incoming Get Vendor By ID Request:", req.params.id);

  const vendor = await VendorModel.findByPk(req.params.id, {
    include: [
      {
        model: SubscriptionModel,
        as: "subscription",
        include: [{ model: PlanModel, as: "plan" }],
      },
    ],
  });

  console.log("🔍 Vendor Lookup Result:", vendor ? "Found" : "Not Found");

  if (!vendor) {
    console.log("❌ Vendor not found with ID:", req.params.id);
    return error(res, "Not found", 404);
  }

  console.log("✅ Vendor Data Retrieved Successfully");
  success(res, vendor);
});

// 🔴 Delete Vendor
exports.deleteVendor = asyncHandler(async (req, res) => {
  console.log("📥 Incoming Delete Vendor Request:", req.params.id);

  const vendor = await VendorModel.findByPk(req.params.id);
  console.log("🔍 Vendor Lookup Result:", vendor ? "Found" : "Not Found");

  if (!vendor) {
    console.log("❌ Delete Failed: Vendor not found");
    return error(res, "Vendor not found", 404);
  }

  await vendor.destroy();
  console.log("🗑️ Vendor Deleted Successfully:", req.params.id);

  success(res, null, "Vendor deleted", 200);
});
