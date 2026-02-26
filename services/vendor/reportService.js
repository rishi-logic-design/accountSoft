const {
  BillModel,
  BillItemModel,
  CustomerModel,
  PurchaseModel,
  PurchaseItemModel,
  VendorVendorModel,
} = require("../../models");
const { Op, fn, col, literal } = require("sequelize");

function toNum(v) {
  return parseFloat(v || 0);
}

exports.getProductWiseSalesReport = async (
  vendorId,
  { fromDate, toDate, search, page = 1, size = 10 } = {},
) => {
  const billWhere = { vendorId, status: { [Op.ne]: "cancelled" } };

  if (fromDate || toDate) {
    billWhere.billDate = {};
    if (fromDate) billWhere.billDate[Op.gte] = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      billWhere.billDate[Op.lte] = end;
    }
  }

  const bills = await BillModel.findAll({
    where: billWhere,
    attributes: ["id"],
    raw: true,
  });

  const billIds = bills.map((b) => b.id);

  if (billIds.length === 0) {
    return {
      rows: [],
      total: 0,
      page: Number(page),
      size: Number(size),
      totalPages: 0,
      grandTotalAmount: 0,
      grandTotalQty: 0,
    };
  }

  const itemWhere = { billId: { [Op.in]: billIds } };
  if (search) {
    itemWhere.itemName = { [Op.like]: `%${search}%` };
  }

  const grouped = await BillItemModel.findAll({
    where: itemWhere,
    attributes: [
      "itemName",
      [fn("SUM", col("qty")), "totalQty"],
      [fn("SUM", col("totalWithGst")), "totalAmount"],
      [fn("COUNT", col("id")), "orderCount"],
    ],
    group: ["itemName"],
    order: [[literal("totalAmount"), "DESC"]],
    raw: true,
  });

  const total = grouped.length;
  const paged = grouped.slice(
    (Number(page) - 1) * Number(size),
    Number(page) * Number(size),
  );

  const grandTotalAmount = grouped.reduce(
    (s, r) => s + toNum(r.totalAmount),
    0,
  );
  const grandTotalQty = grouped.reduce((s, r) => s + toNum(r.totalQty), 0);

  return {
    rows: paged.map((r, i) => ({
      serialNo: (Number(page) - 1) * Number(size) + i + 1,
      productName: r.itemName,
      totalQty: toNum(r.totalQty),
      totalAmount: +toNum(r.totalAmount).toFixed(2),
      orderCount: Number(r.orderCount),
    })),
    total,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(total / Number(size)),
    grandTotalAmount: +grandTotalAmount.toFixed(2),
    grandTotalQty: +grandTotalQty.toFixed(2),
  };
};

exports.getProductWisePurchaseReport = async (
  vendorId,
  { fromDate, toDate, search, page = 1, size = 10 } = {},
) => {
  const purchaseWhere = { vendorId, status: { [Op.ne]: "cancelled" } };

  if (fromDate || toDate) {
    purchaseWhere.purchaseDate = {};
    if (fromDate) purchaseWhere.purchaseDate[Op.gte] = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      purchaseWhere.purchaseDate[Op.lte] = end;
    }
  }

  const purchases = await PurchaseModel.findAll({
    where: purchaseWhere,
    attributes: ["id"],
    raw: true,
  });

  const purchaseIds = purchases.map((p) => p.id);

  if (purchaseIds.length === 0) {
    return {
      rows: [],
      total: 0,
      page: Number(page),
      size: Number(size),
      totalPages: 0,
      grandTotalAmount: 0,
      grandTotalQty: 0,
    };
  }

  const itemWhere = { purchaseId: { [Op.in]: purchaseIds } };
  if (search) {
    itemWhere.itemName = { [Op.like]: `%${search}%` };
  }

  const grouped = await PurchaseItemModel.findAll({
    where: itemWhere,
    attributes: [
      "itemName",
      [fn("SUM", col("qty")), "totalQty"],
      [fn("SUM", col("totalWithGst")), "totalAmount"],
      [fn("COUNT", col("id")), "orderCount"],
    ],
    group: ["itemName"],
    order: [[literal("totalAmount"), "DESC"]],
    raw: true,
  });

  const total = grouped.length;
  const paged = grouped.slice(
    (Number(page) - 1) * Number(size),
    Number(page) * Number(size),
  );

  const grandTotalAmount = grouped.reduce(
    (s, r) => s + toNum(r.totalAmount),
    0,
  );
  const grandTotalQty = grouped.reduce((s, r) => s + toNum(r.totalQty), 0);

  return {
    rows: paged.map((r, i) => ({
      serialNo: (Number(page) - 1) * Number(size) + i + 1,
      productName: r.itemName,
      totalQty: +toNum(r.totalQty).toFixed(2),
      totalAmount: +toNum(r.totalAmount).toFixed(2),
      orderCount: Number(r.orderCount),
    })),
    total,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(total / Number(size)),
    grandTotalAmount: +grandTotalAmount.toFixed(2),
    grandTotalQty: +grandTotalQty.toFixed(2),
  };
};

