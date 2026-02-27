const {
  BillModel,
  BillItemModel,
  CustomerModel,
  PurchaseModel,
  PurchaseItemModel,
  VendorVendorModel,
  InventoryModel,
  ChallanModel,
  ChallanItemModel,
  CreditNoteModel,
  SalesDebitNoteModel,
  PaymentModel,
  VendorModel,
  BulkExportModel,
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
        attributes: ["id", "customerName", "businessName", "gstNumber"],
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
    const gstNumber = bill.customer?.gstNumber || "—";
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
        gstNumber,
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

exports.getPurchaseDetailsReport = async (
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
        attributes: [
          "itemName",
          "qty",
          "price",
          "discount",
          "gstPercent",
          "gstTotal",
          "totalWithGst",
        ],
      },
    ],
    order: [["purchaseDate", "DESC"]],
  });

  // Flatten: one row per purchase item
  const allRows = [];
  purchases.forEach((purchase) => {
    const partyName = purchase.seller?.vendorName || "—";
    const gstNo = purchase.seller?.gst || "—";
    (purchase.items || []).forEach((item) => {
      const qty = toNum(item.qty);
      const rate = toNum(item.price);
      const discount = toNum(item.discount);
      const saleAmt = +(qty * rate - discount).toFixed(2);
      const gstPct = toNum(item.gstPercent);
      const gstAmt = toNum(item.gstTotal);
      const cgst = +(gstAmt / 2).toFixed(2);
      const sgst = +(gstAmt / 2).toFixed(2);
      const taxable = +saleAmt.toFixed(2);
      const grandTot = +(saleAmt + gstAmt).toFixed(2);

      allRows.push({
        purchaseNo: purchase.purchaseNumber,
        purchaseDate: purchase.purchaseDate,
        partyName,
        gstNo,
        itemName: item.itemName,
        hsn: "—",
        qty,
        ratePerUnit: rate,
        saleAmount: saleAmt,
        gstPercent: gstPct,
        cgst,
        sgst,
        cess: 0,
        igst: 0,
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

exports.getCurrentStockReport = async (
  vendorId,
  { search, page = 1, size = 10 } = {},
) => {
  const where = { vendorId };

  if (search) {
    where.name = { [Op.like]: `%${search}%` };
  }

  const { count, rows: items } = await InventoryModel.findAndCountAll({
    where,
    attributes: [
      "id",
      "name",
      "hsn",
      "currentStock",
      "purchasePrice",
      "salePrice",
      "unit",
      "openingStock",
    ],
    order: [["name", "ASC"]],
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
  });

  return {
    rows: items.map((item, i) => {
      const stock = Number(item.currentStock || 0);
      const purPrice = toNum(item.purchasePrice);
      const salPrice = toNum(item.salePrice);
      const stockValue = +(stock * purPrice).toFixed(2);
      const unit = item.unit || "";
      return {
        serialNo: (Number(page) - 1) * Number(size) + i + 1,
        itemCode: item.id,
        itemName: item.name,
        stockValue,
        purchasePrice: purPrice,
        salesPrice: salPrice,
        stockInHand: `${stock}${unit ? " " + unit : ""}`,
        stockQty: stock,
      };
    }),
    total: count,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(count / Number(size)),
  };
};

exports.getDeliveryChallanReport = async (
  vendorId,
  { fromDate, toDate, search, page = 1, size = 10 } = {},
) => {
  const where = { vendorId, status: { [Op.ne]: "cancelled" } };

  if (fromDate || toDate) {
    where.challanDate = {};
    if (fromDate) where.challanDate[Op.gte] = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      where.challanDate[Op.lte] = end;
    }
  }

  const customerWhere = {};
  if (search) {
    customerWhere[Op.or] = [
      { customerName: { [Op.like]: `%${search}%` } },
      { businessName: { [Op.like]: `%${search}%` } },
    ];
  }

  const challans = await ChallanModel.findAll({
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
    order: [["challanDate", "DESC"]],
  });

  const total = challans.length;
  const paged = challans.slice(
    (Number(page) - 1) * Number(size),
    Number(page) * Number(size),
  );

  return {
    rows: paged.map((c, i) => {
      const taxable = toNum(c.totalWithoutGST || c.subtotal);
      const igst = toNum(c.gstTotal);
      const total_ = toNum(c.totalWithGST);
      return {
        serialNo: (Number(page) - 1) * Number(size) + i + 1,
        challanNo: c.challanNumber,
        challanDate: c.challanDate,
        buyerName: c.customer?.customerName || c.customer?.businessName || "—",
        buyerGST: c.customer?.gstNumber || "—",
        taxableAmount: +taxable.toFixed(2),
        cgst: 0,
        sgst: 0,
        igst: +igst.toFixed(2),
        cess: 0,
        totalAmount: +total_.toFixed(2),
      };
    }),
    total,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(total / Number(size)),
  };
};

exports.getDeliveryChallanDetailsReport = async (
  vendorId,
  { fromDate, toDate, search, page = 1, size = 10 } = {},
) => {
  const where = { vendorId, status: { [Op.ne]: "cancelled" } };

  if (fromDate || toDate) {
    where.challanDate = {};
    if (fromDate) where.challanDate[Op.gte] = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      where.challanDate[Op.lte] = end;
    }
  }

  const customerWhere = {};
  if (search) {
    customerWhere[Op.or] = [
      { customerName: { [Op.like]: `%${search}%` } },
      { businessName: { [Op.like]: `%${search}%` } },
    ];
  }

  const challans = await ChallanModel.findAll({
    where,
    include: [
      {
        model: CustomerModel,
        as: "customer",
        attributes: ["id", "customerName", "businessName", "gstNumber"],
        where: Object.keys(customerWhere).length ? customerWhere : undefined,
        required: !!search,
      },
      {
        model: ChallanItemModel,
        as: "items",
        attributes: [
          "productName",
          "qty",
          "pricePerUnit",
          "amount",
          "gstPercent",
          "totalWithGst",
        ],
      },
    ],
    order: [["challanDate", "DESC"]],
  });

  const allRows = [];
  challans.forEach((ch) => {
    const partyName =
      ch.customer?.customerName || ch.customer?.businessName || "—";
    const gstNo = ch.customer?.gstNumber || "—";
    (ch.items || []).forEach((item) => {
      const saleAmt = toNum(item.amount);
      const gstPct = toNum(item.gstPercent);
      const total_ = toNum(item.totalWithGst);
      const gstAmt = total_ - saleAmt;
      const igst = +Math.max(gstAmt, 0).toFixed(2);
      allRows.push({
        challanNo: ch.challanNumber,
        challanDate: ch.challanDate,
        partyName,
        gstNo,
        itemName: item.productName,
        hsn: "—",
        qty: toNum(item.qty),
        ratePerUnit: toNum(item.pricePerUnit),
        saleAmount: +saleAmt.toFixed(2),
        gstPercent: gstPct,
        cgst: 0,
        sgst: 0,
        cess: 0,
        igst,
        taxableAmount: +saleAmt.toFixed(2),
        grandTotal: +total_.toFixed(2),
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

exports.getActivityLogs = async (
  vendorId,
  { fromDate, toDate, search, page = 1, size = 10 } = {},
) => {
  const vendor = await VendorModel.findByPk(vendorId);
  const mobile = vendor?.mobile || "+911111111111";

  const where = { vendorId };
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt[Op.gte] = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt[Op.lte] = end;
    }
  }

  const [invoices, purchases, challans, creditNotes, debitNotes, payments] =
    await Promise.all([
      BillModel.findAll({ where, limit: 100, order: [["createdAt", "DESC"]] }),
      PurchaseModel.findAll({
        where,
        limit: 100,
        order: [["createdAt", "DESC"]],
      }),
      ChallanModel.findAll({
        where,
        limit: 100,
        order: [["createdAt", "DESC"]],
      }),
      CreditNoteModel.findAll({
        where,
        limit: 100,
        order: [["createdAt", "DESC"]],
      }),
      SalesDebitNoteModel.findAll({
        where,
        limit: 100,
        order: [["createdAt", "DESC"]],
      }),
      PaymentModel.findAll({
        where,
        limit: 100,
        order: [["createdAt", "DESC"]],
      }),
    ]);

  let logs = [];

  invoices.forEach((i) =>
    logs.push({
      dateTime: i.createdAt,
      activity: `${mobile} Created Invoice`,
      docLink: i.billNumber,
      type: "Invoice",
      hasVersion: true,
    }),
  );

  purchases.forEach((p) =>
    logs.push({
      dateTime: p.createdAt,
      activity: `${mobile} Created Purchase`,
      docLink: p.id,
      type: "Purchase",
      hasVersion: true,
    }),
  );

  challans.forEach((c) =>
    logs.push({
      dateTime: c.createdAt,
      activity: `${mobile} Created Delivery Challan`,
      docLink: c.challanNumber,
      type: "Challan",
      hasVersion: false,
    }),
  );

  creditNotes.forEach((cn) =>
    logs.push({
      dateTime: cn.createdAt,
      activity: `${mobile} Created Credit Note`,
      docLink: cn.id,
      type: "Credit Note",
      hasVersion: true,
    }),
  );

  debitNotes.forEach((dn) =>
    logs.push({
      dateTime: dn.createdAt,
      activity: `${mobile} Created Sales Debit Note`,
      docLink: dn.id,
      type: "Debit Note",
      hasVersion: true,
    }),
  );

  payments.forEach((pay) => {
    const text =
      pay.type === "credit" ? "Payment Receipt" : "Payment Made Voucher";
    logs.push({
      dateTime: pay.createdAt,
      activity: `${mobile} Created ${text}`,
      docLink: pay.paymentNumber || pay.id,
      type: "Payment",
      hasVersion: false,
    });
  });

  // Merge and Sort
  logs.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

  // Filter
  if (search) {
    const s = search.toLowerCase();
    logs = logs.filter(
      (l) =>
        l.activity.toLowerCase().includes(s) ||
        String(l.docLink).toLowerCase().includes(s) ||
        l.type.toLowerCase().includes(s),
    );
  }

  const total = logs.length;
  const paged = logs.slice(
    (Number(page) - 1) * Number(size),
    Number(page) * Number(size),
  );

  return {
    rows: paged,
    total,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(total / Number(size)),
  };
};

exports.getBulkExports = async (vendorId, { page = 1, size = 10 } = {}) => {
  const { count, rows } = await BulkExportModel.findAndCountAll({
    where: { vendorId },
    order: [["createdAt", "DESC"]],
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
  });

  return {
    rows,
    total: count,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(count / Number(size)),
  };
};

exports.createBulkExport = async (
  vendorId,
  { documentType, fromDate, toDate },
) => {
  return await BulkExportModel.create({
    vendorId,
    documentType,
    fromDate,
    toDate,
    status: "Generated",
    requestedOn: new Date(),
    fileUrl: "#",
  });
};
