const { PurchaseModel, VendorVendorModel } = require("../../models");
const { Op } = require("sequelize");

function toNumber(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

exports.createPurchase = async (vendorId, payload) => {
  const {
    purchaseNumber,
    purchaseDate,
    totalAmount,
    sellerId,
    billImage,
    note,
  } = payload;

  if (!purchaseNumber) throw new Error("Purchase Invoice Number is required");
  if (!purchaseDate) throw new Error("Purchase Date is required");
  if (!sellerId) throw new Error("Seller selection is required");

  const amount = toNumber(totalAmount);

  return await PurchaseModel.create({
    purchaseNumber,
    purchaseDate,
    totalAmount: amount.toFixed(2),
    pendingAmount: amount.toFixed(2),
    paidAmount: "0.00",
    vendorId,
    sellerId,
    billImage: billImage || null,
    note: note || null,
    status: "unpaid",
  });
};

exports.listPurchases = async ({
  vendorId,
  page = 1,
  size = 20,
  search,
  status,
  fromDate,
  toDate,
} = {}) => {
  const where = { vendorId };

  if (status) where.status = status;

  if (fromDate || toDate) {
    where.purchaseDate = {};
    if (fromDate) where.purchaseDate[Op.gte] = fromDate;
    if (toDate) where.purchaseDate[Op.lte] = toDate;
  }

  if (search) {
    where[Op.or] = [
      { purchaseNumber: { [Op.like]: `%${search}%` } },
      { note: { [Op.like]: `%${search}%` } },
    ];
  }

  const result = await PurchaseModel.findAndCountAll({
    where,
    include: [{ model: VendorVendorModel, as: "seller" }],
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [["purchaseDate", "DESC"]],
  });

  return {
    total: result.count,
    rows: result.rows,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(result.count / Number(size)),
  };
};
exports.getPurchaseById = async (id, vendorId) => {
  const purchase = await PurchaseModel.findOne({
    where: { id, vendorId },
    include: [{ model: VendorVendorModel, as: "seller" }],
  });

  if (!purchase) throw new Error("Purchase bill not found");
  return purchase;
};

exports.deletePurchase = async (id, vendorId) => {
  const purchase = await PurchaseModel.findOne({
    where: { id, vendorId },
  });

  if (!purchase) throw new Error("Purchase bill not found");
  await purchase.destroy();
  return true;
};

exports.updatePurchaseStatus = async (id, vendorId, status) => {
  const purchase = await PurchaseModel.findOne({
    where: { id, vendorId },
  });

  if (!purchase) throw new Error("Purchase not found");
  purchase.status = status;
  await purchase.save();
  return purchase;
};
