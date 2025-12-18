const {
  BillModel,
  BillItemModel,
  ChallanModel,
  ChallanItemModel,
  TransactionModel,
  CustomerModel,
  VendorModel,
  sequelize,
} = require("../../models/index");
const { Op } = require("sequelize");
const { generateBillNumber } = require("../../utils/billUtil");
const PDFDocument = require("pdfkit");
const { whatsappLink } = require("../../utils/whatsappHelper");

function toNumber(v) {
  return parseFloat(v || 0);
}

exports.createBill = async (vendorId, payload) => {
  const {
    customerId,
    challanIds = [],
    items: rawItems = [],
    gstOption = true,
    note,
  } = payload;
  if (!customerId) throw new Error("customerId required");

  return await sequelize.transaction(async (t) => {
    // validate vendor & customer
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) throw new Error("Vendor not found");
    const customer = await CustomerModel.findByPk(customerId, {
      transaction: t,
    });
    if (!customer) throw new Error("Customer not found");

    // gather items: from challans (if provided) + manual items
    const items = [];

    if (Array.isArray(challanIds) && challanIds.length) {
      // fetch challans and their items; ensure they belong to vendor & customer
      const challans = await ChallanModel.findAll({
        where: { id: challanIds, vendorId, customerId },
        include: [{ model: ChallanItemModel, as: "items" }],
        transaction: t,
      });

      if (challans.length !== challanIds.length)
        throw new Error("One or more challans invalid/unavailable");

      // Flatten challan items as bill items
      for (const ch of challans) {
        for (const it of ch.items) {
          const qty = toNumber(it.qty);
          const rate = toNumber(it.pricePerUnit || it.rate || 0);
          const amount = +(qty * rate).toFixed(2);
          const gstAmt = +(
            (amount * toNumber(it.gstPercent || 0)) /
            100
          ).toFixed(2);
          const totalWithGst = +(amount + gstAmt).toFixed(2);
          items.push({
            challanId: ch.id,
            description: it.productName || it.description || "Item",
            qty,
            rate,
            amount,
            gstPercent: toNumber(it.gstPercent || 0),
            totalWithGst,
          });
        }
      }
    }

    // manual items
    for (const mi of rawItems) {
      const qty = toNumber(mi.qty);
      const rate = toNumber(mi.rate);
      const amount = +(qty * rate).toFixed(2);
      const gstAmt = +((amount * toNumber(mi.gstPercent || 0)) / 100).toFixed(
        2
      );
      const totalWithGst = +(amount + gstAmt).toFixed(2);
      items.push({
        challanId: mi.challanId || null,
        description: mi.description || "Item",
        qty,
        rate,
        amount,
        gstPercent: toNumber(mi.gstPercent || 0),
        totalWithGst,
      });
    }

    if (items.length === 0) throw new Error("No items to bill");

    // compute totals
    let subtotal = 0,
      gstTotal = 0;
    for (const it of items) {
      subtotal += toNumber(it.amount);
      gstTotal += +((toNumber(it.amount) * toNumber(it.gstPercent)) / 100);
    }
    subtotal = +subtotal.toFixed(2);
    gstTotal = +gstTotal.toFixed(2);
    const totalWithoutGST = gstOption ? subtotal : subtotal;
    const totalWithGST = gstOption
      ? +(subtotal + gstTotal).toFixed(2)
      : subtotal;

    // generate bill number
    const billNumber = await generateBillNumber(BillModel, t);

    const bill = await BillModel.create(
      {
        billNumber,
        vendorId,
        customerId,
        billDate: new Date(),
        subtotal: subtotal,
        gstTotal: gstTotal,
        totalWithoutGST,
        totalWithGST,
        status: "pending",
        note: note || null,
        challanIds: challanIds.length ? JSON.stringify(challanIds) : null,
      },
      { transaction: t }
    );

    // create bill items
    const itemsToCreate = items.map((i) => ({ ...i, billId: bill.id }));
    await BillItemModel.bulkCreate(itemsToCreate, { transaction: t });

    // OPTIONAL: mark challans as billed or attach billId to challan or challan items
    // e.g., set ChallanModel.field billed=true OR create mapping. We'll update challan.status = 'billed' (if business wants)
    // For now we won't change challan financials; leave history trace in bill.challanIds

    const created = await BillModel.findByPk(bill.id, {
      include: [
        { model: BillItemModel, as: "items" },
        { model: CustomerModel, as: "customer" },
      ],
      transaction: t,
    });

    return created;
  });
};

