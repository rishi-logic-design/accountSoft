const { InventoryModel, InventoryCategoryModel } = require("../../models");
const { Op } = require("sequelize");

exports.createCategory = async (vendorId, data) => {
  const { name, description } = data;

  const existing = await InventoryCategoryModel.findOne({
    where: { name, vendorId },
  });

  if (existing) {
    throw new Error("Category already exists");
  }

  return await InventoryCategoryModel.create({
    name,
    description,
    vendorId,
  });
};

exports.listCategories = async (vendorId) => {
  const categories = await InventoryCategoryModel.findAll({
    where: { vendorId },
    include: [
      {
        model: InventoryModel,
        as: "items",
        attributes: ["currentStock"],
      },
    ],
  });

  // Calculate total stock per category
  return categories.map((cat) => {
    const totalStock = cat.items
      ? cat.items.reduce((sum, item) => sum + (item.currentStock || 0), 0)
      : 0;
    const plain = cat.get({ plain: true });
    plain.stock = totalStock;
    delete plain.items;
    return plain;
  });
};

exports.updateCategory = async (vendorId, id, data) => {
  const category = await InventoryCategoryModel.findOne({
    where: { id, vendorId },
  });

  if (!category) throw new Error("Category not found");

  return await category.update(data);
};

exports.deleteCategory = async (vendorId, id) => {
  const category = await InventoryCategoryModel.findOne({
    where: { id, vendorId },
  });

  if (!category) throw new Error("Category not found");

  // Check if items exist
  const count = await InventoryModel.count({ where: { categoryId: id } });
  if (count > 0) throw new Error("Cannot delete category with items");

  return await category.destroy();
};

exports.createItem = async (vendorId, data) => {
  return await InventoryModel.create({
    ...data,
    vendorId,
    currentStock: data.openingStock || 0,
  });
};

exports.listItems = async (vendorId, query) => {
  const { search, categoryId, page = 1, limit = 10 } = query;

  const where = { vendorId };

  if (search) {
    where.name = { [Op.like]: `%${search}%` };
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  const offset = (page - 1) * limit;

  const { count, rows } = await InventoryModel.findAndCountAll({
    where,
    include: [
      {
        model: InventoryCategoryModel,
        as: "category",
        attributes: ["name"],
      },
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [["createdAt", "DESC"]],
  });

  return {
    items: rows.map((item) => {
      const plain = item.get({ plain: true });
      plain.stockValue = (plain.currentStock || 0) * (plain.purchasePrice || 0);
      return plain;
    }),
    total: count,
    page: parseInt(page),
    limit: parseInt(limit),
  };
};

exports.updateItem = async (vendorId, id, data) => {
  const item = await InventoryModel.findOne({
    where: { id, vendorId },
  });

  if (!item) throw new Error("Item not found");

  return await item.update(data);
};

exports.deleteItem = async (vendorId, id) => {
  const item = await InventoryModel.findOne({
    where: { id, vendorId },
  });

  if (!item) throw new Error("Item not found");

  return await item.destroy();
};

exports.getDashboardStats = async (vendorId) => {
  const items = await InventoryModel.findAll({
    where: { vendorId },
  });

  const totalItems = items.length;
  const lowStock = items.filter(
    (item) => item.currentStock <= (item.lowStockThreshold || 10),
  ).length;
  const stockValue = items.reduce(
    (sum, item) => sum + item.currentStock * item.purchasePrice,
    0,
  );

  return {
    totalItems,
    lowStock,
    stockValue,
  };
};
