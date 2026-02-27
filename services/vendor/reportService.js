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

exports.getGSTSalesReport = async (
  vendorId,
  { fromDate, toDate, search, page = 1, size = 10 } = {},
) => {
  const where = { vendorId, status: { [Op.ne]: "cancelled" } };

  if (fromDate || toDate) {
    where.billDate = {};
    if (fromDate) where.billDate[Op.gte] = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      where.billDate[Op.lte] = end;
    }
  }

  const customerWhere = {};
  if (search) {
    customerWhere[Op.or] = [
      { customerName: { [Op.like]: `%${search}%` } },
      { businessName: { [Op.like]: `%${search}%` } },
    ];
  }

  const bills = await BillModel.findAll({
    where,
    include: [
      {
        model: CustomerModel,
        as: "customer",
        attributes: ["id", "customerName", "businessName", "gstNumber"],
        where: Object.keys(customerWhere).length ? customerWhere : undefined,
        required: !!search,
      },
    ],
    order: [["billDate", "DESC"]],
    raw: true,
    nest: true,
  });

  const total = bills.length;
  const paged = bills.slice(
    (Number(page) - 1) * Number(size),
    Number(page) * Number(size),
  );

  const grandTaxable = bills.reduce(
    (s, b) => s + toNum(b.totalWithoutGST || b.subtotal),
    0,
  );
  const grandGST = bills.reduce((s, b) => s + toNum(b.gstTotal), 0);
  const grandTotal = bills.reduce((s, b) => s + toNum(b.totalAmount), 0);

  return {
    rows: paged.map((b, i) => {
      const taxable = +toNum(b.totalWithoutGST || b.subtotal).toFixed(2);
      const igst = +toNum(b.gstTotal).toFixed(2); // Show full GST as IGST
      return {
        serialNo: (Number(page) - 1) * Number(size) + i + 1,
        invoiceNo: b.billNumber,
        invoiceDate: b.billDate,
        buyerName: b.customer?.customerName || b.customer?.businessName || "—",
        buyerGST: b.customer?.gstNo || "—",
        taxableAmount: taxable,
        cgst: 0,
        sgst: 0,
        igst,
        cess: 0,
        totalAmount: +toNum(b.totalAmount).toFixed(2),
      };
    }),
    total,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(total / Number(size)),
    grandTaxable: +grandTaxable.toFixed(2),
    grandIGST: +grandGST.toFixed(2),
    grandTotal: +grandTotal.toFixed(2),
  };
};

/**
 * GST Purchase Report
 * Per-purchase GST breakdown: taxable, CGST, SGST, IGST, CESS, total
 * CGST = SGST = gstTotal/2  (intrastate), IGST = 0
 */
exports.getGSTPurchaseReport = async (
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
    sellerWhere.vendorName = { [Op.like]: `%${search}%` };
  }

  const purchases = await PurchaseModel.findAll({
    where: purchaseWhere,
    include: [
      {
        model: VendorVendorModel,
        as: "seller",
        attributes: ["id", "vendorName", "gst"],
        where: Object.keys(sellerWhere).length ? sellerWhere : undefined,
        required: !!search,
      },
      {
        model: PurchaseItemModel,
        as: "items",
        attributes: ["gstTotal", "totalWithGst", "price", "qty", "discount"],
      },
    ],
    order: [["purchaseDate", "DESC"]],
  });

  const total = purchases.length;
  const paged = purchases.slice(
    (Number(page) - 1) * Number(size),
    Number(page) * Number(size),
  );

  // Compute grand totals across all purchases
  let grandTaxable = 0,
    grandGST = 0,
    grandTotal = 0;
  purchases.forEach((p) => {
    const items = p.items || [];
    const taxable = items.reduce(
      (s, it) => s + toNum(it.totalWithGst) - toNum(it.gstTotal),
      0,
    );
    const gst = items.reduce((s, it) => s + toNum(it.gstTotal), 0);
    const total_ = items.reduce((s, it) => s + toNum(it.totalWithGst), 0);
    grandTaxable += taxable;
    grandGST += gst;
    grandTotal += total_;
  });

  return {
    rows: paged.map((p, i) => {
      const items = p.items || [];
      const taxable = +items
        .reduce((s, it) => s + toNum(it.totalWithGst) - toNum(it.gstTotal), 0)
        .toFixed(2);
      const gstAmt = +items
        .reduce((s, it) => s + toNum(it.gstTotal), 0)
        .toFixed(2);
      const totalAmt = +items
        .reduce((s, it) => s + toNum(it.totalWithGst), 0)
        .toFixed(2);
      const cgst = +(gstAmt / 2).toFixed(2);
      const sgst = +(gstAmt / 2).toFixed(2);
      return {
        serialNo: (Number(page) - 1) * Number(size) + i + 1,
        purchaseNo: p.purchaseNumber,
        purchaseDate: p.purchaseDate,
        sellerName: p.seller?.vendorName || "—",
        sellerGST: p.seller?.gst || "—",
        taxableAmount: taxable,
        cgst,
        sgst,
        igst: 0,
        cess: 0,
        totalAmount: totalAmt,
      };
    }),
    total,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(total / Number(size)),
    grandTaxable: +grandTaxable.toFixed(2),
    grandCGST: +(grandGST / 2).toFixed(2),
    grandSGST: +(grandGST / 2).toFixed(2),
    grandTotal: +grandTotal.toFixed(2),
  };
};

/**
 * Invoice Details Report
 * Item-level breakdown: one row per bill item with full GST details
 */
exports.getInvoiceDetailsReport = async (
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

  const bills = await BillModel.findAll({
    where: billWhere,
    include: [
      {
        model: CustomerModel,
        as: "customer",
        attributes: ["id", "customerName", "businessName", "gstNo"],
        where: Object.keys(customerWhere).length ? customerWhere : undefined,
        required: !!search,
      },
      {
        model: BillItemModel,
        as: "items",
        attributes: [
          "itemName",
          "hsn",
          "qty",
          "price",
          "discount",
          "gstPercent",
          "gstTotal",
          "totalWithGst",
        ],
      },
    ],
    order: [["billDate", "DESC"]],
  });

  // Flatten to one row per bill item
  const allRows = [];
  bills.forEach((bill) => {
    const partyName =
      bill.customer?.customerName || bill.customer?.businessName || "—";
    const gstNo = bill.customer?.gstNo || "—";
    (bill.items || []).forEach((item) => {
      const qty = toNum(item.qty);
      const rate = toNum(item.price);
      const discount = toNum(item.discount);
      const saleAmt = +(qty * rate - discount).toFixed(2);
      const gstPct = toNum(item.gstPercent);
      const gstAmt = toNum(item.gstTotal);
      const igst = +gstAmt.toFixed(2);
      const taxable = +saleAmt.toFixed(2);
      const grandTot = +(saleAmt + gstAmt).toFixed(2);

      allRows.push({
        billNumber: bill.billNumber,
        billDate: bill.billDate,
        partyName,
        gstNo,
        itemName: item.itemName,
        hsn: item.hsn || "—",
        qty,
        ratePerUnit: rate,
        saleAmount: saleAmt,
        gstPercent: gstPct,
        cgst: 0,
        sgst: 0,
        cess: 0,
        igst,
        taxableAmount: taxable,
        grandTotal: grandTot,
      });
    });
  });

  const total = allRows.length;
  const paged = allRows.slice(
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
  };
};