exports.listBills = async ({
  vendorId,
  page = 1,
  size = 20,
  search,
  fromDate,
  toDate,
  status,
} = {}) => {
  const where = {};
  if (vendorId) where.vendorId = vendorId;
  if (status) where.status = status;
  if (fromDate)
    where.billDate = { ...(where.billDate || {}), [Op.gte]: fromDate };
  if (toDate) where.billDate = { ...(where.billDate || {}), [Op.lte]: toDate };
  if (search) where[Op.or] = [{ billNumber: { [Op.like]: `%${search}%` } }];

  const result = await BillModel.findAndCountAll({
    where,
    include: [
      {
        model: CustomerModel,
        as: "customer",
        attributes: ["id", "customerName", "businessName", "mobileNumber"],
      },
    ],
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [["billDate", "DESC"]],
    distinct: true,
  });

  return { total: result.count, rows: result.rows };
};

exports.getBillById = async (billId, vendorId) => {
  const where = { id: billId };
  if (vendorId) where.vendorId = vendorId;

  const bill = await BillModel.findOne({
    where,
    include: [
      { model: BillItemModel, as: "items" },
      { model: CustomerModel, as: "customer" },
    ],
  });

  if (!bill) throw new Error("Bill not found");

  // compute payments related to bill (if TransactionModel has billId)
  const payments = await TransactionModel.findAll({
    where: {
      vendorId: bill.vendorId,
      customerId: bill.customerId,
      billId: bill.id,
    },
    order: [["transactionDate", "DESC"]],
  });

  const paid = payments.reduce((s, p) => s + toNumber(p.amount), 0);
  const due = +(toNumber(bill.totalWithGST) - paid).toFixed(2);
  const status =
    due <= 0 ? "paid" : paid > 0 ? "partial" : bill.status || "pending";

  // update status if mismatch
  if (bill.status !== status) {
    await bill.update({ status });
  }

  return { bill, payments, due };
};

exports.markBillPaid = async (billId, vendorId, payload) => {
  return await sequelize.transaction(async (t) => {
    const bill = await BillModel.findOne({
      where: { id: billId, vendorId },
      transaction: t,
    });
    if (!bill) throw new Error("Bill not found");

    const amount = toNumber(payload.paymentAmount);
    if (amount <= 0) throw new Error("paymentAmount must be > 0");

    // create transaction linking to bill (TransactionModel should support billId)
    const trx = await TransactionModel.create(
      {
        vendorId,
        customerId: bill.customerId,
        amount,
        type: "payment",
        description: payload.note || `Payment for ${bill.billNumber}`,
        transactionDate: payload.transactionDate || new Date(),
        billId: bill.id,
      },
      { transaction: t }
    );

    // compute total paid and due
    const payments = await TransactionModel.findAll({
      where: { vendorId, customerId: bill.customerId, billId: bill.id },
      transaction: t,
    });
    const paid = payments.reduce((s, p) => s + toNumber(p.amount), 0);
    const due = +(toNumber(bill.totalWithGST) - paid).toFixed(2);
    const status = due <= 0 ? "paid" : paid > 0 ? "partial" : "pending";

    await bill.update({ status }, { transaction: t });

    return { bill, payment: trx, due };
  });
};

