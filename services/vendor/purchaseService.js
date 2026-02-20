const {
  PurchaseModel,
  PurchaseItemModel,
  VendorModel,
  VendorVendorModel,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");

function toNumber(v) {
  return parseFloat(v || 0);
}

exports.createPurchase = async (vendorId, payload) => {
  const {
    purchaseType,
    sellerId,
    prefix,
    purchaseNumber,
    purchaseDate,
    items = [],
    termsAndConditions = null,
    signature = null,
    status = "pending",
  } = payload;

  if (!sellerId) throw new Error("sellerId (Vendor's vendor) required");
  if (!purchaseNumber) throw new Error("purchaseNumber (Invoice) required");
  if (!purchaseDate) throw new Error("purchaseDate required");

  return await sequelize.transaction(async (t) => {
    const buyer = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!buyer) throw new Error("Buyer (Vendor) not found");

    const seller = await VendorVendorModel.findByPk(sellerId, {
      transaction: t,
    });
    if (!seller) throw new Error("Seller (Vendor's vendor) not found");

    let subtotal = 0;
    let gstTotal = 0;
    const purchaseItems = [];

    for (const item of items) {
      const qty = toNumber(item.qty || 1);
      const price = toNumber(item.price || 0);
      const amount = +(qty * price).toFixed(2);
      const gstPercent = toNumber(item.gstPercent || 0);
      const gstAmt = +((amount * gstPercent) / 100).toFixed(2);
      const totalWithGst = +(amount + gstAmt).toFixed(2);

      subtotal += amount;
      gstTotal += gstAmt;

      purchaseItems.push({
        itemName: item.itemName || "Item",
        hsn: item.hsn || null,
        qty,
        unit: item.unit || null,
        price,
        discount: toNumber(item.discount || 0),
        gstPercent,
        gstTotal: gstAmt,
        totalWithGst,
        productId: item.productId || null,
      });
    }

    const totalAmount = +(subtotal + gstTotal).toFixed(2);

    const purchase = await PurchaseModel.create(
      {
        purchaseType: purchaseType || "Tax Invoice",
        prefix: prefix || null,
        purchaseNumber,
        purchaseDate,
        vendorId,
        sellerId,
        subtotal: +subtotal.toFixed(2),
        gstTotal: +gstTotal.toFixed(2),
        totalAmount,
        termsAndConditions: termsAndConditions || null,
        signature: signature || null,
        status: status || "pending",
      },
      { transaction: t },
    );

    await PurchaseItemModel.bulkCreate(
      purchaseItems.map((i) => ({ ...i, purchaseId: purchase.id })),
      { transaction: t },
    );

    return await PurchaseModel.findByPk(purchase.id, {
      include: [
        { model: PurchaseItemModel, as: "items" },
        { model: VendorVendorModel, as: "seller" },
      ],
      transaction: t,
    });
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

  if (fromDate || toDate) {
    where.purchaseDate = {};
    if (fromDate) where.purchaseDate[Op.gte] = new Date(fromDate);
    if (toDate) where.purchaseDate[Op.lte] = new Date(toDate);
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where[Op.or] = [
      { purchaseNumber: { [Op.like]: `%${search}%` } },
      { prefix: { [Op.like]: `%${search}%` } },
    ];
  }

  const result = await PurchaseModel.findAndCountAll({
    where,
    include: [{ model: VendorVendorModel, as: "seller" }],
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [["purchaseDate", "DESC"]],
    distinct: true,
  });

  return {
    total: result.count,
    rows: result.rows,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(result.count / Number(size)),
  };
};

exports.getPurchaseById = async (purchaseId, vendorId) => {
  const purchase = await PurchaseModel.findOne({
    where: { id: purchaseId, vendorId },
    include: [
      { model: PurchaseItemModel, as: "items" },
      { model: VendorModel, as: "buyer" },
      { model: VendorVendorModel, as: "seller" },
    ],
  });

  if (!purchase) throw new Error("Purchase not found");
  return purchase;
};

exports.deletePurchase = async (purchaseId, vendorId) => {
  return await sequelize.transaction(async (t) => {
    const purchase = await PurchaseModel.findOne({
      where: { id: purchaseId, vendorId },
      transaction: t,
    });

    if (!purchase) throw new Error("Purchase not found");

    await PurchaseItemModel.destroy({
      where: { purchaseId: purchase.id },
      transaction: t,
    });

    await purchase.destroy({ transaction: t });
    return true;
  });
};

exports.updatePurchaseStatus = async (purchaseId, vendorId, status) => {
  const purchase = await PurchaseModel.findOne({
    where: { id: purchaseId, vendorId },
  });

  if (!purchase) throw new Error("Purchase not found");

  purchase.status = status;
  await purchase.save();
  return purchase;
};
