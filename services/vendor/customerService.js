const {
  ProductModel,
  CategoryModel,
  SizeModel,
  ProductSizeModel,
  CustomerModel,
  TransactionModel,
  VendorModel,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");

exports.createCustomer = async (vendorId, payload) => {
  if (!payload.customerName || !payload.mobileNumber) {
    throw new Error("customerName and mobileNumber are required");
  }

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
  const vendor = await VendorModel.findByPk(vendorId);
  if (!vendor) {
    throw new Error("Invalid vendor. Vendor does not exist.");
  }

  const customer = await CustomerModel.findOne({
    where: { id: customerId, createdBy: vendorId },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

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

  await customer.update(data);
  return customer;
};

exports.deleteCustomer = async (vendorId, customerId) => {
  const vendor = await VendorModel.findByPk(vendorId);
  if (!vendor) {
    throw new Error("Invalid vendor. Vendor does not exist.");
  }

  const customer = await CustomerModel.findOne({
    where: { id: customerId, createdBy: vendorId },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  await customer.destroy();
  return true;
};

exports.getCustomerList = async (
  vendorId,
  { page = 1, size = 20, search } = {},
) => {
  const where = { createdBy: vendorId };

  if (search) {
    where[Op.or] = [
      { customerName: { [Op.like]: `%${search}%` } },
      { businessName: { [Op.like]: `%${search}%` } },
      { mobileNumber: { [Op.like]: `%${search}%` } },
    ];
  }

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

exports.searchCustomers = async (vendorId, searchQuery) => {
  if (!searchQuery || searchQuery.trim() === "") {
    throw new Error("Search query is required");
  }

  const vendor = await VendorModel.findByPk(vendorId);
  if (!vendor) {
    throw new Error("Invalid vendor. Vendor does not exist.");
  }

  const where = {
    createdBy: vendorId,
    [Op.or]: [
      { customerName: { [Op.like]: `%${searchQuery}%` } },
      { businessName: { [Op.like]: `%${searchQuery}%` } },
      { mobileNumber: { [Op.like]: `%${searchQuery}%` } },
    ],
  };

  const customers = await CustomerModel.findAll({
    where,
    limit: 50,
    order: [["createdAt", "DESC"]],
  });

  return customers;
};

exports.addTransaction = async (vendorId, customerId, payload) => {
  return await sequelize.transaction(async (t) => {
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) {
      throw new Error("Invalid vendor. Vendor does not exist.");
    }

    const customer = await CustomerModel.findOne({
      where: { id: customerId, createdBy: vendorId },
      transaction: t,
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

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
      { transaction: t },
    );

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

exports.getTransactionReport = async (
  vendorId,
  { fromDate, toDate, customerId } = {},
) => {
  const where = { vendorId };

  if (fromDate) {
    where.transactionDate = { [Op.gte]: fromDate };
  }

  if (toDate) {
    where.transactionDate = {
      ...(where.transactionDate || {}),
      [Op.lte]: toDate,
    };
  }

  if (customerId) {
    where.customerId = customerId;
  }

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

exports.getCustomerCountByVendor = async () => {
  const result = await CustomerModel.findAll({
    attributes: [
      "createdBy",
      [sequelize.fn("COUNT", sequelize.col("id")), "customerCount"],
    ],
    group: ["createdBy"],
  });

  return result.map((row) => ({
    vendorId: row.createdBy,
    customerCount: Number(row.get("customerCount")),
  }));
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
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) {
      throw new Error("Invalid vendor. Vendor does not exist.");
    }

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
      { transaction: t },
    );

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
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) {
      throw new Error("Invalid vendor. Vendor does not exist.");
    }

    const product = await ProductModel.findOne({
      where: { id: productId, createdBy: vendorId },
      transaction: t,
    });

    if (!product) {
      throw new Error("Product not found");
    }

    await product.update(data, { transaction: t });

    if (data.sizes) {
      for (const s of data.sizes) {
        await ProductSizeModel.upsert(
          {
            productId,
            sizeId: s.sizeId,
            stock: s.stock || 0,
            price: s.price || null,
          },
          { transaction: t },
        );
      }
    }

    return product;
  });
};

exports.deleteProduct = async (vendorId, productId) => {
  const vendor = await VendorModel.findByPk(vendorId);
  if (!vendor) {
    throw new Error("Invalid vendor. Vendor does not exist.");
  }

  const product = await ProductModel.findOne({
    where: { id: productId, createdBy: vendorId },
  });

  if (!product) {
    throw new Error("Product not found");
  }

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

  if (categoryId) {
    where.categoryId = categoryId;
  }

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

  if (sizeId) {
    include.push({
      model: ProductSizeModel,
      as: "productSizes",
      where: { sizeId },
      required: true,
      include: [{ model: SizeModel, as: "size" }],
    });
  }

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

exports.changeStock = async (
  vendorId,
  { productId, sizeId = null, delta = 0 },
) => {
  return await sequelize.transaction(async (t) => {
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) {
      throw new Error("Invalid vendor. Vendor does not exist.");
    }

    const product = await ProductModel.findOne({
      where: { id: productId, createdBy: vendorId },
      transaction: t,
    });

    if (!product) {
      throw new Error("Product not found");
    }

    if (sizeId) {
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
      product.stock = Math.max(0, (product.stock || 0) + Number(delta));
      await product.save({ transaction: t });
    }

    return true;
  });
};