exports.editBill = async (billId, vendorId, payload) => {
  return await sequelize.transaction(async (t) => {
    const bill = await BillModel.findOne({
      where: { id: billId, vendorId },
      transaction: t,
    });
    if (!bill) throw new Error("Bill not found");
    if (bill.status === "paid") throw new Error("Cannot edit a paid bill");

    if (payload.items) {
      // delete existing items and recreate
      await BillItemModel.destroy({
        where: { billId: bill.id },
        transaction: t,
      });
      let subtotal = 0,
        gstTotal = 0;
      const toCreate = [];
      for (const mi of payload.items) {
        const qty = toNumber(mi.qty);
        const rate = toNumber(mi.rate);
        const amount = +(qty * rate).toFixed(2);
        const gstAmt = +((amount * toNumber(mi.gstPercent || 0)) / 100).toFixed(
          2
        );
        const totalWithGst = +(amount + gstAmt).toFixed(2);
        subtotal += amount;
        gstTotal += gstAmt;
        toCreate.push({
          billId: bill.id,
          challanId: mi.challanId || null,
          description: mi.description || "Item",
          qty,
          rate,
          amount,
          gstPercent: toNumber(mi.gstPercent || 0),
          totalWithGst,
        });
      }
      await BillItemModel.bulkCreate(toCreate, { transaction: t });
      subtotal = +subtotal.toFixed(2);
      gstTotal = +gstTotal.toFixed(2);
      const totalWithGST = +(subtotal + gstTotal).toFixed(2);
      await bill.update(
        { subtotal, gstTotal, totalWithoutGST: subtotal, totalWithGST },
        { transaction: t }
      );
    }

    if (payload.note !== undefined)
      await bill.update({ note: payload.note }, { transaction: t });
    if (payload.billDate)
      await bill.update({ billDate: payload.billDate }, { transaction: t });

    const updated = await BillModel.findByPk(bill.id, {
      include: [{ model: BillItemModel, as: "items" }],
      transaction: t,
    });
    return updated;
  });
};

exports.generateBillPdf = async (billId, vendorId) => {
  // reuse getBillById for data
  const { bill, payments, due } = await this.getBillById(billId, vendorId);
  if (!bill) throw new Error("Bill not found");

  const full = await BillModel.findOne({
    where: { id: bill.id },
    include: [
      { model: BillItemModel, as: "items" },
      { model: VendorModel, as: "vendor" },
      { model: CustomerModel, as: "customer" },
    ],
  });

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const buffers = [];
  doc.on("data", buffers.push.bind(buffers));
  const endPromise = new Promise((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(buffers)))
  );

  // Header
  doc.fontSize(18).text(`Bill - ${full.billNumber}`, { align: "center" });
  doc.moveDown();
  doc.fontSize(10);
  if (full.vendor) doc.text(`Vendor: ${full.vendor.vendorName || ""}`);
  if (full.customer) {
    doc.text(
      `Customer: ${full.customer.customerName || ""} (${
        full.customer.businessName || ""
      })`
    );
    doc.text(`Mobile: ${full.customer.mobileNumber || ""}`);
  }
  doc.text(`Date: ${full.billDate}`);
  doc.moveDown();
  doc.text("Items:", { underline: true });
  doc.moveDown(0.2);

  full.items.forEach((it, idx) => {
    doc.text(
      `${idx + 1}. ${it.description} | Qty: ${it.qty} | Rate: ₹${
        it.rate
      } | Amount: ₹${it.amount} | GST%: ${it.gstPercent}`
    );
  });

  doc.moveDown();
  doc.text(`Subtotal: ₹${full.subtotal}`);
  doc.text(`GST Total: ₹${full.gstTotal}`);
  doc.text(`Total (Incl GST): ₹${full.totalWithGST}`);
  doc.text(`Status: ${full.status}`);
  if (full.note) {
    doc.moveDown();
    doc.text(`Note: ${full.note}`);
  }

  doc.end();
  return await endPromise;
};

exports.getWhatsappLinkForBill = async (billId, vendorId, messageOverride) => {
  const { bill } = await this.getBillById(billId, vendorId);
  if (!bill) throw new Error("Bill not found");

  const customer = await CustomerModel.findByPk(bill.customerId);
  const phone = (customer && customer.mobileNumber) || "";
  if (!phone) throw new Error("Customer phone not found");

  const message =
    messageOverride ||
    `Hello ${customer.customerName || ""}, Your Bill ${bill.billNumber} dated ${
      bill.billDate
    } for ₹${bill.totalWithGST} is generated. Please pay ₹${
      bill.totalWithGST
    }.`;
  const link = whatsappLink(phone, message);
  return { phone, link, message };
};
