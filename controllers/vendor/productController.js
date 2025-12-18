const productService = require("../services/productService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

exports.createCategory = asyncHandler(async (req, res) => {
  const cat = await productService.createCategory(req.body);
  success(res, cat, "Category created", 201);
});
exports.listCategories = asyncHandler(async (req, res) => {
  const rows = await productService.listCategories();
  success(res, rows);
});

exports.createSize = asyncHandler(async (req, res) => {
  const s = await productService.createSize(req.body);
  success(res, s, "Size created", 201);
});
exports.listSizes = asyncHandler(async (req, res) => {
  const rows = await productService.listSizes();
  success(res, rows);
});

exports.createProduct = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const product = await productService.createProduct(vendorId, req.body);
  success(res, product, "Product created", 201);
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const p = await productService.updateProduct(
    vendorId,
    req.params.id,
    req.body
  );
  success(res, p, "Product updated");
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : req.query.vendorId || req.user.id;
  await productService.deleteProduct(vendorId, req.params.id);
  success(res, null, "Product deleted");
});

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
  success(res, list);
});

exports.getProductDetail = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : req.query.vendorId || req.user.id;
  const p = await productService.getProductDetail(vendorId, req.params.id);
  success(res, p);
});

exports.changeStock = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  await productService.changeStock(vendorId, req.body);
  success(res, null, "Stock updated");
});
