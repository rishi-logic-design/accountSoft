const productService = require("../services/productService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

// ========== CATEGORY MANAGEMENT ==========

// Create new category
exports.createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return error(res, "Category name is required", 400);
  }

  const cat = await productService.createCategory({ name, description });
  success(res, cat, "Category created successfully", 201);
});

// List all categories
exports.listCategories = asyncHandler(async (req, res) => {
  const rows = await productService.listCategories();
  success(res, rows, "Categories fetched successfully");
});

// Update category
exports.updateCategory = asyncHandler(async (req, res) => {
  const cat = await productService.updateCategory(req.params.id, req.body);
  success(res, cat, "Category updated successfully");
});

// Delete category
exports.deleteCategory = asyncHandler(async (req, res) => {
  await productService.deleteCategory(req.params.id);
  success(res, null, "Category deleted successfully");
});

// ========== SIZE MANAGEMENT ==========

// Create new size
exports.createSize = asyncHandler(async (req, res) => {
  const { label, inches } = req.body;

  if (!label || !inches) {
    return error(res, "Label and inches are required", 400);
  }

  const s = await productService.createSize({ label, inches });
  success(res, s, "Size created successfully", 201);
});

// List all sizes
exports.listSizes = asyncHandler(async (req, res) => {
  const rows = await productService.listSizes();
  success(res, rows, "Sizes fetched successfully");
});

// Update size
exports.updateSize = asyncHandler(async (req, res) => {
  const s = await productService.updateSize(req.params.id, req.body);
  success(res, s, "Size updated successfully");
});

// Delete size
exports.deleteSize = asyncHandler(async (req, res) => {
  await productService.deleteSize(req.params.id);
  success(res, null, "Size deleted successfully");
});

// ========== PRODUCT MANAGEMENT ==========

// Create product with name, category, and sizes
exports.createProduct = asyncHandler(async (req, res) => {
  const { name, sku, description, price, stock, categoryId, sizes } = req.body;

  // Validation
  if (!name) {
    return error(res, "Product name is required", 400);
  }

  if (!categoryId) {
    return error(res, "Category is required", 400);
  }

  if (!sizes || !Array.isArray(sizes) || sizes.length === 0) {
    return error(res, "At least one size is required", 400);
  }

  // Get vendor ID
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;

  const product = await productService.createProduct(vendorId, {
    name,
    sku,
    description,
    price,
    stock,
    categoryId,
    sizes, // Array of { sizeId, stock, price }
  });

  success(res, product, "Product created successfully", 201);
});

// Update product
exports.updateProduct = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;

  const p = await productService.updateProduct(
    vendorId,
    req.params.id,
    req.body
  );
  success(res, p, "Product updated successfully");
});

// Delete product
exports.deleteProduct = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : req.query.vendorId || req.user.id;

  await productService.deleteProduct(vendorId, req.params.id);
  success(res, null, "Product deleted successfully");
});

// List products with filters
exports.listProducts = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : req.query.vendorId || req.user.id;

  const { categoryId, sizeId, search, page, limit } = req.query;

  const list = await productService.listProducts({
    vendorId,
    categoryId,
    sizeId,
    search,
    page: page || 1,
    limit: limit || 20,
  });

  success(res, list, "Products fetched successfully");
});

// Get single product detail
exports.getProductDetail = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : req.query.vendorId || req.user.id;

  const p = await productService.getProductDetail(vendorId, req.params.id);
  success(res, p, "Product details fetched successfully");
});

// ========== STOCK MANAGEMENT ==========

exports.changeStock = asyncHandler(async (req, res) => {
  const { productId, sizeId, quantity, operation } = req.body;

  if (!productId || !quantity || !operation) {
    return error(res, "productId, quantity, and operation are required", 400);
  }

  if (!["add", "subtract", "set"].includes(operation)) {
    return error(res, "operation must be: add, subtract, or set", 400);
  }

  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;

  await productService.changeStock(vendorId, {
    productId,
    sizeId,
    quantity,
    operation,
  });

  success(res, null, "Stock updated successfully");
});
