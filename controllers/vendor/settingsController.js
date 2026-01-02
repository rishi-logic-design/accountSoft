const settingsService = require("../services/settings.service");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

exports.getFirm = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : Number(req.query.vendorId || req.user.id);
  const firm = await settingsService.getFirm(vendorId);
  success(res, firm || {}, "Firm fetched");
});

exports.upsertFirm = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : Number(req.body.vendorId || req.user.id);
  if (!req.body.firmName) return error(res, "firmName required", 400);
  const updated = await settingsService.upsertFirm(vendorId, req.body);
  success(res, updated, "Firm updated");
});

exports.createGstSlab = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : Number(req.body.vendorId || req.user.id);
  if (req.body.rate === undefined) return error(res, "rate required", 400);
  const slab = await settingsService.createGstSlab(vendorId, req.body);
  success(res, slab, "GST slab created", 201);
});

exports.listGstSlabs = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : Number(req.query.vendorId || req.user.id);
  const includeInactive = req.query.includeInactive === "true" || false;
  const rows = await settingsService.listGstSlabs(vendorId, {
    includeInactive,
  });
  success(res, rows);
});

exports.getGstSlab = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : Number(req.query.vendorId || req.user.id);
  const slab = await settingsService.getGstSlab(vendorId, req.params.id);
  success(res, slab);
});

exports.updateGstSlab = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : Number(req.body.vendorId || req.user.id);
  const updated = await settingsService.updateGstSlab(
    vendorId,
    req.params.id,
    req.body
  );
  success(res, updated, "GST slab updated");
});

exports.deleteGstSlab = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : Number(req.query.vendorId || req.user.id);
  // default soft delete
  await settingsService.deleteGstSlab(vendorId, req.params.id, true);
  success(res, null, "GST slab deactivated");
});
