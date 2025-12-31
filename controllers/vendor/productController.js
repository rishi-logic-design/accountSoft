const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const { Op } = require("sequelize");

const { Product, Category, Size, ProductSize } = require("../../models");

exports.createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return error(res, "Category name is required", 400);
  }

  const existingCat = await Category.findOne({ where: { name } });
  if (existingCat) {
    return error(res, "Category with this name already exists", 400);
  }

  const cat = await Category.create({ name, description });
  success(res, cat, "Category created successfully", 201);
});

exports.listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.findAll({
    order: [["name", "ASC"]],
  });
  success(res, categories, "Categories fetched successfully");
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  const cat = await Category.findByPk(id);
  if (!cat) {
    return error(res, "Category not found", 404);
  }

  if (name && name !== cat.name) {
    const existingCat = await Category.findOne({ where: { name } });
    if (existingCat) {
      return error(res, "Category with this name already exists", 400);
    }
  }

  await cat.update({ name, description });
  success(res, cat, "Category updated successfully");
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const cat = await Category.findByPk(id);
  if (!cat) {
    return error(res, "Category not found", 404);
  }

  const productsCount = await Product.count({ where: { categoryId: id } });
  if (productsCount > 0) {
    return error(
      res,
      "Cannot delete category. Products are associated with it",
      400
    );
  }

  await cat.destroy();
  success(res, null, "Category deleted successfully");
});

exports.createSize = asyncHandler(async (req, res) => {
  const { label, inches } = req.body;

  if (!label || !inches) {
    return error(res, "Label and inches are required", 400);
  }

  const existingSize = await Size.findOne({ where: { label } });
  if (existingSize) {
    return error(res, "Size with this label already exists", 400);
  }

  const size = await Size.create({ label, inches });
  success(res, size, "Size created successfully", 201);
});

exports.listSizes = asyncHandler(async (req, res) => {
  const sizes = await Size.findAll({
    order: [["inches", "ASC"]],
  });
  success(res, sizes, "Sizes fetched successfully");
});

exports.updateSize = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { label, inches } = req.body;

  const size = await Size.findByPk(id);
  if (!size) {
    return error(res, "Size not found", 404);
  }

  if (label && label !== size.label) {
    const existingSize = await Size.findOne({ where: { label } });
    if (existingSize) {
      return error(res, "Size with this label already exists", 400);
    }
  }

  await size.update({ label, inches });
  success(res, size, "Size updated successfully");
});

exports.deleteSize = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const size = await Size.findByPk(id);
  if (!size) {
    return error(res, "Size not found", 404);
  }

  const productSizesCount = await ProductSize.count({ where: { sizeId: id } });
  if (productSizesCount > 0) {
    return error(
      res,
      "Cannot delete size. Products are associated with it",
      400
    );
  }

  await size.destroy();
  success(res, null, "Size deleted successfully");
});

const getVendorId = (req) => {
  return req.user.role === "vendor" 
    ? req.user.id 
    : req.body.vendorId || req.query.vendorId || req.user.id;
};

const validateProductData = async (data) => {
  const errors = [];

  if (!data.name) {
    errors.push("Product name is required");
  }

  if (!data.categoryId) {
    errors.push("Category is required");
  } else {
    const category = await Category.findByPk(data.categoryId);
    if (!category) {
      errors.push("Category not found");
    }
  }

  if (!data.sizes || !Array.isArray(data.sizes) || data.sizes.length === 0) {
    errors.push("At least one size is required");
  } else {
    const sizeIds = data.sizes.map((s) => s.sizeId);
    const existingSizes = await Size.findAll({
      where: { id: { [Op.in]: sizeIds } },
    });

    if (existingSizes.length !== sizeIds.length) {
      errors.push("One or more sizes not found");
    }
  }

  return errors;
};

