const {
  BillModel,
  BillItemModel,
  ChallanModel,
  ChallanItemModel,
  TransactionModel,
  CustomerModel,
  VendorModel,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const invoiceSettingsService = require("./invoiceSettingsService");
const PDFDocument = require("pdfkit");
const { whatsappLink } = require("../../utils/whatsappHelper");

function toNumber(v) {
  return parseFloat(v || 0);
}

//  Generate bill number using invoice settings

async function generateBillNumberWithSettings(
  vendorId,
  customNumber = null,
  transaction,
) {
  try {
    // Get next invoice number from settings
    const invoiceInfo = await invoiceSettingsService.getNextInvoiceNumber(
      vendorId,
      customNumber,
    );

    // Reserve the number
    await invoiceSettingsService.reserveInvoiceNumber(
      vendorId,
      invoiceInfo.numericPart,
    );

    return {
      billNumber: invoiceInfo.fullNumber,
      prefix: invoiceInfo.prefix,
      count: invoiceInfo.numericPart,
      template: invoiceInfo.template,
    };
  } catch (error) {
    throw error;
  }
}

exports.createBill = async (vendorId, payload) => {
  const {
    customerId,
    challanIds = [],
    discountPercent = 0,
    gstPercent = 0,
    note,
    customInvoiceNumber = null, // Allow custom number selection
    invoiceTemplate = null, // Allow template override
  } = payload;

  if (!customerId) throw new Error("customerId required");
  if (!Array.isArray(challanIds) || challanIds.length === 0) {
    throw new Error("At least one challan must be selected");
  }

  return await sequelize.transaction(async (t) => {
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) throw new Error("Vendor not found");

    const customer = await CustomerModel.findByPk(customerId, {
      transaction: t,
    });
    if (!customer) throw new Error("Customer not found");

    const challans = await ChallanModel.findAll({
      where: { id: challanIds, vendorId, customerId },
      include: [{ model: ChallanItemModel, as: "items" }],
      transaction: t,
    });

    if (challans.length !== challanIds.length) {
      throw new Error("One or more challans are invalid");
    }

    let subtotal = 0;
    const billItems = [];

    for (const ch of challans) {
      for (const it of ch.items) {
        const qty = toNumber(it.qty);
        const rate = toNumber(it.pricePerUnit);
        const amount = +(qty * rate).toFixed(2);

        subtotal += amount;

        billItems.push({
          challanId: ch.id,
          description: it.productName,
          qty,
          rate,
          amount,
          gstPercent: toNumber(it.gstPercent || 0),
          totalWithGst: amount,
        });
      }
    }

    subtotal = +subtotal.toFixed(2);

    const discountAmount =
      discountPercent > 0
        ? +((subtotal * discountPercent) / 100).toFixed(2)
        : 0;

    const discountedSubtotal = +(subtotal - discountAmount).toFixed(2);

    const gstAmount =
      gstPercent > 0
        ? +((discountedSubtotal * gstPercent) / 100).toFixed(2)
        : 0;

    const totalWithGST = +(discountedSubtotal + gstAmount).toFixed(2);

    // Generate bill number with invoice settings
    const billNumberInfo = await generateBillNumberWithSettings(
      vendorId,
      customInvoiceNumber,
      t,
    );

    // Use provided template or from settings
    const template = invoiceTemplate || billNumberInfo.template;

    const bill = await BillModel.create(
      {
        billNumber: billNumberInfo.billNumber,
        invoicePrefix: billNumberInfo.prefix,
        invoiceCount: billNumberInfo.count,
        invoiceTemplate: template,
        vendorId,
        customerId,
        billDate: new Date(),
        subtotal,
        gstTotal: gstAmount,
        totalWithoutGST: discountedSubtotal,
        totalWithGST,
        totalAmount: totalWithGST,
        paidAmount: 0,
        pendingAmount: totalWithGST,
        status: "pending",
        note: note || null,
        challanIds: JSON.stringify(challanIds),
      },
      { transaction: t },
    );

    await BillItemModel.bulkCreate(
      billItems.map((i) => ({ ...i, billId: bill.id })),
      { transaction: t },
    );

    return await BillModel.findByPk(bill.id, {
      include: [
        { model: BillItemModel, as: "items" },
        { model: CustomerModel, as: "customer" },
      ],
      transaction: t,
    });
  });
};