exports.getPartyWiseSalesReport = async (
  vendorId,
  { fromDate, toDate, search, page = 1, size = 10 } = {},
) => {
  const billWhere = { vendorId, status: { [Op.ne]: "cancelled" } };

  if (fromDate || toDate) {
    billWhere.billDate = {};
    if (fromDate) billWhere.billDate[Op.gte] = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      billWhere.billDate[Op.lte] = end;
    }
  }

  const customerWhere = {};
  if (search) {
    customerWhere[Op.or] = [
      { customerName: { [Op.like]: `%${search}%` } },
      { businessName: { [Op.like]: `%${search}%` } },
    ];
  }

  const grouped = await BillModel.findAll({
    where: billWhere,
    attributes: [
      "customerId",
      [fn("SUM", col("bills.totalAmount")), "totalAmount"],
      [fn("COUNT", col("bills.id")), "invoiceCount"],
    ],
    include: [
      {
        model: CustomerModel,
        as: "customer",
        attributes: ["id", "customerName", "businessName"],
        where: Object.keys(customerWhere).length ? customerWhere : undefined,
        required: !!search,
      },
    ],
    group: [
      "customerId",
      "customer.id",
      "customer.customerName",
      "customer.businessName",
    ],
    order: [[literal("totalAmount"), "DESC"]],
    raw: true,
    nest: true,
  });

  const total = grouped.length;
  const paged = grouped.slice(
    (Number(page) - 1) * Number(size),
    Number(page) * Number(size),
  );

  const grandTotalAmount = grouped.reduce(
    (s, r) => s + toNum(r.totalAmount),
    0,
  );

  return {
    rows: paged.map((r, i) => ({
      serialNo: (Number(page) - 1) * Number(size) + i + 1,
      buyerName:
        r.customer?.customerName || r.customer?.businessName || "Unknown",
      businessName: r.customer?.businessName || "",
      customerId: r.customerId,
      totalAmount: +toNum(r.totalAmount).toFixed(2),
      invoiceCount: Number(r.invoiceCount),
    })),
    total,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(total / Number(size)),
    grandTotalAmount: +grandTotalAmount.toFixed(2),
  };
};

exports.getPartyWisePurchaseReport = async (
  vendorId,
  { fromDate, toDate, search, page = 1, size = 10 } = {},
) => {
  const purchaseWhere = { vendorId, status: { [Op.ne]: "cancelled" } };

  if (fromDate || toDate) {
    purchaseWhere.purchaseDate = {};
    if (fromDate) purchaseWhere.purchaseDate[Op.gte] = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      purchaseWhere.purchaseDate[Op.lte] = end;
    }
  }

  const sellerWhere = {};
  if (search) {
    sellerWhere[Op.or] = [{ vendorName: { [Op.like]: `%${search}%` } }];
  }

  const grouped = await PurchaseModel.findAll({
    where: purchaseWhere,
    attributes: [
      "sellerId",
      [fn("SUM", col("purchases.totalAmount")), "totalAmount"],
      [fn("COUNT", col("purchases.id")), "purchaseCount"],
    ],
    include: [
      {
        model: VendorVendorModel,
        as: "seller",
        attributes: ["id", "vendorName", "mobile"],
        where: Object.keys(sellerWhere).length ? sellerWhere : undefined,
        required: !!search,
      },
    ],
    group: ["sellerId", "seller.id", "seller.vendorName", "seller.mobile"],
    order: [[literal("totalAmount"), "DESC"]],
    raw: true,
    nest: true,
  });

  const total = grouped.length;
  const paged = grouped.slice(
    (Number(page) - 1) * Number(size),
    Number(page) * Number(size),
  );

  const grandTotalAmount = grouped.reduce(
    (s, r) => s + toNum(r.totalAmount),
    0,
  );

  return {
    rows: paged.map((r, i) => ({
      serialNo: (Number(page) - 1) * Number(size) + i + 1,
      sellerName: r.seller?.vendorName || "Unknown",
      sellerId: r.sellerId,
      totalAmount: +toNum(r.totalAmount).toFixed(2),
      purchaseCount: Number(r.purchaseCount),
    })),
    total,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(total / Number(size)),
    grandTotalAmount: +grandTotalAmount.toFixed(2),
  };
};
