const { PurchaseModel, VendorVendorModel } = require("../../models");
const { Op } = require("sequelize");

function toNumber(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

exports.createPurchase = async (vendorId, payload) => {
  try {
    const vendorId = req.user.id;

    const {
      purchaseNumber,
      purchaseDate,
      totalAmount,
      sellerId,
      billImage,
      note,
    } = req.body;
    if (!purchaseNumber)
      return res
        .status(400)
        .json({ message: "Purchase Invoice Number is required" });
    if (!purchaseDate)
      return res.status(400).json({ message: "Purchase Date is required" });
    if (!sellerId)
      return res.status(400).json({ message: "Seller selection is required" });
    const amount = toNumber(totalAmount);
    const purchase = await PurchaseModel.create({
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
    res.status(201).json(purchase);
  } catch (error) {
    console.error("Create Purchase Error:", error);
    res.status(500).json({ message: error.message || "Internal Server Error" });
  }
};
exports.listPurchases = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { page = 1, size = 20, search, status, fromDate, toDate } = req.query;
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
    res.json({
      total: result.count,
      rows: result.rows,
      page: Number(page),
      size: Number(size),
      totalPages: Math.ceil(result.count / Number(size)),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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