exports.listBills = async ({
  vendorId,
  customerId,
  page = 1,
  size = 20,
  search,
  fromDate,
  toDate,
  status,
  sortBy = "billDate",
  sortOrder = "DESC",
} = {}) => {
  const where = {};

  if (vendorId) where.vendorId = vendorId;

  if (customerId) where.customerId = Number(customerId);

  if (status) {
    if (Array.isArray(status)) {
      where.status = { [Op.in]: status };
    } else {
      where.status = status;
    }
  }

  if (fromDate || toDate) {
    where.billDate = {};
    if (fromDate) {
      where.billDate[Op.gte] = new Date(fromDate);
    }
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      where.billDate[Op.lte] = endDate;
    }
  }

  if (search) {
    where[Op.or] = [{ billNumber: { [Op.like]: `%${search}%` } }];
  }

  const result = await BillModel.findAndCountAll({
    where,
    include: [
      {
        model: CustomerModel,
        as: "customer",
        attributes: ["id", "customerName", "businessName", "mobile"],
        where: search
          ? {
              [Op.or]: [
                { customerName: { [Op.like]: `%${search}%` } },
                { businessName: { [Op.like]: `%${search}%` } },
              ],
            }
          : undefined,
        required: search ? true : false,
      },
    ],
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [[sortBy, sortOrder.toUpperCase()]],
    distinct: true,
  });

  return {
    total: result.count,
    rows: result.rows,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(result.count / Number(size)),
    hasNextPage: Number(page) < Math.ceil(result.count / Number(size)),
    hasPrevPage: Number(page) > 1,
  };
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

  // Get all payments related to this bill
  const payments = await TransactionModel.findAll({
    where: {
      vendorId: bill.vendorId,
      customerId: bill.customerId,
      billId: bill.id,
      type: "payment",
    },
    order: [["transactionDate", "DESC"]],
  });

  // Calculate totals
  const paid = payments.reduce((s, p) => s + toNumber(p.amount), 0);
  const totalAmount = toNumber(bill.totalWithGST);
  const due = +(totalAmount - paid).toFixed(2);

  // Determine status
  let status = "pending";
  if (due <= 0) {
    status = "paid";
  } else if (paid > 0) {
    status = "partial";
  }

  // Update bill if status or amounts changed
  if (
    bill.status !== status ||
    toNumber(bill.paidAmount) !== paid ||
    toNumber(bill.pendingAmount) !== due
  ) {
    await bill.update({
      status,
      paidAmount: paid.toFixed(2),
      pendingAmount: due.toFixed(2),
    });
  }

  return {
    bill,
    payments,
    paidAmount: paid.toFixed(2),
    pendingAmount: due.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
  };
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

    // Create transaction record
    const trx = await TransactionModel.create(
      {
        vendorId,
        customerId: bill.customerId,
        amount: amount.toFixed(2),
        type: "payment",
        description: payload.note || `Payment for ${bill.billNumber}`,
        transactionDate: payload.transactionDate || new Date(),
        billId: bill.id,
      },
      { transaction: t },
    );

    // Calculate total paid from all transactions
    const allPayments = await TransactionModel.sum("amount", {
      where: {
        vendorId,
        customerId: bill.customerId,
        billId: bill.id,
        type: "payment",
      },
      transaction: t,
    });

    const totalPaid = toNumber(allPayments);
    const totalAmount = toNumber(bill.totalWithGST);
    const pending = totalAmount - totalPaid;

    // Determine status
    let status = "pending";
    if (pending <= 0) {
      status = "paid";
    } else if (totalPaid > 0) {
      status = "partial";
    }

    // Update bill with payment tracking
    await bill.update(
      {
        status,
        paidAmount: totalPaid.toFixed(2),
        pendingAmount: Math.max(0, pending).toFixed(2),
      },
      { transaction: t },
    );

    return {
      bill,
      payment: trx,
      totalPaid: totalPaid.toFixed(2),
      pendingAmount: Math.max(0, pending).toFixed(2),
    };
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
          2,
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

      // Update bill totals and recalculate pending
      const paidAmount = toNumber(bill.paidAmount);
      const newPending = totalWithGST - paidAmount;

      await bill.update(
        {
          subtotal,
          gstTotal,
          totalWithoutGST: subtotal,
          totalWithGST,
          totalAmount: totalWithGST,
          pendingAmount: Math.max(0, newPending).toFixed(2),
        },
        { transaction: t },
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
  const { bill, paidAmount, pendingAmount } = await this.getBillById(
    billId,
    vendorId,
  );
  if (!bill) throw new Error("Bill not found");

  const full = await BillModel.findOne({
    where: { id: bill.id },
    include: [
      { model: BillItemModel, as: "items" },
      { model: VendorModel, as: "vendor" },
      { model: CustomerModel, as: "customer" },
    ],
  });

  // Get template - use bill's template or default
  const template = full.invoiceTemplate || "template1";

  // Generate PDF based on template
  return await this.generatePdfByTemplate(
    full,
    paidAmount,
    pendingAmount,
    template,
  );
};

// Generate PDF based on selected template