exports.createProduct = asyncHandler(async (req, res) => {
  const { name, sku, description, price, stock, categoryId, sizes } = req.body;

  // Validate product data
  const validationErrors = await validateProductData(req.body);
  if (validationErrors.length > 0) {
    return error(res, validationErrors.join(", "), 400);
  }

  // Check SKU uniqueness if provided
  if (sku) {
    const existingProduct = await Product.findOne({ where: { sku } });
    if (existingProduct) {
      return error(res, "Product with this SKU already exists", 400);
    }
  }

  const vendorId = getVendorId(req);

  // Create product
  const product = await Product.create({
    name,
    sku,
    description,
    price: price || 0,
    stock: stock || 0,
    categoryId,
    createdBy: vendorId,
  });

  // Create product sizes
  const productSizeData = sizes.map((s) => ({
    productId: product.id,
    sizeId: s.sizeId,
    stock: s.stock || 0,
    price: s.price || price || 0,
  }));

  await ProductSize.bulkCreate(productSizeData);

  // Fetch complete product with relations
  const fullProduct = await Product.findByPk(product.id, {
    include: [
      { model: Category, as: "category" },
      {
        model: ProductSize,
        as: "productSizes",
        include: [{ model: Size, as: "size" }],
      },
    ],
  });

  success(res, fullProduct, "Product created successfully", 201);
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, sku, description, price, stock, categoryId, sizes } = req.body;

  const vendorId = getVendorId(req);

  // Find product
  const product = await Product.findOne({
    where: { id, createdBy: vendorId },
  });

  if (!product) {
    return error(res, "Product not found or unauthorized", 404);
  }

  // Check SKU uniqueness if being updated
  if (sku && sku !== product.sku) {
    const existingProduct = await Product.findOne({ where: { sku } });
    if (existingProduct) {
      return error(res, "Product with this SKU already exists", 400);
    }
  }

  // Verify category if being updated
  if (categoryId && categoryId !== product.categoryId) {
    const category = await Category.findByPk(categoryId);
    if (!category) {
      return error(res, "Category not found", 404);
    }
  }

  // Update product
  await product.update({
    name: name || product.name,
    sku: sku !== undefined ? sku : product.sku,
    description: description !== undefined ? description : product.description,
    price: price !== undefined ? price : product.price,
    stock: stock !== undefined ? stock : product.stock,
    categoryId: categoryId || product.categoryId,
  });

  // Update sizes if provided
  if (sizes && Array.isArray(sizes) && sizes.length > 0) {
    await ProductSize.destroy({ where: { productId: product.id } });

    const sizeIds = sizes.map((s) => s.sizeId);
    const existingSizes = await Size.findAll({
      where: { id: { [Op.in]: sizeIds } },
    });

    if (existingSizes.length !== sizeIds.length) {
      return error(res, "One or more sizes not found", 404);
    }

    const productSizeData = sizes.map((s) => ({
      productId: product.id,
      sizeId: s.sizeId,
      stock: s.stock || 0,
      price: s.price || product.price,
    }));

    await ProductSize.bulkCreate(productSizeData);
  }

  // Fetch updated product with relations
  const updatedProduct = await Product.findByPk(product.id, {
    include: [
      { model: Category, as: "category" },
      {
        model: ProductSize,
        as: "productSizes",
        include: [{ model: Size, as: "size" }],
      },
    ],
  });

  success(res, updatedProduct, "Product updated successfully");
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vendorId = getVendorId(req);

  const product = await Product.findOne({
    where: { id, createdBy: vendorId },
  });

  if (!product) {
    return error(res, "Product not found or unauthorized", 404);
  }

  await ProductSize.destroy({ where: { productId: product.id } });
  await product.destroy();

  success(res, null, "Product deleted successfully");
});

exports.listProducts = asyncHandler(async (req, res) => {
  const vendorId = getVendorId(req);
  const { categoryId, sizeId, search, page = 1, limit = 20 } = req.query;

  // Build where clause
  const whereClause = { createdBy: vendorId };

  if (categoryId) {
    whereClause.categoryId = categoryId;
  }

  if (search) {
    whereClause[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
      { sku: { [Op.like]: `%${search}%` } },
    ];
  }

  // Build include clause
  const includeClause = [
    { model: Category, as: "category" },
    {
      model: ProductSize,
      as: "productSizes",
      include: [{ model: Size, as: "size" }],
      ...(sizeId && { where: { sizeId } }),
    },
  ];

  // Pagination
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows } = await Product.findAndCountAll({
    where: whereClause,
    include: includeClause,
    limit: parseInt(limit),
    offset: offset,
    order: [["createdAt", "DESC"]],
    distinct: true,
  });

  const result = {
    products: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
    },
  };

  success(res, result, "Products fetched successfully");
});

exports.getProductDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vendorId = getVendorId(req);

  const product = await Product.findOne({
    where: { id, createdBy: vendorId },
    include: [
      { model: Category, as: "category" },
      {
        model: ProductSize,
        as: "productSizes",
        include: [{ model: Size, as: "size" }],
      },
    ],
  });

  if (!product) {
    return error(res, "Product not found or unauthorized", 404);
  }

  success(res, product, "Product details fetched successfully");
});

exports.changeStock = asyncHandler(async (req, res) => {
  const { productId, sizeId, quantity, operation } = req.body;

  if (!productId || quantity === undefined || !operation) {
    return error(res, "productId, quantity, and operation are required", 400);
  }

  if (!["add", "subtract", "set"].includes(operation)) {
    return error(res, "operation must be: add, subtract, or set", 400);
  }

  const vendorId = getVendorId(req);

  const product = await Product.findOne({
    where: { id: productId, createdBy: vendorId },
  });

  if (!product) {
    return error(res, "Product not found or unauthorized", 404);
  }

  const qty = parseInt(quantity);

  if (sizeId) {
    // Update ProductSize stock
    const productSize = await ProductSize.findOne({
      where: { productId, sizeId },
    });

    if (!productSize) {
      return error(res, "Product size combination not found", 404);
    }

    let newStock = calculateNewStock(productSize.stock, qty, operation);
    await productSize.update({ stock: newStock });

    // Update total product stock
    const allSizes = await ProductSize.findAll({
      where: { productId },
      attributes: ["stock"],
    });
    const totalStock = allSizes.reduce((sum, s) => sum + s.stock, 0);
    await product.update({ stock: totalStock });
  } else {
    // Update main product stock
    let newStock = calculateNewStock(product.stock, qty, operation);
    await product.update({ stock: newStock });
  }

  success(res, null, "Stock updated successfully");
});

const calculateNewStock = (currentStock, quantity, operation) => {
  let newStock = currentStock;

  switch (operation) {
    case "add":
      newStock += quantity;
      break;
    case "subtract":
      newStock -= quantity;
      if (newStock < 0) newStock = 0;
      break;
    case "set":
      newStock = quantity;
      break;
  }

  return newStock;
};