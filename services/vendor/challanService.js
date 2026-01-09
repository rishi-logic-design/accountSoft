const {
  ChallanModel,
  ChallanItemModel,
  CustomerModel,
  TransactionModel,
  sequelize,
  VendorModel,
} = require("../../models");
const { Op } = require("sequelize");
const { generateChallanNumber } = require("../../utils/challan");
const PDFDocument = require("pdfkit");

function toNumber(v) {
  return parseFloat(v || 0);
}

exports.createChallan = async (vendorId, payload) => {
  const { customerId, challanDate, items: rawItems, note } = payload;
  if (!customerId) throw new Error("customerId required");
  if (!Array.isArray(rawItems) || rawItems.length === 0)
    throw new Error("items required");

  return await sequelize.transaction(async (t) => {
    // ensure vendor & customer exist
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) throw new Error("Vendor not found");

    const customer = await CustomerModel.findByPk(customerId, {
      transaction: t,
    });
    if (!customer) throw new Error("Customer not found");

    // generate challan number
    const challanNumber = await generateChallanNumber(ChallanModel, t);

    // compute totals
    let subtotal = 0;
    let gstTotal = 0;
    const items = rawItems.map((it) => {
      const qty = toNumber(it.qty);
      const price = toNumber(it.pricePerUnit);
      const amount = +(qty * price).toFixed(2);
      const gstAmt = +((amount * toNumber(it.gstPercent)) / 100).toFixed(2);
      const totalWithGst = +(amount + gstAmt).toFixed(2);
      subtotal += amount;
      gstTotal += gstAmt;
      return {
        productId: it.productId || null,
        productName: it.productName,
        categoryId: it.categoryId || null,
        size: it.size || null,
        length: it.length || null,
        qty,
        pricePerUnit: price,
        amount,
        gstPercent: toNumber(it.gstPercent || 0),
        totalWithGst,
      };
    });

    subtotal = +subtotal.toFixed(2);
    gstTotal = +gstTotal.toFixed(2);
    const totalWithoutGST = subtotal;
    const totalWithGST = +(subtotal + gstTotal).toFixed(2);

    const challan = await ChallanModel.create(
      {
        challanNumber,
        vendorId,
        customerId,
        challanDate: challanDate || new Date(),
        subtotal,
        gstTotal,
        totalWithoutGST,
        totalWithGST,
        status: "unpaid",
        note: note || null,
      },
      { transaction: t }
    );

    // bulk create items with challanId
    const itemsToCreate = items.map((i) => ({ ...i, challanId: challan.id }));
    await ChallanItemModel.bulkCreate(itemsToCreate, { transaction: t });

    // return populated challan
    const created = await ChallanModel.findByPk(challan.id, {
      transaction: t,
      include: [
        { model: ChallanItemModel, as: "items" },
        { model: CustomerModel, as: "customer" },
      ],
    });

    return created;
  });
};