exports.generatePdfByTemplate = async (
  bill,
  paidAmount,
  pendingAmount,
  template,
) => {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const buffers = [];
  doc.on("data", buffers.push.bind(buffers));
  const endPromise = new Promise((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(buffers))),
  );

  switch (template) {
    case "template2":
      this.generateTemplate2(doc, bill, paidAmount, pendingAmount);
      break;
    case "template3":
      this.generateTemplate3(doc, bill, paidAmount, pendingAmount);
      break;
    case "template1":
    default:
      this.generateTemplate1(doc, bill, paidAmount, pendingAmount);
      break;
  }

  doc.end();
  return await endPromise;
};

// * Template 1: Classic Invoice
exports.generateTemplate1 = (doc, bill, paidAmount, pendingAmount) => {
  // Header
  doc.fontSize(18).text(`Bill - ${bill.billNumber}`, { align: "center" });
  doc.moveDown();
  doc.fontSize(10);
  if (bill.vendor) doc.text(`Vendor: ${bill.vendor.vendorName || ""}`);
  if (bill.customer) {
    doc.text(
      `Customer: ${bill.customer.customerName || ""} (${
        bill.customer.businessName || ""
      })`,
    );
    doc.text(`Mobile: ${bill.customer.mobile || ""}`);
  }
  doc.text(`Date: ${bill.billDate}`);
  doc.moveDown();
  doc.text("Items:", { underline: true });
  doc.moveDown(0.2);

  bill.items.forEach((it, idx) => {
    doc.text(
      `${idx + 1}. ${it.description} | Qty: ${it.qty} | Rate: ₹${
        it.rate
      } | Amount: ₹${it.amount} | GST%: ${it.gstPercent}`,
    );
  });

  doc.moveDown();
  doc.text(`Subtotal: ₹${bill.subtotal}`);
  doc.text(`GST Total: ₹${bill.gstTotal}`);
  doc.text(`Total Amount: ₹${bill.totalWithGST}`);
  doc.text(`Paid Amount: ₹${paidAmount}`);
  doc.text(`Pending Amount: ₹${pendingAmount}`, { underline: true });
  doc.text(`Status: ${bill.status.toUpperCase()}`);
  if (bill.note) {
    doc.moveDown();
    doc.text(`Note: ${bill.note}`);
  }
};

//  Template 2: Modern Invoice

exports.generateTemplate2 = (doc, bill, paidAmount, pendingAmount) => {
  const startX = 40;
  let y = 40;
  const pageWidth = 515;

  // ===== HEADER =====
  doc.fontSize(10).text("Logo", startX, y);
  doc.fontSize(20).text("INVOICE", startX + 360, y);

  y += 30;
  doc
    .moveTo(startX, y)
    .lineTo(startX + pageWidth, y)
    .stroke();

  // ===== BILL INFO =====
  y += 15;
  doc.fontSize(9);
  doc.text(`Invoice No: ${bill.billNumber}`, startX, y);
  doc.text(`Date: ${bill.billDate}`, startX + 360, y);

  y += 25;

  // ===== TABLE HEADER =====
  const col = {
    desc: startX,
    qty: startX + 260,
    rate: startX + 340,
    total: startX + 430,
  };

  doc.rect(startX, y, pageWidth, 25).stroke();

  doc.fontSize(10);
  doc.text("DESCRIPTION", col.desc + 5, y + 7);
  doc.text("QTY", col.qty + 5, y + 7);
  doc.text("UNIT PRICE", col.rate + 5, y + 7);
  doc.text("TOTAL", col.total + 5, y + 7);

  y += 25;

  // ===== ITEMS ROWS =====
  doc.fontSize(9);
  bill.items.forEach((item) => {
    doc.rect(startX, y, pageWidth, 22).stroke();

    doc.text(item.description, col.desc + 5, y + 6, { width: 240 });
    doc.text(item.qty.toString(), col.qty + 10, y + 6);
    doc.text(`₹${item.rate}`, col.rate + 5, y + 6);
    doc.text(`₹${item.amount}`, col.total + 5, y + 6);

    y += 22;
  });

  // Empty rows (classic look)
  for (let i = 0; i < 3; i++) {
    doc.rect(startX, y, pageWidth, 22).stroke();
    y += 22;
  }

  // ===== NOTES + TOTALS =====
  const notesHeight = 80;
  doc.rect(startX, y, 320, notesHeight).stroke();
  doc.fontSize(8).text("Additional Information / Comments:", startX + 5, y + 5);

  if (bill.note) {
    doc.text(bill.note, startX + 5, y + 20, { width: 300 });
  }

  // Totals box
  const totalX = startX + 320;
  const rowH = 26;

  const drawTotalRow = (label, value, bold = false) => {
    doc.rect(totalX, y, pageWidth - 320, rowH).stroke();
    doc.fontSize(bold ? 11 : 9);
    doc.text(label, totalX + 10, y + 7);
    doc.text(`₹${value}`, totalX + 120, y + 7);
    y += rowH;
  };

  drawTotalRow("SUBTOTAL", bill.subtotal);
  drawTotalRow("GST", bill.gstTotal);
  drawTotalRow("TOTAL", bill.totalWithGST, true);

  y += 10;
  doc.fontSize(9);
  doc.text(`Paid: ₹${paidAmount}`, startX + 350, y);
  y += 15;
  doc.text(`Balance: ₹${pendingAmount}`, startX + 350, y);
};

