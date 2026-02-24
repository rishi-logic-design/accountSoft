const {
  PurchaseModel,
  VendorVendorModel,
  PurchaseItemModel,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");

function toNumber(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

exports.createPurchase = async (vendorId, payload) => {
  return await sequelize.transaction(async (t) => {
    try {
      const {
        purchaseNumber,
        purchaseDate,
        totalAmount,
        sellerId,
        billImage,
        note,
        items = [],
      } = payload;

      if (!purchaseNumber)
        throw new Error("Purchase Invoice Number is required");
      if (!purchaseDate) throw new Error("Purchase Date is required");
      if (!sellerId) throw new Error("Seller selection is required");

      const seller = await VendorVendorModel.findByPk(sellerId, {
        transaction: t,
      });
      if (!seller) {
        throw new Error(
          `Seller with ID ${sellerId} not found. Please use a valid Seller ID.`,
        );
      }

      const amount = toNumber(totalAmount);

      const purchase = await PurchaseModel.create(
        {
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
        },
        { transaction: t },
      );

      // Create items if any
      if (items && items.length > 0) {
        const itemRows = items.map((it) => ({
          purchaseId: purchase.id,
          productId: it.productId || null,
          itemName: it.itemName,
          hsn: it.hsn || null,
          qty: toNumber(it.qty) || 1,
          unit: it.unit || "",
          price: toNumber(it.price).toFixed(2),
          gstPercent: toNumber(it.gstPercent).toFixed(2),
          totalWithGst: toNumber(it.total || it.totalWithGst).toFixed(2),
        }));

        await PurchaseItemModel.bulkCreate(itemRows, { transaction: t });
      }

      return await PurchaseModel.findByPk(purchase.id, {
        include: [
          { model: VendorVendorModel, as: "seller" },
          { model: PurchaseItemModel, as: "items" },
        ],
        transaction: t,
      });
    } catch (err) {
      console.error("Error creating purchase:", err);
      throw err;
    }
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
    include: [
      { model: VendorVendorModel, as: "seller" },
      { model: PurchaseItemModel, as: "items" },
    ],
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
    include: [
      { model: VendorVendorModel, as: "seller" },
      { model: PurchaseItemModel, as: "items" },
    ],
  });

  if (!purchase) throw new Error("Purchase bill not found");
  return purchase;
};

exports.deletePurchase = async (id, vendorId) => {
  return await sequelize.transaction(async (t) => {
    const purchase = await PurchaseModel.findOne({
      where: { id, vendorId },
      transaction: t,
    });

    if (!purchase) throw new Error("Purchase bill not found");

    // Delete items first
    await PurchaseItemModel.destroy({
      where: { purchaseId: id },
      transaction: t,
    });

    await purchase.destroy({ transaction: t });
    return true;
  });
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
