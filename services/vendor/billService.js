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
    customInvoiceNumber = null,
    invoiceTemplate = null,
    customInvoicePrefix = null,
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
      where: {
        id: challanIds,
        vendorId,
        customerId,
        status: "unpaid",
      },
      include: [{ model: ChallanItemModel, as: "items" }],
      transaction: t,
    });

    if (challans.length !== challanIds.length) {
      throw new Error("One or more challans are already billed or invalid");
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

    const systemPrefix = billNumberInfo.prefix;

    const finalPrefix = customInvoicePrefix
      ? customInvoicePrefix.toUpperCase().trim()
      : systemPrefix;

    const finalBillNumber = `${finalPrefix}${billNumberInfo.count}`;

    const template = invoiceTemplate || billNumberInfo.template;

    const bill = await BillModel.create(
      {
        billNumber: finalBillNumber,
        invoicePrefix: systemPrefix,
        customInvoicePrefix: customInvoicePrefix || null,
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
    await ChallanModel.update(
      {
        status: "paid",
      },
      {
        where: {
          id: challanIds,
          vendorId,
        },
        transaction: t,
      },
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

//  Template 1: Classic Professional Invoice

exports.generateTemplate1 = (doc, bill, paidAmount, pendingAmount) => {
  const pageWidth = 595.28; // A4 width in points
  const pageHeight = 841.89; // A4 height in points
  const margin = 45;
  const contentWidth = pageWidth - margin * 2;

  // ============================================
  // MODERN COLOR SCHEME
  // ============================================
  const colors = {
    primary: "#1A1A2E",
    secondary: "#0F3460",
    accent: "#E94560",
    success: "#16A085",
    warning: "#F39C12",
    danger: "#E74C3C",
    lightGray: "#F8F9FA",
    mediumGray: "#E9ECEF",
    darkGray: "#6C757D",
    text: "#2C3E50",
    white: "#FFFFFF",
  };

  // ============================================
  // HEADER - MODERN DESIGN WITH GRADIENT EFFECT
  // ============================================

  // Top accent bar
  doc.rect(0, 0, pageWidth, 8).fillColor(colors.accent).fill();

  let yPos = margin + 10;

  // Invoice Title - Large and bold
  doc
    .fontSize(36)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text("INVOICE", margin, yPos, {
      width: contentWidth,
      align: "right",
    });

  yPos += 45;

  // Invoice Number with subtle background
  const invoiceNumWidth = doc.widthOfString(bill.billNumber) + 20;
  const invoiceNumX = pageWidth - margin - invoiceNumWidth;

  doc
    .roundedRect(invoiceNumX, yPos - 5, invoiceNumWidth, 24, 3)
    .fillColor(colors.lightGray)
    .fill();

  doc
    .fontSize(12)
    .fillColor(colors.text)
    .font("Helvetica-Bold")
    .text(bill.billNumber, invoiceNumX, yPos, {
      width: invoiceNumWidth,
      align: "center",
    });

  yPos += 40;

  // ============================================
  // FROM & BILL TO SECTION - CARD STYLE
  // ============================================

  const cardHeight = 110;
  const cardGap = 15;
  const cardWidth = (contentWidth - cardGap) / 2;

  // FROM Card
  doc
    .roundedRect(margin, yPos, cardWidth, cardHeight, 5)
    .fillColor(colors.lightGray)
    .fill();

  let cardYPos = yPos + 15;

  doc
    .fontSize(8)
    .fillColor(colors.darkGray)
    .font("Helvetica-Bold")
    .text("FROM", margin + 15, cardYPos, {
      width: cardWidth - 30,
    });

  cardYPos += 18;

  doc
    .fontSize(13)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(bill.vendor?.vendorName || "Vendor Name", margin + 15, cardYPos, {
      width: cardWidth - 30,
    });

  cardYPos += 18;

  doc.fontSize(9).fillColor(colors.text).font("Helvetica");

  if (bill.vendor?.mobile) {
    doc.text(`📞 ${bill.vendor.mobile}`, margin + 15, cardYPos, {
      width: cardWidth - 30,
    });
    cardYPos += 13;
  }

  if (bill.vendor?.email) {
    doc.text(`✉ ${bill.vendor.email}`, margin + 15, cardYPos, {
      width: cardWidth - 30,
    });
    cardYPos += 13;
  }

  if (bill.vendor?.address) {
    doc.fontSize(8).text(bill.vendor.address, margin + 15, cardYPos, {
      width: cardWidth - 30,
      lineGap: 2,
    });
  }

  // BILL TO Card
  const billToX = margin + cardWidth + cardGap;
  cardYPos = yPos + 15;

  doc
    .roundedRect(billToX, yPos, cardWidth, cardHeight, 5)
    .fillColor(colors.mediumGray)
    .fill();

  doc
    .fontSize(8)
    .fillColor(colors.darkGray)
    .font("Helvetica-Bold")
    .text("BILL TO", billToX + 15, cardYPos, {
      width: cardWidth - 30,
    });

  cardYPos += 18;

  doc
    .fontSize(13)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(
      bill.customer?.customerName || "Customer Name",
      billToX + 15,
      cardYPos,
      {
        width: cardWidth - 30,
      },
    );

  cardYPos += 18;

  doc.fontSize(9).fillColor(colors.text).font("Helvetica");

  if (bill.customer?.businessName) {
    doc.text(bill.customer.businessName, billToX + 15, cardYPos, {
      width: cardWidth - 30,
    });
    cardYPos += 13;
  }

  if (bill.customer?.email) {
    doc.text(`✉ ${bill.customer.email}`, billToX + 15, cardYPos, {
      width: cardWidth - 30,
    });
  }

  yPos += cardHeight + 30;

  // ============================================
  // INVOICE DATE & STATUS - MODERN BAR
  // ============================================

  // Gradient-like bar effect
  doc.rect(margin, yPos, contentWidth, 40).fillColor(colors.secondary).fill();

  // Invoice Date
  doc.fontSize(10).fillColor(colors.white).font("Helvetica");
  doc.text("Invoice Date:", margin + 20, yPos + 13);

  doc.font("Helvetica-Bold");
  doc.text(
    new Date(bill.billDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    margin + 115,
    yPos + 13,
  );

  // Status Badge - Modern design
  const statusConfigs = {
    paid: { color: colors.success, text: "PAID" },
    partial: { color: colors.warning, text: "PARTIAL" },
    pending: { color: colors.danger, text: "PENDING" },
    cancelled: { color: colors.darkGray, text: "CANCELLED" },
  };

  const statusConfig = statusConfigs[bill.status] || statusConfigs.pending;
  const badgeX = pageWidth - margin - 110;

  doc
    .roundedRect(badgeX, yPos + 8, 100, 24, 5)
    .fillColor(statusConfig.color)
    .fill();

  doc
    .fillColor(colors.white)
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(statusConfig.text, badgeX, yPos + 13, {
      width: 100,
      align: "center",
    });

  yPos += 60;

  // ============================================
  // ITEMS TABLE - PROFESSIONAL DESIGN
  // ============================================

  const tableTop = yPos;

  // Enhanced column definitions with proper spacing
  const cols = {
    num: { x: margin, width: 30 },
    desc: { x: margin + 35, width: 200 },
    qty: { x: margin + 240, width: 60 },
    rate: { x: margin + 305, width: 75 },
    gst: { x: margin + 385, width: 50 },
    amount: { x: margin + 440, width: 105 },
  };

  // Table Header - Modern dark header
  doc.rect(margin, tableTop, contentWidth, 32).fillColor(colors.primary).fill();

  // Table Header Text with better positioning
  doc.fontSize(9).fillColor(colors.white).font("Helvetica-Bold");

  doc.text("#", cols.num.x + 10, tableTop + 11);
  doc.text("DESCRIPTION", cols.desc.x + 5, tableTop + 11);
  doc.text("QTY", cols.qty.x, tableTop + 11, {
    width: cols.qty.width,
    align: "center",
  });
  doc.text("RATE", cols.rate.x, tableTop + 11, {
    width: cols.rate.width,
    align: "right",
  });
  doc.text("GST%", cols.gst.x, tableTop + 11, {
    width: cols.gst.width,
    align: "center",
  });
  doc.text("AMOUNT", cols.amount.x, tableTop + 11, {
    width: cols.amount.width - 10,
    align: "right",
  });

  yPos = tableTop + 32;

  // Table Items with better formatting
  doc.fontSize(10).fillColor(colors.text).font("Helvetica");

  bill.items.forEach((item, index) => {
    const rowHeight = 30;

    // Alternate row background
    if (index % 2 === 0) {
      doc
        .rect(margin, yPos, contentWidth, rowHeight)
        .fillColor(colors.lightGray)
        .fill();
    }

    const textYPos = yPos + 9;

    // Row number
    doc.fillColor(colors.darkGray).font("Helvetica-Bold");
    doc.text((index + 1).toString(), cols.num.x + 10, textYPos);

    // Description
    doc.fillColor(colors.text).font("Helvetica");
    doc.text(item.description || "Item", cols.desc.x + 5, textYPos, {
      width: cols.desc.width - 10,
    });

    // Quantity
    doc.text(parseFloat(item.qty).toFixed(2), cols.qty.x, textYPos, {
      width: cols.qty.width,
      align: "center",
    });

    // Rate with Rupee symbol
    doc.font("Helvetica");
    doc.text(`₹${parseFloat(item.rate).toFixed(2)}`, cols.rate.x, textYPos, {
      width: cols.rate.width,
      align: "right",
    });

    // GST percentage
    doc.text(
      `${parseFloat(item.gstPercent).toFixed(1)}%`,
      cols.gst.x,
      textYPos,
      {
        width: cols.gst.width,
        align: "center",
      },
    );

    // Amount with Rupee symbol - Bold
    doc.font("Helvetica-Bold");
    doc.text(
      `₹${parseFloat(item.amount).toFixed(2)}`,
      cols.amount.x,
      textYPos,
      {
        width: cols.amount.width - 10,
        align: "right",
      },
    );

    yPos += rowHeight;
  });

  // Bottom border of table
  doc
    .moveTo(margin, yPos)
    .lineTo(pageWidth - margin, yPos)
    .strokeColor(colors.mediumGray)
    .lineWidth(2)
    .stroke();

  yPos += 35;

  // ============================================
  // TOTALS SECTION - CLEAN & CLEAR
  // ============================================

  const totalsX = pageWidth - margin - 280;
  const labelX = totalsX;
  const valueX = totalsX + 150;
  const rowGap = 18;

  // Subtle background for totals
  doc
    .roundedRect(totalsX - 15, yPos - 10, 295, 135, 5)
    .fillColor(colors.lightGray)
    .fill();

  yPos += 5;

  // Subtotal
  doc.fontSize(11).fillColor(colors.text).font("Helvetica");
  doc.text("Subtotal:", labelX, yPos, { width: 140, align: "right" });
  doc.font("Helvetica-Bold");
  doc.text(`₹${parseFloat(bill.subtotal).toFixed(2)}`, valueX, yPos, {
    width: 120,
    align: "right",
  });
  yPos += rowGap;

  // GST
  doc.font("Helvetica");
  doc.text("GST:", labelX, yPos, { width: 140, align: "right" });
  doc.font("Helvetica-Bold");
  doc.text(`₹${parseFloat(bill.gstTotal).toFixed(2)}`, valueX, yPos, {
    width: 120,
    align: "right",
  });
  yPos += rowGap + 8;

  // Divider line
  doc
    .moveTo(totalsX, yPos)
    .lineTo(pageWidth - margin, yPos)
    .strokeColor(colors.primary)
    .lineWidth(1.5)
    .stroke();

  yPos += 12;

  // Total Amount - Prominent
  doc.fontSize(13).font("Helvetica-Bold").fillColor(colors.primary);
  doc.text("Total Amount:", labelX, yPos, { width: 140, align: "right" });
  doc.fontSize(14);
  doc.text(`₹${parseFloat(bill.totalWithGST).toFixed(2)}`, valueX, yPos, {
    width: 120,
    align: "right",
  });
  yPos += rowGap + 5;

  // Paid Amount (if any)
  if (parseFloat(paidAmount) > 0) {
    doc.fontSize(11).font("Helvetica").fillColor(colors.success);
    doc.text("Paid:", labelX, yPos, { width: 140, align: "right" });
    doc.font("Helvetica-Bold");
    doc.text(`-₹${parseFloat(paidAmount).toFixed(2)}`, valueX, yPos, {
      width: 120,
      align: "right",
    });
    yPos += rowGap + 3;
  }

  // Amount Due (if pending)
  if (parseFloat(pendingAmount) > 0) {
    doc.fontSize(12).font("Helvetica-Bold").fillColor(colors.danger);
    doc.text("Amount Due:", labelX, yPos, { width: 140, align: "right" });
    doc.fontSize(13);
    doc.text(`₹${parseFloat(pendingAmount).toFixed(2)}`, valueX, yPos, {
      width: 120,
      align: "right",
    });
  }

  // ============================================
  // FOOTER - PROFESSIONAL TOUCH
  // ============================================

  yPos += 50;

  if (bill.note) {
    // Note section with border
    doc
      .roundedRect(margin, yPos, contentWidth - 100, 45, 3)
      .strokeColor(colors.mediumGray)
      .lineWidth(1)
      .stroke();

    doc.fontSize(8).fillColor(colors.darkGray).font("Helvetica-Bold");
    doc.text("NOTE:", margin + 10, yPos + 10);

    doc.fontSize(9).font("Helvetica").fillColor(colors.text);
    doc.text(bill.note, margin + 45, yPos + 10, {
      width: contentWidth - 155,
      lineGap: 2,
    });
  }

  // Bottom accent line
  const bottomY = pageHeight - 25;
  doc
    .moveTo(margin, bottomY)
    .lineTo(pageWidth - margin, bottomY)
    .strokeColor(colors.accent)
    .lineWidth(3)
    .stroke();

  // Thank you message
  doc.fontSize(9).fillColor(colors.darkGray).font("Helvetica-Oblique");
  doc.text("Thank you for your business!", margin, bottomY + 8, {
    width: contentWidth,
    align: "center",
  });
};
//  Template 2: Modern Professional Invoice

exports.generateTemplate2 = (doc, bill, paidAmount, pendingAmount) => {
  const pageWidth = 595.28; // A4 width
  const pageHeight = 841.89; // A4 height
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // ============================================
  // PREMIUM COLOR PALETTE
  // ============================================
  const colors = {
    primary: "#0F172A", // Deep slate
    secondary: "#1E293B", // Dark slate
    accent: "#3B82F6", // Bright blue
    accentDark: "#2563EB", // Darker blue
    success: "#10B981", // Emerald
    warning: "#F59E0B", // Amber
    danger: "#EF4444", // Red
    purple: "#8B5CF6", // Purple accent
    lightBg: "#F8FAFC", // Almost white
    cardBg: "#F1F5F9", // Light slate
    border: "#E2E8F0", // Border gray
    textPrimary: "#0F172A", // Main text
    textSecondary: "#64748B", // Secondary text
    white: "#FFFFFF",
  };

  // ============================================
  // PREMIUM HEADER WITH GRADIENT ACCENT
  // ============================================

  // Top gradient-style bars (layered effect)
  doc.rect(0, 0, pageWidth, 4).fillColor(colors.accent).fill();
  doc.rect(0, 4, pageWidth, 2).fillColor(colors.accentDark).fill();

  let yPos = margin + 15;

  // Modern Invoice Badge on left
  const badgeWidth = 130;
  doc
    .roundedRect(margin, yPos, badgeWidth, 50, 8)
    .fillColor(colors.primary)
    .fill();

  doc.fontSize(11).fillColor(colors.accent).font("Helvetica-Bold");
  doc.text("INVOICE", margin + 10, yPos + 12, {
    width: badgeWidth - 20,
    align: "center",
  });

  doc.fontSize(18).fillColor(colors.white).font("Helvetica-Bold");
  doc.text("TAX BILL", margin + 10, yPos + 28, {
    width: badgeWidth - 20,
    align: "center",
  });

  // Invoice Number - Stylish design on right
  const invoiceText = bill.billNumber;
  doc.fontSize(28).fillColor(colors.primary).font("Helvetica-Bold");
  doc.text("#", pageWidth - margin - 150, yPos + 5);

  doc.fontSize(24).fillColor(colors.accent).font("Helvetica-Bold");
  doc.text(invoiceText, pageWidth - margin - 130, yPos + 8);

  // Thin decorative line under number
  doc
    .moveTo(pageWidth - margin - 150, yPos + 45)
    .lineTo(pageWidth - margin, yPos + 45)
    .strokeColor(colors.accent)
    .lineWidth(2)
    .stroke();

  yPos += 85;

  // ============================================
  // FROM & BILL TO - PREMIUM CARD DESIGN
  // ============================================

  const cardGap = 20;
  const cardWidth = (contentWidth - cardGap) / 2;
  const cardHeight = 125;

  // FROM Card - With subtle shadow effect
  const fromCardX = margin;

  // Shadow layer
  doc
    .roundedRect(fromCardX + 2, yPos + 2, cardWidth, cardHeight, 8)
    .fillColor("#E2E8F0")
    .fill();

  // Main card
  doc
    .roundedRect(fromCardX, yPos, cardWidth, cardHeight, 8)
    .fillColor(colors.white)
    .fill();

  // Left border accent
  doc
    .roundedRect(fromCardX, yPos, 5, cardHeight, 8)
    .fillColor(colors.accent)
    .fill();

  let cardY = yPos + 15;

  doc.fontSize(7).fillColor(colors.textSecondary).font("Helvetica-Bold");
  doc.text("FROM", fromCardX + 15, cardY, {
    width: cardWidth - 25,
    letterSpacing: 1,
  });

  cardY += 16;

  doc.fontSize(14).fillColor(colors.primary).font("Helvetica-Bold");
  doc.text(bill.vendor?.vendorName || "Vendor Name", fromCardX + 15, cardY, {
    width: cardWidth - 25,
  });

  cardY += 20;

  doc.fontSize(9).fillColor(colors.textPrimary).font("Helvetica");

  if (bill.vendor?.mobile) {
    doc.text(`📱 ${bill.vendor.mobile}`, fromCardX + 15, cardY, {
      width: cardWidth - 25,
    });
    cardY += 14;
  }

  if (bill.vendor?.email) {
    doc.text(`✉️ ${bill.vendor.email}`, fromCardX + 15, cardY, {
      width: cardWidth - 25,
    });
    cardY += 14;
  }

  if (bill.vendor?.address) {
    doc.fontSize(8).fillColor(colors.textSecondary);
    doc.text(bill.vendor.address, fromCardX + 15, cardY, {
      width: cardWidth - 25,
      lineGap: 1,
    });
  }

  // BILL TO Card - With accent
  const billToX = margin + cardWidth + cardGap;
  cardY = yPos + 15;

  // Shadow layer
  doc
    .roundedRect(billToX + 2, yPos + 2, cardWidth, cardHeight, 8)
    .fillColor("#E2E8F0")
    .fill();

  // Main card with gradient-like effect
  doc
    .roundedRect(billToX, yPos, cardWidth, cardHeight, 8)
    .fillColor(colors.cardBg)
    .fill();

  // Right border accent
  doc
    .roundedRect(billToX + cardWidth - 5, yPos, 5, cardHeight, 8)
    .fillColor(colors.purple)
    .fill();

  doc.fontSize(7).fillColor(colors.textSecondary).font("Helvetica-Bold");
  doc.text("BILL TO", billToX + 15, cardY, {
    width: cardWidth - 25,
    letterSpacing: 1,
  });

  cardY += 16;

  doc.fontSize(14).fillColor(colors.primary).font("Helvetica-Bold");
  doc.text(
    bill.customer?.customerName || "Customer Name",
    billToX + 15,
    cardY,
    {
      width: cardWidth - 25,
    },
  );

  cardY += 20;

  doc.fontSize(9).fillColor(colors.textPrimary).font("Helvetica");

  if (bill.customer?.businessName) {
    doc.font("Helvetica-Bold");
    doc.text(bill.customer.businessName, billToX + 15, cardY, {
      width: cardWidth - 25,
    });
    cardY += 14;
  }

  if (bill.customer?.email) {
    doc.font("Helvetica");
    doc.text(`✉️ ${bill.customer.email}`, billToX + 15, cardY, {
      width: cardWidth - 25,
    });
  }

  yPos += cardHeight + 35;

  // ============================================
  // DATE & STATUS - MODERN DESIGN
  // ============================================

  const statusBarHeight = 45;

  // Gradient background effect
  doc
    .rect(margin, yPos, contentWidth, statusBarHeight)
    .fillColor(colors.primary)
    .fill();

  // Decorative accent corner
  doc
    .polygon([
      [margin, yPos],
      [margin + 80, yPos],
      [margin, yPos + 40],
    ])
    .fillColor(colors.accent)
    .fill();

  // Invoice Date with icon
  doc.fontSize(9).fillColor(colors.accent).font("Helvetica-Bold");
  doc.text("📅", margin + 25, yPos + 15);

  doc.fontSize(10).fillColor(colors.white).font("Helvetica");
  doc.text("Invoice Date:", margin + 45, yPos + 15);

  doc.font("Helvetica-Bold");
  const formattedDate = new Date(bill.billDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  doc.text(formattedDate, margin + 135, yPos + 15);

  // Premium Status Badge
  const statusConfigs = {
    paid: {
      color: colors.success,
      bgColor: "#ECFDF5",
      text: "✓ PAID",
      icon: "✓",
    },
    partial: {
      color: colors.warning,
      bgColor: "#FEF3C7",
      text: "◐ PARTIAL",
      icon: "◐",
    },
    pending: {
      color: colors.danger,
      bgColor: "#FEE2E2",
      text: "○ PENDING",
      icon: "○",
    },
    cancelled: {
      color: colors.textSecondary,
      bgColor: "#F1F5F9",
      text: "✕ CANCELLED",
      icon: "✕",
    },
  };

  const statusConfig = statusConfigs[bill.status] || statusConfigs.pending;
  const badgeX = pageWidth - margin - 130;
  const badgeY = yPos + 10;

  // Outer glow effect
  doc
    .roundedRect(badgeX - 2, badgeY - 2, 124, 29, 7)
    .fillColor(statusConfig.bgColor)
    .fill();

  // Main badge
  doc
    .roundedRect(badgeX, badgeY, 120, 25, 6)
    .fillColor(statusConfig.color)
    .fill();

  doc.fontSize(11).fillColor(colors.white).font("Helvetica-Bold");
  doc.text(statusConfig.text, badgeX, badgeY + 6, {
    width: 120,
    align: "center",
  });

  yPos += statusBarHeight + 35;

  // ============================================
  // ITEMS TABLE - ULTRA MODERN
  // ============================================

  const tableTop = yPos;

  // Enhanced columns with better spacing
  const cols = {
    num: { x: margin, width: 32 },
    desc: { x: margin + 37, width: 200 },
    qty: { x: margin + 242, width: 62 },
    rate: { x: margin + 309, width: 78 },
    gst: { x: margin + 392, width: 48 },
    amount: { x: margin + 445, width: 110 },
  };

  // Table header with modern gradient
  doc.rect(margin, tableTop, contentWidth, 35).fillColor(colors.primary).fill();

  // Accent line on top
  doc.rect(margin, tableTop, contentWidth, 3).fillColor(colors.accent).fill();

  // Column headers
  doc.fontSize(8).fillColor(colors.accent).font("Helvetica-Bold");

  doc.text("#", cols.num.x + 12, tableTop + 13);
  doc.text("DESCRIPTION", cols.desc.x + 5, tableTop + 13);
  doc.text("QTY", cols.qty.x, tableTop + 13, {
    width: cols.qty.width,
    align: "center",
  });
  doc.text("RATE", cols.rate.x, tableTop + 13, {
    width: cols.rate.width,
    align: "right",
  });
  doc.text("GST", cols.gst.x, tableTop + 13, {
    width: cols.gst.width,
    align: "center",
  });
  doc.text("AMOUNT", cols.amount.x + 5, tableTop + 13, {
    width: cols.amount.width - 10,
    align: "right",
  });

  yPos = tableTop + 35;

  // Table items with hover-like effect
  doc.fontSize(10).fillColor(colors.textPrimary).font("Helvetica");

  bill.items.forEach((item, index) => {
    const rowHeight = 32;

    // Alternating backgrounds with style
    if (index % 2 === 0) {
      doc
        .rect(margin, yPos, contentWidth, rowHeight)
        .fillColor(colors.lightBg)
        .fill();
    } else {
      doc
        .rect(margin, yPos, contentWidth, rowHeight)
        .fillColor(colors.white)
        .fill();
    }

    // Left accent indicator for each row
    doc
      .rect(margin, yPos, 3, rowHeight)
      .fillColor(index % 2 === 0 ? colors.accent : colors.purple)
      .fill();

    const textY = yPos + 10;

    // Row number with circle
    const numCircleX = cols.num.x + 10;
    doc
      .circle(numCircleX, textY + 5, 9)
      .fillColor(colors.cardBg)
      .fill();

    doc.fontSize(9).fillColor(colors.textPrimary).font("Helvetica-Bold");
    doc.text((index + 1).toString(), numCircleX - 3, textY + 1);

    // Description
    doc.fontSize(10).fillColor(colors.textPrimary).font("Helvetica");
    doc.text(item.description || "Item", cols.desc.x + 5, textY, {
      width: cols.desc.width - 10,
    });

    // Quantity with badge style
    doc.fontSize(9).fillColor(colors.textSecondary).font("Helvetica-Bold");
    doc.text(parseFloat(item.qty).toFixed(2), cols.qty.x, textY, {
      width: cols.qty.width,
      align: "center",
    });

    // Rate
    doc.fontSize(10).fillColor(colors.textPrimary).font("Helvetica");
    doc.text(`₹${parseFloat(item.rate).toFixed(2)}`, cols.rate.x, textY, {
      width: cols.rate.width,
      align: "right",
    });

    // GST percentage with badge
    doc.fontSize(9).fillColor(colors.textSecondary).font("Helvetica");
    doc.text(`${parseFloat(item.gstPercent).toFixed(1)}%`, cols.gst.x, textY, {
      width: cols.gst.width,
      align: "center",
    });

    // Amount - Bold and prominent
    doc.fontSize(11).fillColor(colors.primary).font("Helvetica-Bold");
    doc.text(
      `₹${parseFloat(item.amount).toFixed(2)}`,
      cols.amount.x + 5,
      textY,
      {
        width: cols.amount.width - 10,
        align: "right",
      },
    );

    yPos += rowHeight;
  });

  // Table footer with accent
  doc.rect(margin, yPos, contentWidth, 2).fillColor(colors.accent).fill();

  yPos += 30;

  // ============================================
  // TOTALS - PREMIUM DESIGN
  // ============================================

  const totalsBoxX = pageWidth - margin - 300;
  const totalsBoxWidth = 300;
  const totalsBoxHeight = 160;

  // Shadow effect
  doc
    .roundedRect(totalsBoxX + 3, yPos + 3, totalsBoxWidth, totalsBoxHeight, 10)
    .fillColor("#E2E8F0")
    .fill();

  // Main totals box
  doc
    .roundedRect(totalsBoxX, yPos, totalsBoxWidth, totalsBoxHeight, 10)
    .fillColor(colors.white)
    .fill();

  // Border
  doc
    .roundedRect(totalsBoxX, yPos, totalsBoxWidth, totalsBoxHeight, 10)
    .strokeColor(colors.border)
    .lineWidth(1.5)
    .stroke();

  // Top accent strip
  doc
    .roundedRect(totalsBoxX, yPos, totalsBoxWidth, 8, 10)
    .fillColor(colors.accent)
    .fill();

  yPos += 20;

  const labelX = totalsBoxX + 20;
  const valueX = totalsBoxX + 160;
  const rowGap = 16;

  // Subtotal
  doc.fontSize(10).fillColor(colors.textSecondary).font("Helvetica");
  doc.text("Subtotal:", labelX, yPos, { width: 130, align: "left" });
  doc.fontSize(11).fillColor(colors.textPrimary).font("Helvetica-Bold");
  doc.text(`₹${parseFloat(bill.subtotal).toFixed(2)}`, valueX, yPos, {
    width: 120,
    align: "right",
  });
  yPos += rowGap;

  // GST with icon
  doc.fontSize(10).fillColor(colors.textSecondary).font("Helvetica");
  doc.text("GST Tax:", labelX, yPos, { width: 130, align: "left" });
  doc.fontSize(11).fillColor(colors.textPrimary).font("Helvetica-Bold");
  doc.text(`₹${parseFloat(bill.gstTotal).toFixed(2)}`, valueX, yPos, {
    width: 120,
    align: "right",
  });
  yPos += rowGap + 10;

  // Stylish divider
  const dividerY = yPos;
  doc
    .moveTo(labelX, dividerY)
    .lineTo(valueX + 120, dividerY)
    .strokeColor(colors.accent)
    .lineWidth(2)
    .stroke();

  doc
    .moveTo(labelX, dividerY + 2)
    .lineTo(valueX + 120, dividerY + 2)
    .strokeColor(colors.border)
    .lineWidth(1)
    .stroke();

  yPos += 15;

  // Total Amount - Prominent
  doc.fontSize(12).fillColor(colors.primary).font("Helvetica-Bold");
  doc.text("Total Amount:", labelX, yPos, { width: 130, align: "left" });
  doc.fontSize(15).fillColor(colors.accent);
  doc.text(`₹${parseFloat(bill.totalWithGST).toFixed(2)}`, valueX, yPos, {
    width: 120,
    align: "right",
  });
  yPos += rowGap + 8;

  // Paid Amount
  if (parseFloat(paidAmount) > 0) {
    doc.fontSize(10).fillColor(colors.success).font("Helvetica");
    doc.text("✓ Paid:", labelX, yPos, { width: 130, align: "left" });
    doc.font("Helvetica-Bold");
    doc.text(`-₹${parseFloat(paidAmount).toFixed(2)}`, valueX, yPos, {
      width: 120,
      align: "right",
    });
    yPos += rowGap;
  }

  // Amount Due - Eye-catching
  if (parseFloat(pendingAmount) > 0) {
    const dueBoxY = yPos - 5;
    doc
      .roundedRect(labelX - 5, dueBoxY, 270, 26, 5)
      .fillColor("#FEE2E2")
      .fill();

    doc.fontSize(11).fillColor(colors.danger).font("Helvetica-Bold");
    doc.text("⚠ Amount Due:", labelX, yPos, { width: 130, align: "left" });
    doc.fontSize(13);
    doc.text(`₹${parseFloat(pendingAmount).toFixed(2)}`, valueX, yPos, {
      width: 120,
      align: "right",
    });
  }

  // ============================================
  // FOOTER - ELEGANT
  // ============================================

  yPos += 60;

  if (bill.note) {
    // Note card
    doc
      .roundedRect(margin, yPos, contentWidth - 120, 55, 6)
      .fillColor(colors.lightBg)
      .fill();

    doc
      .roundedRect(margin, yPos, contentWidth - 120, 55, 6)
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();

    // Note icon and label
    doc.fontSize(8).fillColor(colors.textSecondary).font("Helvetica-Bold");
    doc.text("📝 NOTE", margin + 12, yPos + 10);

    doc.fontSize(9).fillColor(colors.textPrimary).font("Helvetica");
    doc.text(bill.note, margin + 12, yPos + 25, {
      width: contentWidth - 144,
      lineGap: 2,
    });
  }

  // Bottom decorative section
  const footerY = pageHeight - 35;

  // Gradient bars
  doc.rect(0, footerY, pageWidth, 2).fillColor(colors.accent).fill();
  doc
    .rect(0, footerY + 2, pageWidth, 1)
    .fillColor(colors.accentDark)
    .fill();

  // Thank you message with style
  doc.fontSize(10).fillColor(colors.textPrimary).font("Helvetica-Bold");
  doc.text("Thank you for your business!", margin, footerY + 10, {
    width: contentWidth,
    align: "center",
  });

  doc.fontSize(8).fillColor(colors.textSecondary).font("Helvetica");
  doc.text("This is a computer generated invoice", margin, footerY + 23, {
    width: contentWidth,
    align: "center",
  });
};
// Template 3: Minimal Invoice
// Helper function to convert number to words
function numberToWords(num) {
  const ones = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
  ];
  const tens = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ];
  const teens = [
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];

  if (num === 0) return "ZERO";

  function convertLessThanThousand(n) {
    if (n === 0) return "";
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100)
      return (
        tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "")
      );
    return (
      ones[Math.floor(n / 100)] +
      " HUNDRED" +
      (n % 100 !== 0 ? " " + convertLessThanThousand(n % 100) : "")
    );
  }

  function convert(n) {
    if (n === 0) return "ZERO";

    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const remainder = n % 1000;

    let result = "";

    if (crore > 0) result += convertLessThanThousand(crore) + " CRORE ";
    if (lakh > 0) result += convertLessThanThousand(lakh) + " LAKH ";
    if (thousand > 0)
      result += convertLessThanThousand(thousand) + " THOUSAND ";
    if (remainder > 0) result += convertLessThanThousand(remainder);

    return result.trim();
  }

  return convert(Math.floor(num)) + " RUPEES";
}

exports.generateTemplate3 = (doc, bill, paidAmount, pendingAmount) => {
  const pageWidth = 595.28; // A4 width
  const pageHeight = 841.89; // A4 height
  const margin = 30;
  const contentWidth = pageWidth - margin * 2;

  // Colors matching the screenshot
  const colors = {
    border: "#0066CC", // Blue border
    headerBg: "#E6F2FF", // Light blue header background
    text: "#000000",
    lightText: "#4A4A4A",
    tableBorder: "#0066CC",
    white: "#FFFFFF",
  };

  let yPos = margin + 5;

  // ============================================
  // COMPANY LOGO & HEADER SECTION
  // ============================================

  // Logo area (left side) - placeholder for logo
  const logoSize = 60;
  doc
    .roundedRect(margin + 5, yPos, logoSize, logoSize, 5)
    .strokeColor(colors.border)
    .lineWidth(2)
    .stroke();

  // Add placeholder text in logo
  doc.fontSize(8).fillColor(colors.border).font("Helvetica-Bold");
  doc.text("LOGO", margin + 23, yPos + 26);

  // Company details (right side of logo)
  const companyX = margin + logoSize + 15;

  doc.fontSize(13).fillColor(colors.text).font("Helvetica-Bold");
  doc.text(
    bill.vendor?.companyName ||
      bill.vendor?.vendorName ||
      "Blackbull Technologies",
    companyX,
    yPos + 5,
  );

  yPos += 18;

  doc.fontSize(8).fillColor(colors.lightText).font("Helvetica");
  if (bill.vendor?.address) {
    doc.text(bill.vendor.address, companyX, yPos, {
      width: 200,
      lineGap: 1,
    });
    yPos += 12;
  } else {
    doc.text("301, Sahjanand Complex", companyX, yPos);
    yPos += 10;
    doc.text("Nr Green Valley, Valek Patiya", companyX, yPos);
    yPos += 10;
    doc.text("surat, Gujarat - 395008", companyX, yPos);
    yPos += 12;
  }

  // Right side - Name, Phone, Email, Website
  const rightInfoX = pageWidth - margin - 170;
  let rightYPos = margin + 10;

  doc.fontSize(8).fillColor(colors.text).font("Helvetica-Bold");
  doc.text("Name : ", rightInfoX, rightYPos);
  doc.font("Helvetica");
  doc.text(
    bill.customer?.customerName || "Nikhil Pansheriya",
    rightInfoX + 40,
    rightYPos,
  );
  rightYPos += 12;

  doc.font("Helvetica-Bold");
  doc.text("Phone : ", rightInfoX, rightYPos);
  doc.font("Helvetica");
  doc.text(bill.customer?.mobile || "8000698357", rightInfoX + 40, rightYPos);
  rightYPos += 12;

  doc.font("Helvetica-Bold");
  doc.text("Email : ", rightInfoX, rightYPos);
  doc.font("Helvetica");
  doc.text(
    bill.customer?.email || "contact@blackbull.in",
    rightInfoX + 40,
    rightYPos,
    {
      width: 130,
    },
  );
  rightYPos += 12;

  doc.font("Helvetica-Bold");
  doc.text("Website : ", rightInfoX, rightYPos);
  doc.font("Helvetica").fillColor(colors.border);
  doc.text(
    bill.vendor?.website || "https://blackbull.in",
    rightInfoX + 40,
    rightYPos,
    {
      width: 130,
      link: bill.vendor?.website || "https://blackbull.in",
    },
  );

  yPos = margin + logoSize + 15;

  // ============================================
  // EXPORT INVOICE HEADER WITH BORDER
  // ============================================

  // Blue border box
  const headerBoxY = yPos;
  doc
    .rect(margin, headerBoxY, contentWidth, 90)
    .strokeColor(colors.border)
    .lineWidth(2)
    .stroke();

  yPos += 8;

  // Export Invoice Title - Centered
  doc.fontSize(12).fillColor(colors.text).font("Helvetica-Bold");
  doc.text("EXPORT INVOICE", margin, yPos, {
    width: contentWidth,
    align: "center",
  });

  yPos += 15;

  // Subtitle
  doc.fontSize(7).fillColor(colors.lightText).font("Helvetica");
  doc.text(
    "Supply Meant for Export Under Bond or Letter of Undertaking without Payment of Integrated Tax (IGST)",
    margin + 10,
    yPos,
    {
      width: contentWidth - 20,
      align: "center",
    },
  );

  yPos += 12;

  // Horizontal line
  doc
    .moveTo(margin + 10, yPos)
    .lineTo(pageWidth - margin - 10, yPos)
    .strokeColor(colors.tableBorder)
    .lineWidth(1)
    .stroke();

  yPos += 8;

  // Customer Detail section
  const detailsY = yPos;
  const leftColX = margin + 10;
  const rightColX = pageWidth / 2 + 5;

  // Left column headers
  doc.fontSize(8).fillColor(colors.text).font("Helvetica-Bold");
  doc.text("Customer Detail", leftColX, yPos);

  yPos += 12;

  // Customer name and details
  doc.fontSize(8).font("Helvetica");
  const customerDetails = [
    {
      label: "Name",
      value: bill.customer?.customerName || "Blue Ridge Holidays",
    },
    { label: "Address", value: bill.customer?.address || "Australia" },
    { label: "Country", value: bill.customer?.country || "Australia" },
    { label: "Phone", value: bill.customer?.mobile || "+61 476 014 592" },
    { label: "GSTIN", value: bill.customer?.gstNumber || "-" },
    { label: "Place of Supply", value: bill.customer?.placeOfSupply || "-" },
  ];

  customerDetails.forEach((detail) => {
    doc.fillColor(colors.text).font("Helvetica-Bold");
    doc.text(detail.label, leftColX, yPos, { width: 80, continued: false });
    doc.fillColor(colors.lightText).font("Helvetica");
    doc.text(detail.value, leftColX + 55, yPos, { width: 180 });
    yPos += 10;
  });

  // Right column - Invoice details
  yPos = detailsY;

  const invoiceDetails = [
    { label: "Invoice No.", value: bill.billNumber || "INV-00012" },
    {
      label: "Invoice Date",
      value: new Date(bill.billDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    },
    {
      label: "Due Date",
      value: new Date(
        new Date(bill.billDate).setDate(new Date(bill.billDate).getDate() + 30),
      ).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    },
  ];

  invoiceDetails.forEach((detail) => {
    doc.fillColor(colors.text).font("Helvetica-Bold");
    doc.text(detail.label, rightColX, yPos, { width: 80 });
    doc.fillColor(colors.lightText).font("Helvetica");
    doc.text(detail.value, rightColX + 70, yPos, { width: 150 });
    yPos += 12;
  });

  // Right corner badge
  const badgeX = pageWidth - margin - 140;
  const badgeY = headerBoxY + 8;

  doc.rect(badgeX, badgeY, 125, 18).fillColor(colors.headerBg).fill();

  doc.fontSize(8).fillColor(colors.text).font("Helvetica-Bold");
  doc.text("ORIGINAL FOR RECIPIENT", badgeX + 5, badgeY + 5);

  yPos = headerBoxY + 95;

  // ============================================
  // ITEMS TABLE WITH BLUE BORDERS
  // ============================================

  const tableTop = yPos;
  const tableHeight = 300; // Fixed height for table

  // Outer table border
  doc
    .rect(margin, tableTop, contentWidth, tableHeight)
    .strokeColor(colors.tableBorder)
    .lineWidth(2)
    .stroke();

  // Column definitions
  const cols = {
    sr: { x: margin, width: 30 },
    desc: { x: margin + 30, width: 230 },
    hsn: { x: margin + 260, width: 65 },
    qty: { x: margin + 325, width: 55 },
    rate: { x: margin + 380, width: 85 },
    total: { x: margin + 465, width: contentWidth - 465 + margin },
  };

  // Table header
  const headerHeight = 25;
  doc
    .rect(margin, tableTop, contentWidth, headerHeight)
    .fillColor(colors.headerBg)
    .fill();

  // Header borders
  doc
    .rect(margin, tableTop, contentWidth, headerHeight)
    .strokeColor(colors.tableBorder)
    .lineWidth(1)
    .stroke();

  // Column headers
  doc.fontSize(8).fillColor(colors.text).font("Helvetica-Bold");

  doc.text("Sr.", cols.sr.x + 5, tableTop + 8);
  doc.text("No.", cols.sr.x + 5, tableTop + 16);

  doc.text("Name of Product / Service", cols.desc.x + 5, tableTop + 11);
  doc.text("HSN / SAC", cols.hsn.x + 5, tableTop + 11);
  doc.text("Qty", cols.qty.x + 15, tableTop + 11);
  doc.text("Rate", cols.rate.x + 25, tableTop + 11);
  doc.text("Total", cols.total.x + 35, tableTop + 11);

  // Vertical lines for header
  let currentX = cols.sr.x + cols.sr.width;
  doc
    .moveTo(currentX, tableTop)
    .lineTo(currentX, tableTop + headerHeight)
    .strokeColor(colors.tableBorder)
    .stroke();

  currentX = cols.desc.x + cols.desc.width;
  doc
    .moveTo(currentX, tableTop)
    .lineTo(currentX, tableTop + headerHeight)
    .strokeColor(colors.tableBorder)
    .stroke();

  currentX = cols.hsn.x + cols.hsn.width;
  doc
    .moveTo(currentX, tableTop)
    .lineTo(currentX, tableTop + headerHeight)
    .strokeColor(colors.tableBorder)
    .stroke();

  currentX = cols.qty.x + cols.qty.width;
  doc
    .moveTo(currentX, tableTop)
    .lineTo(currentX, tableTop + headerHeight)
    .strokeColor(colors.tableBorder)
    .stroke();

  currentX = cols.rate.x + cols.rate.width;
  doc
    .moveTo(currentX, tableTop)
    .lineTo(currentX, tableTop + headerHeight)
    .strokeColor(colors.tableBorder)
    .stroke();

  yPos = tableTop + headerHeight;

  // Table rows
  doc.fontSize(8).fillColor(colors.text).font("Helvetica");

  const rowHeight = 25;
  const maxRows = 10;

  bill.items.forEach((item, index) => {
    if (index < maxRows) {
      const rowY = yPos + index * rowHeight;

      // Horizontal line
      doc
        .moveTo(margin, rowY)
        .lineTo(pageWidth - margin, rowY)
        .strokeColor(colors.tableBorder)
        .lineWidth(1)
        .stroke();

      // Vertical lines
      let vLineX = cols.sr.x + cols.sr.width;
      doc
        .moveTo(vLineX, rowY)
        .lineTo(vLineX, rowY + rowHeight)
        .stroke();

      vLineX = cols.desc.x + cols.desc.width;
      doc
        .moveTo(vLineX, rowY)
        .lineTo(vLineX, rowY + rowHeight)
        .stroke();

      vLineX = cols.hsn.x + cols.hsn.width;
      doc
        .moveTo(vLineX, rowY)
        .lineTo(vLineX, rowY + rowHeight)
        .stroke();

      vLineX = cols.qty.x + cols.qty.width;
      doc
        .moveTo(vLineX, rowY)
        .lineTo(vLineX, rowY + rowHeight)
        .stroke();

      vLineX = cols.rate.x + cols.rate.width;
      doc
        .moveTo(vLineX, rowY)
        .lineTo(vLineX, rowY + rowHeight)
        .stroke();

      // Row data
      doc.text((index + 1).toString(), cols.sr.x + 10, rowY + 9);
      doc.text(item.description || "Item", cols.desc.x + 5, rowY + 9, {
        width: cols.desc.width - 10,
      });
      doc.text(item.hsnCode || "-", cols.hsn.x + 5, rowY + 9);
      doc.text(parseFloat(item.qty).toFixed(2), cols.qty.x + 5, rowY + 9, {
        width: cols.qty.width - 10,
        align: "center",
      });
      doc.text(parseFloat(item.rate).toFixed(2), cols.rate.x + 5, rowY + 9, {
        width: cols.rate.width - 10,
        align: "right",
      });
      doc.text(parseFloat(item.amount).toFixed(2), cols.total.x + 5, rowY + 9, {
        width: cols.total.width - 10,
        align: "right",
      });
    }
  });

  // Fill empty rows
  for (let i = bill.items.length; i < maxRows; i++) {
    const rowY = yPos + i * rowHeight;

    doc
      .moveTo(margin, rowY)
      .lineTo(pageWidth - margin, rowY)
      .strokeColor(colors.tableBorder)
      .lineWidth(1)
      .stroke();

    let vLineX = cols.sr.x + cols.sr.width;
    doc
      .moveTo(vLineX, rowY)
      .lineTo(vLineX, rowY + rowHeight)
      .stroke();

    vLineX = cols.desc.x + cols.desc.width;
    doc
      .moveTo(vLineX, rowY)
      .lineTo(vLineX, rowY + rowHeight)
      .stroke();

    vLineX = cols.hsn.x + cols.hsn.width;
    doc
      .moveTo(vLineX, rowY)
      .lineTo(vLineX, rowY + rowHeight)
      .stroke();

    vLineX = cols.qty.x + cols.qty.width;
    doc
      .moveTo(vLineX, rowY)
      .lineTo(vLineX, rowY + rowHeight)
      .stroke();

    vLineX = cols.rate.x + cols.rate.width;
    doc
      .moveTo(vLineX, rowY)
      .lineTo(vLineX, rowY + rowHeight)
      .stroke();
  }

  // Total row
  const totalRowY = tableTop + headerHeight + maxRows * rowHeight;

  doc
    .rect(margin, totalRowY, contentWidth, rowHeight)
    .fillColor(colors.headerBg)
    .fill();

  doc
    .rect(margin, totalRowY, contentWidth, rowHeight)
    .strokeColor(colors.tableBorder)
    .lineWidth(1)
    .stroke();

  // Vertical lines for total row
  let vX = cols.sr.x + cols.sr.width;
  doc
    .moveTo(vX, totalRowY)
    .lineTo(vX, totalRowY + rowHeight)
    .stroke();
  vX = cols.desc.x + cols.desc.width;
  doc
    .moveTo(vX, totalRowY)
    .lineTo(vX, totalRowY + rowHeight)
    .stroke();
  vX = cols.hsn.x + cols.hsn.width;
  doc
    .moveTo(vX, totalRowY)
    .lineTo(vX, totalRowY + rowHeight)
    .stroke();
  vX = cols.qty.x + cols.qty.width;
  doc
    .moveTo(vX, totalRowY)
    .lineTo(vX, totalRowY + rowHeight)
    .stroke();
  vX = cols.rate.x + cols.rate.width;
  doc
    .moveTo(vX, totalRowY)
    .lineTo(vX, totalRowY + rowHeight)
    .stroke();

  doc.fontSize(8).fillColor(colors.text).font("Helvetica-Bold");
  doc.text("Total", cols.desc.x + 5, totalRowY + 9);

  const totalQty = bill.items.reduce(
    (sum, item) => sum + parseFloat(item.qty),
    0,
  );
  doc.text(totalQty.toFixed(2), cols.qty.x + 5, totalRowY + 9, {
    width: cols.qty.width - 10,
    align: "center",
  });

  doc.text(
    parseFloat(bill.totalWithGST).toFixed(2),
    cols.total.x + 5,
    totalRowY + 9,
    {
      width: cols.total.width - 10,
      align: "right",
    },
  );

  yPos = tableTop + tableHeight + 10;

  // ============================================
  // TOTAL IN WORDS & AMOUNT BOX
  // ============================================

  // Left side - Total in words box
  const wordsBoxWidth = 300;
  const wordsBoxHeight = 45;

  doc
    .rect(margin, yPos, wordsBoxWidth, wordsBoxHeight)
    .strokeColor(colors.tableBorder)
    .lineWidth(1)
    .stroke();

  doc.fontSize(8).fillColor(colors.text).font("Helvetica-Bold");
  doc.text("Total in words", margin + 5, yPos + 5);

  yPos += 15;

  const amountInWords = numberToWords(parseFloat(bill.totalWithGST));
  doc.fontSize(8).font("Helvetica");
  doc.text(amountInWords + " ONLY", margin + 5, yPos, {
    width: wordsBoxWidth - 10,
    lineGap: 2,
  });

  // Right side - Total Amount box
  const amountBoxX = pageWidth - margin - 230;
  const amountBoxY = yPos - 15;

  doc
    .rect(amountBoxX, amountBoxY, 230, wordsBoxHeight)
    .strokeColor(colors.tableBorder)
    .lineWidth(1)
    .stroke();

  doc.fontSize(9).fillColor(colors.text).font("Helvetica-Bold");
  doc.text("Total Amount", amountBoxX + 10, amountBoxY + 8);

  doc.fontSize(13).fillColor(colors.text);
  doc.text(
    `₹ ${parseFloat(bill.totalWithGST).toFixed(2)}`,
    amountBoxX + 10,
    amountBoxY + 22,
    {
      width: 210,
      align: "right",
    },
  );

  doc.fontSize(7).font("Helvetica");
  doc.text("(E & O.E.)", amountBoxX + 10, amountBoxY + 38, {
    width: 210,
    align: "right",
  });

  yPos += wordsBoxHeight + 10;

  // ============================================
  // TERMS AND CONDITIONS SECTION
  // ============================================

  const termsBoxHeight = 85;
  const termsBoxY = yPos;

  // Left side - Terms
  doc
    .rect(margin, termsBoxY, wordsBoxWidth, termsBoxHeight)
    .strokeColor(colors.tableBorder)
    .lineWidth(1)
    .stroke();

  doc.fontSize(8).fillColor(colors.text).font("Helvetica-Bold");
  doc.text("Terms and Conditions", margin + 5, termsBoxY + 5);

  yPos = termsBoxY + 18;

  const terms = [
    "Subject to our home Jurisdiction.",
    "Our Responsibility Ceases as soon as goods leaves our Premises.",
    "Goods once sold will not taken back.",
    "Delivery Ex-Premises.",
  ];

  doc.fontSize(7).fillColor(colors.lightText).font("Helvetica");
  terms.forEach((term) => {
    doc.text(term, margin + 5, yPos, { width: wordsBoxWidth - 10 });
    yPos += 10;
  });

  // Right side - Certification box
  doc
    .rect(amountBoxX, termsBoxY, 230, termsBoxHeight)
    .strokeColor(colors.tableBorder)
    .lineWidth(1)
    .stroke();

  yPos = termsBoxY + 8;

  doc.fontSize(7).fillColor(colors.lightText).font("Helvetica-Oblique");
  doc.text(
    "Certified that the particulars given above are true and correct.",
    amountBoxX + 5,
    yPos,
    { width: 220, align: "center" },
  );

  yPos += 15;

  doc.fontSize(8).fillColor(colors.text).font("Helvetica-Bold");
  doc.text(
    `For ${bill.vendor?.companyName || bill.vendor?.vendorName || "Blackbull Technologies"}`,
    amountBoxX + 5,
    yPos,
    { width: 220, align: "center" },
  );

  yPos += 35;

  doc.fontSize(7).fillColor(colors.lightText).font("Helvetica");
  doc.text("Authorised Signatory", amountBoxX + 5, yPos, {
    width: 220,
    align: "right",
  });

  yPos = termsBoxY + termsBoxHeight + 10;

  // ============================================
  // BANK DETAILS SECTION
  // ============================================

  doc.fontSize(8).fillColor(colors.text).font("Helvetica-Bold");
  doc.text("Please find my account details below", margin, yPos, {
    width: contentWidth,
    align: "center",
  });

  yPos += 15;

  const bankDetails = bill.vendor?.bankDetails || {};

  const bankInfo = [
    `Account number :- ${bankDetails.accountNumber || "1013484429"}`,
    `Bank Name :- ${bankDetails.bankName || "KOTAK MAHINDRA BANK"}`,
    `Account Type :- ${bankDetails.accountType || "Savings"}`,
    `Account holder's name:- ${bankDetails.accountHolderName || bill.vendor?.vendorName || "NIKHIL PANSHERIYA"}`,
    `IFSC Code :- ${bankDetails.ifscCode || "KKBK00002856"}`,
    `MMID :- ${bankDetails.mmid || "9485420"}`,
    `VPA :- ${bankDetails.vpa || "panseriya138@okicici"}`,
    `Paypal id: ${bankDetails.paypalId || bill.vendor?.email || "panseriya138@gmail.com"}`,
  ];

  doc.fontSize(7).fillColor(colors.lightText).font("Helvetica");
  bankInfo.forEach((info) => {
    doc.text(info, margin, yPos);
    yPos += 9;
  });
};

// Helper function to convert number to words
function numberToWords(num) {
  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
  ];
  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  const teens = [
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];

  if (num === 0) return "zero";

  const numStr = Math.floor(num).toString();
  let words = "";

  // Lakhs
  if (numStr.length > 5) {
    const lakhs = parseInt(numStr.slice(0, -5));
    words += convertHundreds(lakhs) + " lakh ";
  }

  // Thousands
  if (numStr.length > 3) {
    const thousands = parseInt(numStr.slice(-5, -3));
    if (thousands > 0) {
      words += convertHundreds(thousands) + " thousand ";
    }
  }

  // Hundreds
  const lastThree = parseInt(numStr.slice(-3));
  words += convertHundreds(lastThree);

  // Decimals (paise)
  const decimal = Math.round((num - Math.floor(num)) * 100);
  if (decimal > 0) {
    words += " and " + convertHundreds(decimal) + " paise";
  }

  words += " rupees";

  return words.trim();

  function convertHundreds(n) {
    let str = "";
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    } else if (n >= 10) {
      str += teens[n - 10] + " ";
      return str.trim();
    }
    if (n > 0) {
      str += ones[n] + " ";
    }
    return str.trim();
  }
}

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
