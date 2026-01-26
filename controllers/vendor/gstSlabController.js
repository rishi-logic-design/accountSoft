const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const gstSlabService = require("../../services/vendor/gstSlabService");

exports.createGstSlab = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;

  if (!vendorId) {
    return error(res, "Unauthorized", 401);
  }

  const { slabName, rate, priority, active } = req.body;

  // Validation
  if (!slabName || rate === undefined || rate === null) {
    return error(res, "Slab name and rate are required", 400);
  }

  if (rate < 0 || rate > 100) {
    return error(res, "GST rate must be between 0 and 100", 400);
  }

  // Check for duplicate slab name
  const existing = await gstSlabService.findBySlabName(vendorId, slabName);
  if (existing) {
    return error(res, "GST slab with this name already exists", 400);
  }

  const payload = {
    vendorId,
    slabName: slabName.trim(),
    rate: Number(rate),
    priority: priority !== undefined ? Number(priority) : 0,
    active: active !== undefined ? active : true,
  };

  const created = await gstSlabService.createGstSlab(payload);

  success(res, { gst: created }, "GST slab created successfully", 201);
});

exports.listGstSlabs = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;

  if (!vendorId) {
    return error(res, "Unauthorized", 401);
  }

  const includeInactive =
    req.query.includeInactive === "true" || req.query.includeInactive === "1";

  const slabs = await gstSlabService.listGstSlabs(vendorId, {
    includeInactive,
  });

  success(
    res,
    { gst: slabs, count: slabs.length },
    "GST slabs fetched successfully"
  );
});

exports.getGstSlab = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;

  if (!vendorId) {
    return error(res, "Unauthorized", 401);
  }

  const { id } = req.params;

  if (!id || isNaN(id)) {
    return error(res, "Invalid GST slab ID", 400);
  }

  const slab = await gstSlabService.getGstSlab(vendorId, Number(id));

  if (!slab) {
    return error(res, "GST slab not found", 404);
  }

  success(res, { gst: slab }, "GST slab fetched successfully");
});

exports.updateGstSlab = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;

  if (!vendorId) {
    return error(res, "Unauthorized", 401);
  }

  const { id } = req.params;

  if (!id || isNaN(id)) {
    return error(res, "Invalid GST slab ID", 400);
  }

  const { slabName, rate, priority, active } = req.body;

  // Check if slab exists
  const existing = await gstSlabService.getGstSlab(vendorId, Number(id));
  if (!existing) {
    return error(res, "GST slab not found", 404);
  }

  // Validation
  if (rate !== undefined && (rate < 0 || rate > 100)) {
    return error(res, "GST rate must be between 0 and 100", 400);
  }

  // Check for duplicate slab name if changing name
  if (slabName && slabName !== existing.slabName) {
    const duplicate = await gstSlabService.findBySlabName(vendorId, slabName);
    if (duplicate && duplicate.id !== Number(id)) {
      return error(res, "GST slab with this name already exists", 400);
    }
  }

  const updates = {};
  if (slabName !== undefined) updates.slabName = slabName.trim();
  if (rate !== undefined) updates.rate = Number(rate);
  if (priority !== undefined) updates.priority = Number(priority);
  if (active !== undefined) updates.active = active;

  const updated = await gstSlabService.updateGstSlab(
    vendorId,
    Number(id),
    updates
  );

  success(res, { gst: updated }, "GST slab updated successfully");
});

exports.deleteGstSlab = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;

  if (!vendorId) {
    return error(res, "Unauthorized", 401);
  }

  const { id } = req.params;

  if (!id || isNaN(id)) {
    return error(res, "Invalid GST slab ID", 400);
  }

  const hard = req.query.hard === "true" || req.query.hard === "1";

  // Check if slab exists
  const existing = await gstSlabService.getGstSlab(vendorId, Number(id));
  if (!existing) {
    return error(res, "GST slab not found", 404);
  }

  if (hard) {
    // Hard delete - permanently remove
    await gstSlabService.hardDeleteGstSlab(vendorId, Number(id));
    success(res, { id: Number(id) }, "GST slab permanently deleted");
  } else {
    // Soft delete - mark as inactive
    await gstSlabService.softDeleteGstSlab(vendorId, Number(id));
    success(res, { id: Number(id) }, "GST slab deactivated successfully");
  }
});

exports.toggleGstSlab = asyncHandler(async (req, res) => {
  const vendorId = req.user?.id;

  if (!vendorId) {
    return error(res, "Unauthorized", 401);
  }

  const { id } = req.params;

  if (!id || isNaN(id)) {
    return error(res, "Invalid GST slab ID", 400);
  }

  const slab = await gstSlabService.getGstSlab(vendorId, Number(id));

  if (!slab) {
    return error(res, "GST slab not found", 404);
  }

  const updated = await gstSlabService.updateGstSlab(vendorId, Number(id), {
    active: !slab.active,
  });

  success(
    res,
    { gst: updated },
    `GST slab ${updated.active ? "activated" : "deactivated"} successfully`
  );
});