// Template 3: Minimal Invoice

exports.generateTemplate3 = (doc, bill, paidAmount, pendingAmount) => {
  // Minimal header
  doc.fontSize(14).text("INVOICE", 40, 40);
  doc.fontSize(20).text(bill.billNumber, 40, 60);

  doc.fontSize(9);
  doc.text(`Date: ${bill.billDate}`, 40, 90);

  // Two column layout
  doc.fontSize(8);
  doc.text("FROM:", 40, 120);
  doc.fontSize(9);
  doc.text(bill.vendor?.vendorName || "", 40, 135);

  doc.fontSize(8);
  doc.text("TO:", 320, 120);
  doc.fontSize(9);
  doc.text(bill.customer?.customerName || "", 320, 135);
  doc.text(bill.customer?.businessName || "", 320, 150);

  let yPos = 200;
  doc.fontSize(9);

  bill.items.forEach((it, idx) => {
    doc.text(`${idx + 1}. ${it.description}`, 40, yPos);
    doc.text(`${it.qty} × ₹${it.rate}`, 320, yPos);
    doc.text(`₹${it.amount}`, 470, yPos);
    yPos += 20;
  });

  yPos += 20;
  doc.moveTo(320, yPos).lineTo(555, yPos).stroke();
  yPos += 15;

  doc.text("Subtotal", 320, yPos);
  doc.text(`₹${bill.subtotal}`, 470, yPos);
  yPos += 15;

  doc.text("GST", 320, yPos);
  doc.text(`₹${bill.gstTotal}`, 470, yPos);
  yPos += 15;

  doc.moveTo(320, yPos).lineTo(555, yPos).stroke();
  yPos += 15;

  doc.fontSize(11);
  doc.text("Total", 320, yPos);
  doc.text(`₹${bill.totalWithGST}`, 470, yPos);

  doc.fontSize(9);
  yPos += 25;
  doc.text(`Paid: ₹${paidAmount}`, 320, yPos);
  yPos += 15;
  doc.text(`Balance: ₹${pendingAmount}`, 320, yPos);

  if (bill.note) {
    yPos += 30;
    doc.fontSize(8);
    doc.text("Note:", 40, yPos);
    doc.fontSize(9);
    doc.text(bill.note, 40, yPos + 15, { width: 500 });
  }
};

exports.getWhatsappLinkForBill = async (billId, vendorId, messageOverride) => {
  const { bill, pendingAmount } = await this.getBillById(billId, vendorId);
  if (!bill) throw new Error("Bill not found");

  const customer = await CustomerModel.findByPk(bill.customerId);
  const phone = (customer && customer.mobile) || "";
  if (!phone) throw new Error("Customer phone not found");

  const message =
    messageOverride ||
    `Hello ${customer.customerName || ""}, Your Bill ${bill.billNumber} dated ${
      bill.billDate
    } for ₹${
      bill.totalWithGST
    } is generated. Pending amount: ₹${pendingAmount}`;
  const link = whatsappLink(phone, message);
  return { phone, link, message };
};

exports.deleteBill = async (billId, vendorId) => {
  return await sequelize.transaction(async (t) => {
    const bill = await BillModel.findOne({
      where: { id: billId, vendorId },
      transaction: t,
    });

    if (!bill) throw new Error("Bill not found");

    const hasPayments = await TransactionModel.count({
      where: { billId: bill.id, type: "payment" },
      transaction: t,
    });

    if (hasPayments > 0) {
      throw new Error(
        "Cannot delete bill with payments. Mark as cancelled instead.",
      );
    }

    await BillItemModel.destroy({
      where: { billId: bill.id },
      transaction: t,
    });

    await bill.destroy({ transaction: t });

    return true;
  });
};

exports.getVendorPendingBillTotal = async (vendorId) => {
  if (!vendorId) throw new Error("vendorId is required");

  const total = await BillModel.sum("pendingAmount", {
    where: {
      vendorId: Number(vendorId),
      status: {
        [Op.in]: ["pending", "partial"],
      },
    },
  });

  return {
    vendorId: Number(vendorId),
    totalPendingAmount: Number(total || 0).toFixed(2),
  };
};
