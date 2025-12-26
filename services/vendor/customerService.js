const {
  ProductModel,
  CategoryModel,
  SizeModel,
  ProductSizeModel,
  CustomerModel,
  TransactionModel,
  VendorModel,
  sequelize,
} = require("../../models/index");
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");

exports.createCustomer = async (vendorId, payload) => {
  if (!payload.customerName || !payload.mobileNumber) {
    throw new Error("customerName and mobileNumber are required");
  }

  // Verify vendor exists
  const vendor = await VendorModel.findByPk(vendorId);
  if (!vendor) {
    throw new Error("Invalid vendor. Vendor does not exist.");
  }

  const existingCustomer = await CustomerModel.findOne({
    where: {
      mobileNumber: payload.mobileNumber,
      createdBy: vendorId,
    },
  });

  if (existingCustomer) {
    throw new Error("Customer with this mobile number already exists");
  }

  const customer = await CustomerModel.create({
    ...payload,
    createdBy: vendorId,
  });

  return customer;
};

exports.updateCustomer = async (vendorId, customerId, data) => {
  // Verify vendor exists
  const vendor = await VendorModel.findByPk(vendorId);
  if (!vendor) {
    throw new Error("Invalid vendor. Vendor does not exist.");
  }

  // Find customer
  const customer = await CustomerModel.findOne({
    where: { id: customerId, createdBy: vendorId },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  // Check for duplicate mobile number if being updated
  if (data.mobileNumber && data.mobileNumber !== customer.mobileNumber) {
    const existingCustomer = await CustomerModel.findOne({
      where: {
        mobileNumber: data.mobileNumber,
        createdBy: vendorId,
        id: { [Op.ne]: customerId },
      },
    });

    if (existingCustomer) {
      throw new Error("Customer with this mobile number already exists");
    }
  }

  // Delete old image if new image is uploaded
  if (data.customerImage && customer.customerImage && data.customerImage !== customer.customerImage) {
    try {
      const oldImagePath = path.join(__dirname, "../../", customer.customerImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
        console.log("🗑️ Old customer image deleted:", customer.customerImage);
      }
    } catch (err) {
      console.error("Error deleting old customer image:", err);
    }
  }

  // Update customer
  await customer.update(data);
  return customer;
};

exports.deleteCustomer = async (vendorId, customerId) => {
  // Verify vendor exists
  const vendor = await VendorModel.findByPk(vendorId);
  if (!vendor) {
    throw new Error("Invalid vendor. Vendor does not exist.");
  }

  // Find customer
  const customer = await CustomerModel.findOne({
    where: { id: customerId, createdBy: vendorId },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  // Delete customer image if exists
  if (customer.customerImage) {
    try {
      const imagePath = path.join(__dirname, "../../", customer.customerImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log("🗑️ Customer image deleted:", customer.customerImage);
      }
    } catch (err) {
      console.error("Error deleting customer image:", err);
    }
  }

  // Delete customer
  await customer.destroy();
  return true;
};

exports.getCustomerList = async (vendorId, { page = 1, size = 20, search } = {}) => {
  const where = { createdBy: vendorId };

  // Search filter
  if (search) {
    where[Op.or] = [
      { customerName: { [Op.like]: `%${search}%` } },
      { businessName: { [Op.like]: `%${search}%` } },
      { mobileNumber: { [Op.like]: `%${search}%` } },
    ];
  }

  // Fetch customers with pagination
  const result = await CustomerModel.findAndCountAll({
    where,
    limit: parseInt(size, 10),
    offset: (page - 1) * size,
    order: [["createdAt", "DESC"]],
  });

  return {
    total: result.count,
    rows: result.rows,
    page: parseInt(page),
    totalPages: Math.ceil(result.count / size),
  };
};

exports.getCustomerDetail = async (vendorId, customerId) => {
  // Find customer with transactions
  const customer = await CustomerModel.findOne({
    where: { id: customerId, createdBy: vendorId },
    include: [
      {
        model: TransactionModel,
        as: "transactions",
        order: [["transactionDate", "DESC"]],
      },
    ],
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  // Compute payment due
  const transactions = await TransactionModel.findAll({
    where: { customerId, vendorId },
  });

  let due = 0;
  transactions.forEach((t) => {
    if (t.type === "sale") {
      due += parseFloat(t.amount);
    } else if (t.type === "payment") {
      due -= parseFloat(t.amount);
    }
  });

  return { customer, transactions, due };
};


exports.addTransaction = async (vendorId, customerId, payload) => {
  return await sequelize.transaction(async (t) => {
    // Verify vendor exists
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) {
      throw new Error("Invalid vendor. Vendor does not exist.");
    }

    // Find customer
    const customer = await CustomerModel.findOne({
      where: { id: customerId, createdBy: vendorId },
      transaction: t,
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    // Create transaction
    const trx = await TransactionModel.create(
      {
        customerId,
        vendorId,
        amount: payload.amount,
        type: payload.type,
        description: payload.description || null,
        transactionDate: payload.transactionDate || new Date(),
        challanNumber: payload.challanNumber || null,
      },
      { transaction: t }
    );

    // Calculate due amount
    const transactions = await TransactionModel.findAll({
      where: { customerId, vendorId },
      transaction: t,
    });

    let due = 0;
    transactions.forEach((r) => {
      if (r.type === "sale") {
        due += parseFloat(r.amount);
      } else {
        due -= parseFloat(r.amount);
      }
    });

    return { transaction: trx, due };
  });
};

exports.getTransactionReport = async (vendorId, { fromDate, toDate, customerId } = {}) => {
  const where = { vendorId };

  // Date filters
  if (fromDate) {
    where.transactionDate = { [Op.gte]: fromDate };
  }

  if (toDate) {
    where.transactionDate = {
      ...(where.transactionDate || {}),
      [Op.lte]: toDate,
    };
  }

  // Customer filter
  if (customerId) {
    where.customerId = customerId;
  }

  // Fetch transactions
  const rows = await TransactionModel.findAll({
    where,
    include: [
      {
        model: CustomerModel,
        as: "customer",
        attributes: ["customerName", "businessName", "mobileNumber"],
      },
    ],
    order: [["transactionDate", "DESC"]],
  });

  return rows;
};


exports.createCategory = async (payload) => {
  return await CategoryModel.create(payload);
};

exports.listCategories = async () => {
  return CategoryModel.findAll({ order: [["name", "ASC"]] });
};

exports.createSize = async (payload) => {
  return SizeModel.create(payload);
};

exports.listSizes = async () => {
  return SizeModel.findAll({ order: [["inches", "ASC"]] });
};


exports.createProduct = async (vendorId, payload) => {
  const { name, sku, description, price, stock, categoryId, sizes } = payload;

  return await sequelize.transaction(async (t) => {
    // Verify vendor exists
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) {
      throw new Error("Invalid vendor. Vendor does not exist.");
    }

    // Create product
    const product = await ProductModel.create(
      {
        name,
        sku,
        description,
        price,
        stock: stock || 0,
        categoryId,
        createdBy: vendorId,
      },
      { transaction: t }
    );

    // Add product sizes if provided
    if (Array.isArray(sizes) && sizes.length) {
      const rows = sizes.map((s) => ({
        productId: product.id,
        sizeId: s.sizeId,
        stock: s.stock || 0,
        price: s.price || null,
      }));

      await ProductSizeModel.bulkCreate(rows, {
        transaction: t,
        ignoreDuplicates: true,
      });
    }

    return product;
  });
};

exports.updateProduct = async (vendorId, productId, data) => {
  return await sequelize.transaction(async (t) => {
    // Verify vendor exists
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) {
      throw new Error("Invalid vendor. Vendor does not exist.");
    }

    // Find product
    const product = await ProductModel.findOne({
      where: { id: productId, createdBy: vendorId },
      transaction: t,
    });

    if (!product) {
      throw new Error("Product not found");
    }

    // Update product
    await product.update(data, { transaction: t });

    // Update product sizes if provided
    if (data.sizes) {
      for (const s of data.sizes) {
        await ProductSizeModel.upsert(
          {
            productId,
            sizeId: s.sizeId,
            stock: s.stock || 0,
            price: s.price || null,
          },
          { transaction: t }
        );
      }
    }

    return product;
  });
};

exports.deleteProduct = async (vendorId, productId) => {
  // Verify vendor exists
  const vendor = await VendorModel.findByPk(vendorId);
  if (!vendor) {
    throw new Error("Invalid vendor. Vendor does not exist.");
  }

  // Find product
  const product = await ProductModel.findOne({
    where: { id: productId, createdBy: vendorId },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  // Delete product
  await product.destroy();
  return true;
};

exports.listProducts = async ({
  vendorId,
  categoryId,
  sizeId,
  search,
  page = 1,
  limit = 20,
}) => {
  const where = { createdBy: vendorId };

  // Category filter
  if (categoryId) {
    where.categoryId = categoryId;
  }

  // Search filter
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { sku: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }

  const include = [
    { model: CategoryModel, as: "category", attributes: ["id", "name"] },
    {
      model: ProductSizeModel,
      as: "productSizes",
      include: [
        { model: SizeModel, as: "size", attributes: ["id", "label", "inches"] },
      ],
    },
  ];

  // Size filter
  if (sizeId) {
    include.push({
      model: ProductSizeModel,
      as: "productSizes",
      where: { sizeId },
      required: true,
      include: [{ model: SizeModel, as: "size" }],
    });
  }

  // Fetch products
  const result = await ProductModel.findAndCountAll({
    where,
    include,
    limit: parseInt(limit, 10),
    offset: (page - 1) * limit,
    order: [["createdAt", "DESC"]],
    distinct: true,
  });

  return { total: result.count, rows: result.rows };
};

exports.getProductDetail = async (vendorId, productId) => {
  // Find product
  const product = await ProductModel.findOne({
    where: { id: productId, createdBy: vendorId },
    include: [
      { model: CategoryModel, as: "category" },
      {
        model: ProductSizeModel,
        as: "productSizes",
        include: [{ model: SizeModel, as: "size" }],
      },
    ],
  });

  if (!product) {
    throw new Error("Product not found");
  }

  return product;
};

exports.changeStock = async (vendorId, { productId, sizeId = null, delta = 0 }) => {
  return await sequelize.transaction(async (t) => {
    // Verify vendor exists
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) {
      throw new Error("Invalid vendor. Vendor does not exist.");
    }

    // Find product
    const product = await ProductModel.findOne({
      where: { id: productId, createdBy: vendorId },
      transaction: t,
    });

    if (!product) {
      throw new Error("Product not found");
    }

    if (sizeId) {
      // Update stock for specific size
      const ps = await ProductSizeModel.findOne({
        where: { productId, sizeId },
        transaction: t,
      });

      if (!ps) {
        throw new Error("Product size not found");
      }

      ps.stock = Math.max(0, (ps.stock || 0) + Number(delta));
      await ps.save({ transaction: t });
    } else {
      // Update general product stock
      product.stock = Math.max(0, (product.stock || 0) + Number(delta));
      await product.save({ transaction: t });
    }

    return true;
  });
};