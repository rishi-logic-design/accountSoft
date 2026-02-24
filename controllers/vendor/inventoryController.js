const inventoryService = require("../../services/vendor/inventoryService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

// Category Controllers
exports.createCategory = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const category = await inventoryService.createCategory(vendorId, req.body);
  success(res, category, "Category created successfully", 201);
});

exports.listCategories = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const categories = await inventoryService.listCategories(vendorId);
  success(res, categories, "Categories fetched successfully");
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  const category = await inventoryService.updateCategory(
    vendorId,
    id,
    req.body,
  );
  success(res, category, "Category updated successfully");
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  await inventoryService.deleteCategory(vendorId, id);
  success(res, null, "Category deleted successfully");
});

// Item Controllers
exports.createItem = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const item = await inventoryService.createItem(vendorId, req.body);
  success(res, item, "Item created successfully", 201);
});

exports.listItems = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const result = await inventoryService.listItems(vendorId, req.query);
  success(res, result, "Items fetched successfully");
});

exports.updateItem = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  const item = await inventoryService.updateItem(vendorId, id, req.body);
  success(res, item, "Item updated successfully");
});

exports.deleteItem = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  await inventoryService.deleteItem(vendorId, id);
  success(res, null, "Item deleted successfully");
});

exports.getStats = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const stats = await inventoryService.getDashboardStats(vendorId);
  success(res, stats, "Inventory stats fetched successfully");
});
