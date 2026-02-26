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

  // Step 1: Aggregate bills grouped by customerId (no JOIN = no alias conflict)
  const grouped = await BillModel.findAll({
    where: billWhere,
    attributes: [
      "customerId",
      [fn("SUM", col("totalAmount")), "totalAmount"],
      [fn("COUNT", col("id")), "invoiceCount"],
    ],
    group: ["customerId"],
    order: [[literal("SUM(totalAmount)"), "DESC"]],
    raw: true,
  });

  // Step 2: Fetch customer names for the grouped IDs
  const customerIds = grouped.map((r) => r.customerId);
  const customers = customerIds.length
    ? await CustomerModel.findAll({
        where: { id: { [Op.in]: customerIds } },
        attributes: ["id", "customerName", "businessName"],
        raw: true,
      })
    : [];

  const customerMap = {};
  customers.forEach((c) => {
    customerMap[c.id] = c;
  });

  // Step 3: Merge + optional search filter
  let merged = grouped.map((r) => ({
    customerId: r.customerId,
    buyerName:
      customerMap[r.customerId]?.customerName ||
      customerMap[r.customerId]?.businessName ||
      "Unknown",
    businessName: customerMap[r.customerId]?.businessName || "",
    totalAmount: +toNum(r.totalAmount).toFixed(2),
    invoiceCount: Number(r.invoiceCount),
  }));

  if (search) {
    const s = search.toLowerCase();
    merged = merged.filter(
      (r) =>
        r.buyerName.toLowerCase().includes(s) ||
        r.businessName.toLowerCase().includes(s),
    );
  }

  const total = merged.length;
  const grandTotalAmount = merged.reduce((s, r) => s + r.totalAmount, 0);
  const paged = merged.slice(
    (Number(page) - 1) * Number(size),
    Number(page) * Number(size),
  );

  return {
    rows: paged.map((r, i) => ({
      serialNo: (Number(page) - 1) * Number(size) + i + 1,
      ...r,
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

  // Step 1: Aggregate purchases grouped by sellerId (no JOIN)
  const grouped = await PurchaseModel.findAll({
    where: purchaseWhere,
    attributes: [
      "sellerId",
      [fn("SUM", col("totalAmount")), "totalAmount"],
      [fn("COUNT", col("id")), "purchaseCount"],
    ],
    group: ["sellerId"],
    order: [[literal("SUM(totalAmount)"), "DESC"]],
    raw: true,
  });

  // Step 2: Fetch seller names
  const sellerIds = grouped.map((r) => r.sellerId);
  const sellers = sellerIds.length
    ? await VendorVendorModel.findAll({
        where: { id: { [Op.in]: sellerIds } },
        attributes: ["id", "vendorName", "mobile"],
        raw: true,
      })
    : [];

  const sellerMap = {};
  sellers.forEach((s) => {
    sellerMap[s.id] = s;
  });

  // Step 3: Merge + optional search filter
  let merged = grouped.map((r) => ({
    sellerId: r.sellerId,
    sellerName: sellerMap[r.sellerId]?.vendorName || "Unknown",
    totalAmount: +toNum(r.totalAmount).toFixed(2),
    purchaseCount: Number(r.purchaseCount),
  }));

  if (search) {
    const s = search.toLowerCase();
    merged = merged.filter((r) => r.sellerName.toLowerCase().includes(s));
  }

  const total = merged.length;
  const grandTotalAmount = merged.reduce((s, r) => s + r.totalAmount, 0);
  const paged = merged.slice(
    (Number(page) - 1) * Number(size),
    Number(page) * Number(size),
  );

  return {
    rows: paged.map((r, i) => ({
      serialNo: (Number(page) - 1) * Number(size) + i + 1,
      ...r,
    })),
    total,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(total / Number(size)),
    grandTotalAmount: +grandTotalAmount.toFixed(2),
  };
};