exports.listChallans = async ({
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
    where.challanDate = { ...(where.challanDate || {}), [Op.gte]: fromDate };
  if (toDate)
    where.challanDate = { ...(where.challanDate || {}), [Op.lte]: toDate };
  if (search) {
    where[Op.or] = [{ challanNumber: { [Op.like]: `%${search}%` } }];
  }

  const include = [
    {
      model: CustomerModel,
      as: "customer",
      attributes: ["id", "customerName", "businessName", "mobileNumber"],
    },
  ];

  // Basic implementation:
  const result = await ChallanModel.findAndCountAll({
    where,
    include,
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [["challanDate", "DESC"]],
    distinct: true,
  });

  return { total: result.count, rows: result.rows };
};

exports.getChallanById = async (challanId, vendorId) => {
  const where = { id: challanId };
  if (vendorId) where.vendorId = vendorId;

  const challan = await ChallanModel.findOne({
    where,
    include: [
      { model: ChallanItemModel, as: "items" },
      { model: CustomerModel, as: "customer" },
    ],
  });

  if (!challan) throw new Error("Challan not found");

  // fetch payments (transactions) linked to the challan via challanId if stored, otherwise compute from transactions table for customer
  const payments = await TransactionModel.findAll({
    where: {
      vendorId: challan.vendorId,
      customerId: challan.customerId,
      challanId: challan.id,
    },
    order: [["transactionDate", "DESC"]],
  });

  // compute due
  const paidAmount = payments.reduce((s, p) => s + toNumber(p.amount), 0);
  const due = +(toNumber(challan.totalWithGST) - paidAmount).toFixed(2);
  const status = due <= 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";

  // update status if mismatch (non-destructive)
  if (challan.status !== status) {
    await challan.update({ status });
  }

  return { challan, payments, due };
};

exports.markChallanPaid = async (challanId, vendorId, payload) => {
  return await sequelize.transaction(async (t) => {
    const challan = await ChallanModel.findOne({
      where: {
        id: challanId,
        vendorId,
      },
      transaction: t,
    });

    if (!challan) {
      throw new Error("Challan not found");
    }

    const paymentAmount = Number(payload.paymentAmount);
    if (!paymentAmount || paymentAmount <= 0) {
      throw new Error("paymentAmount should be > 0");
    }

    const payment = await TransactionModel.create(
      {
        vendorId: challan.vendorId,
        customerId: challan.customerId,
        amount: paymentAmount,
        type: "payment",
        description: payload.note || `Payment for ${challan.challanNumber}`,
        transactionDate: payload.transactionDate || new Date(),
        challanNumber: challan.challanNumber,
      },
      { transaction: t }
    );

    const payments = await TransactionModel.findAll({
      where: {
        vendorId: challan.vendorId,
        customerId: challan.customerId,
        challanNumber: challan.challanNumber,
        type: "payment",
      },
      transaction: t,
    });

    const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const due = Number((Number(challan.totalWithGST) - paid).toFixed(2));

    // 5️⃣ Update challan status
    const status = due <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";

    await challan.update({ status }, { transaction: t });

    return {
      challan,
      payment,
      paid,
      due,
      status,
    };
  });
};

exports.deleteChallan = async (challanId, vendorId) => {
  const challan = await ChallanModel.findOne({
    where: { id: challanId, vendorId },
  });
  if (!challan) throw new Error("Challan not found");
  await challan.destroy();
  return true;
};

exports.getWhatsappDataForChallan = async (challanId, vendorId) => {
  const challan = await ChallanModel.findOne({
    where: { id: challanId, vendorId },
    include: [{ model: CustomerModel, as: "customer" }],
  });
  if (!challan) throw new Error("Challan not found");

  const phone = challan.customer && (challan.customer.mobileNumber || "");
  const text = `Hello ${challan.customer.customerName || ""}, Your Challan ${
    challan.challanNumber
  } dated ${challan.challanDate} for ₹${
    challan.totalWithGST
  } is generated. Please pay the due ₹${challan.totalWithGST}.`;

  return { phone, defaultMessage: text };
};

exports.generateChallanPdf = async (challanId, vendorId) => {
  const challanIdNum = Number(challanId);
  const vendorIdNum = Number(vendorId);

  if (!challanIdNum || !vendorIdNum) {
    throw new Error("challanId and vendorId must be valid numbers");
  }

  const challan = await ChallanModel.findOne({
    where: { id: challanIdNum, vendorId: vendorIdNum },
    paranoide: false,
  });

  if (!challan) {
    throw new Error(
      `Challan not found for challanId=${challanIdNum} vendorId=${vendorIdNum}`
    );
  }

  const full = await ChallanModel.findOne({
    where: { id: challan.id },
    include: [
      { model: ChallanItemModel, as: "items" },
      { model: CustomerModel, as: "customer" },
      { model: VendorModel, as: "vendor" },
    ],
    pranoide: false,
  });

  if (!full) {
    throw new Error("Challan details not found");
  }

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const buffers = [];
  doc.on("data", buffers.push.bind(buffers));

  const endPromise = new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });

  doc.fontSize(18).text(`Challan - ${full.challanNumber}`, {
    align: "center",
  });

  doc.moveDown();
  doc.fontSize(10);

  if (full.vendor) {
    doc.text(`Vendor: ${full.vendor.vendorName || ""}`);
  }

  if (full.customer) {
    doc.text(
      `Customer: ${full.customer.customerName || ""} (${
        full.customer.businessName || ""
      })`
    );
    doc.text(`Mobile: ${full.customer.mobileNumber || ""}`);
  }

  doc.text(`Date: ${full.challanDate}`);
  doc.moveDown();

  doc.fontSize(10).text("Items:", { underline: true });
  doc.moveDown(0.3);

  full.items.forEach((it, idx) => {
    doc.text(
      `${idx + 1}. ${it.productName} | Size: ${it.size || "-"} | Qty: ${
        it.qty
      } | Rate: ₹${it.pricePerUnit} | Amount: ₹${it.amount} | GST%: ${
        it.gstPercent
      }`
    );
  });

  doc.moveDown();
  doc.text(`Subtotal: ₹${full.subtotal}`);
  doc.text(`GST Total: ₹${full.gstTotal}`);
  doc.text(`Total (Incl GST): ₹${full.totalWithGST}`);

  if (full.note) {
    doc.moveDown();
    doc.text(`Note: ${full.note}`);
  }

  doc.end();
  return await endPromise;
};
