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
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // ============================================
  // HEADER SECTION - Company Logo & Invoice Title
  // ============================================

  // Invoice Title - Top Right
  doc.fontSize(28).fillColor("#2C3E50").text("INVOICE", margin, margin, {
    align: "right",
    width: contentWidth,
  });

  // Invoice Number - Top Right
  doc
    .fontSize(12)
    .fillColor("#34495E")
    .text(bill.billNumber, margin, margin + 35, {
      align: "right",
      width: contentWidth,
    });

  doc.moveDown(1);

  // ============================================
  // VENDOR INFORMATION - Left Side
  // ============================================

  let yPos = margin + 80;

  doc.fontSize(10).fillColor("#7F8C8D").text("FROM", margin, yPos);
  yPos += 15;

  doc.fontSize(12).fillColor("#2C3E50").font("Helvetica-Bold");
  doc.text(bill.vendor?.vendorName || "Vendor Name", margin, yPos);
  yPos += 18;

  doc.fontSize(10).fillColor("#34495E").font("Helvetica");

  if (bill.vendor?.mobile) {
    doc.text(`Phone: ${bill.vendor.mobile}`, margin, yPos);
    yPos += 14;
  }

  if (bill.vendor?.email) {
    doc.text(`Email: ${bill.vendor.email}`, margin, yPos);
    yPos += 14;
  }

  if (bill.vendor?.address) {
    doc.text(`${bill.vendor.address}`, margin, yPos, { width: 200 });
  }

  // ============================================
  // CUSTOMER INFORMATION - Right Side
  // ============================================

  yPos = margin + 80;
  const rightCol = pageWidth - margin - 200;

  doc.fontSize(10).fillColor("#7F8C8D").text("BILL TO", rightCol, yPos);
  yPos += 15;

  doc.fontSize(12).fillColor("#2C3E50").font("Helvetica-Bold");
  doc.text(bill.customer?.customerName || "Customer Name", rightCol, yPos);
  yPos += 18;

  doc.fontSize(10).fillColor("#34495E").font("Helvetica");

  if (bill.customer?.businessName) {
    doc.text(bill.customer.businessName, rightCol, yPos);
    yPos += 14;
  }

  if (bill.customer?.mobile) {
    doc.text(`Phone: ${bill.customer.mobile}`, rightCol, yPos);
    yPos += 14;
  }

  if (bill.customer?.email) {
    doc.text(`Email: ${bill.customer.email}`, rightCol, yPos);
    yPos += 14;
  }

  // ============================================
  // INVOICE DETAILS BAR
  // ============================================

  yPos = margin + 200;

  // Background bar
  doc.rect(margin, yPos, contentWidth, 30).fillColor("#ECF0F1").fill();

  // Invoice Date
  doc.fillColor("#2C3E50").fontSize(10);
  doc.text("Invoice Date:", margin + 10, yPos + 10);
  doc.font("Helvetica-Bold");
  doc.text(
    new Date(bill.billDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    margin + 90,
    yPos + 10,
  );

  // Due Date (if applicable)
  if (bill.dueDate) {
    doc.font("Helvetica");
    doc.text("Due Date:", margin + 200, yPos + 10);
    doc.font("Helvetica-Bold");
    doc.text(
      new Date(bill.dueDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      margin + 260,
      yPos + 10,
    );
  }

  // Status Badge
  const statusColors = {
    paid: "#27AE60",
    partial: "#F39C12",
    pending: "#E74C3C",
    cancelled: "#95A5A6",
  };

  const statusColor = statusColors[bill.status] || statusColors.pending;
  const statusX = pageWidth - margin - 80;

  doc
    .roundedRect(statusX, yPos + 5, 70, 20, 3)
    .fillColor(statusColor)
    .fill();

  doc
    .fillColor("#FFFFFF")
    .fontSize(9)
    .font("Helvetica-Bold")
    .text(bill.status.toUpperCase(), statusX, yPos + 10, {
      width: 70,
      align: "center",
    });

  // ============================================
  // ITEMS TABLE
  // ============================================

  yPos += 60;
  const tableTop = yPos;
  const tableHeaders = [
    { label: "#", x: margin, width: 30 },
    { label: "Description", x: margin + 35, width: 230 },
    { label: "Qty", x: margin + 270, width: 50, align: "right" },
    { label: "Rate", x: margin + 325, width: 70, align: "right" },
    { label: "GST%", x: margin + 400, width: 50, align: "right" },
    { label: "Amount", x: margin + 455, width: 100, align: "right" },
  ];

  // Table Header Background
  doc.rect(margin, tableTop, contentWidth, 25).fillColor("#34495E").fill();

  // Table Headers
  doc.fillColor("#FFFFFF").fontSize(10).font("Helvetica-Bold");
  tableHeaders.forEach((header) => {
    doc.text(header.label, header.x + 5, tableTop + 7, {
      width: header.width - 10,
      align: header.align || "left",
    });
  });

  // Table Items
  yPos = tableTop + 30;
  doc.fillColor("#2C3E50").font("Helvetica").fontSize(9);

  bill.items.forEach((item, index) => {
    // Alternate row background
    if (index % 2 === 0) {
      doc
        .rect(margin, yPos - 5, contentWidth, 22)
        .fillColor("#F8F9FA")
        .fill();
    }

    doc.fillColor("#2C3E50");

    // Item Number
    doc.text(index + 1, tableHeaders[0].x + 5, yPos, {
      width: tableHeaders[0].width - 10,
    });

    // Description
    doc.text(item.description || "Item", tableHeaders[1].x + 5, yPos, {
      width: tableHeaders[1].width - 10,
    });

    // Quantity
    doc.text(item.qty.toString(), tableHeaders[2].x + 5, yPos, {
      width: tableHeaders[2].width - 10,
      align: "right",
    });

    // Rate
    doc.text(
      `₹${parseFloat(item.rate).toFixed(2)}`,
      tableHeaders[3].x + 5,
      yPos,
      {
        width: tableHeaders[3].width - 10,
        align: "right",
      },
    );

    // GST%
    doc.text(item.gstPercent.toString(), tableHeaders[4].x + 5, yPos, {
      width: tableHeaders[4].width - 10,
      align: "right",
    });

    // Amount
    doc.text(
      `₹${parseFloat(item.amount).toFixed(2)}`,
      tableHeaders[5].x + 5,
      yPos,
      {
        width: tableHeaders[5].width - 10,
        align: "right",
      },
    );

    yPos += 22;
  });

  // Table Bottom Border
  doc
    .moveTo(margin, yPos)
    .lineTo(pageWidth - margin, yPos)
    .strokeColor("#BDC3C7")
    .lineWidth(1)
    .stroke();

  // ============================================
  // TOTALS SECTION
  // ============================================

  yPos += 30;
  const totalsX = pageWidth - margin - 250;

  // Helper function for totals rows
  const addTotalRow = (label, value, isBold = false, isLarge = false) => {
    doc
      .fontSize(isLarge ? 12 : 10)
      .font(isBold ? "Helvetica-Bold" : "Helvetica")
      .fillColor("#2C3E50");

    doc.text(label, totalsX, yPos, { width: 150, align: "left" });
    doc.text(value, totalsX + 155, yPos, { width: 95, align: "right" });
    yPos += isLarge ? 25 : 18;
  };

  // Subtotal
  addTotalRow("Subtotal:", `₹${parseFloat(bill.subtotal).toFixed(2)}`);

  // GST
  if (bill.gstTotal > 0) {
    addTotalRow("GST:", `₹${parseFloat(bill.gstTotal).toFixed(2)}`);
  }

  // Separator line
  doc
    .moveTo(totalsX, yPos - 5)
    .lineTo(pageWidth - margin, yPos - 5)
    .strokeColor("#34495E")
    .lineWidth(1)
    .stroke();

  yPos += 5;

  // Total Amount
  addTotalRow(
    "Total Amount:",
    `₹${parseFloat(bill.totalWithGST).toFixed(2)}`,
    true,
    true,
  );

  // Paid Amount (if any)
  if (parseFloat(paidAmount) > 0) {
    addTotalRow("Paid:", `₹${parseFloat(paidAmount).toFixed(2)}`, false);
  }

  // Pending Amount
  if (parseFloat(pendingAmount) > 0) {
    yPos += 5;

    // Highlight pending amount
    doc
      .roundedRect(totalsX - 10, yPos - 8, 260, 30, 5)
      .fillColor("#FEF5E7")
      .fill();

    doc.fillColor("#E67E22").fontSize(12).font("Helvetica-Bold");

    doc.text("Amount Due:", totalsX, yPos, { width: 150, align: "left" });
    doc.text(`₹${parseFloat(pendingAmount).toFixed(2)}`, totalsX + 155, yPos, {
      width: 95,
      align: "right",
    });
  }

  // ============================================
  // NOTES SECTION
  // ============================================

  if (bill.note) {
    yPos += 60;

    doc.fontSize(10).fillColor("#7F8C8D").font("Helvetica-Bold");
    doc.text("Notes:", margin, yPos);

    yPos += 15;
    doc.fontSize(9).fillColor("#34495E").font("Helvetica");
    doc.text(bill.note, margin, yPos, {
      width: contentWidth - 100,
      align: "left",
    });
  }

  // ============================================
  // FOOTER
  // ============================================

  const footerY = pageHeight - 60;

  // Separator line
  doc
    .moveTo(margin, footerY)
    .lineTo(pageWidth - margin, footerY)
    .strokeColor("#BDC3C7")
    .lineWidth(1)
    .stroke();

  // Thank you message
  doc
    .fontSize(10)
    .fillColor("#7F8C8D")
    .font("Helvetica-Oblique")
    .text("Thank you for your business!", margin, footerY + 15, {
      width: contentWidth,
      align: "center",
    });

  // Company details footer (if available)
  if (bill.vendor?.website || bill.vendor?.gstNumber) {
    doc.fontSize(8).fillColor("#95A5A6").font("Helvetica");
    let footerText = "";

    if (bill.vendor.website) footerText += bill.vendor.website;
    if (bill.vendor.gstNumber) {
      if (footerText) footerText += " | ";
      footerText += `GSTIN: ${bill.vendor.gstNumber}`;
    }

    doc.text(footerText, margin, footerY + 35, {
      width: contentWidth,
      align: "center",
    });
  }
};

//  Template 2: Modern Professional Invoice
exports.generateTemplate2 = (doc, bill, paidAmount, pendingAmount) => {
  const pageWidth = 595.28; // A4 width
  const pageHeight = 841.89; // A4 height
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let yPos = margin;

  // ============================================
  // HEADER SECTION
  // ============================================

  // Logo placeholder (left side)
  doc
    .fontSize(10)
    .fillColor("#7F8C8D")
    .font("Helvetica")
    .text("LOGO", margin, yPos);

  // Invoice Title (right side)
  doc
    .fontSize(20)
    .fillColor("#2C3E50")
    .font("Helvetica-Bold")
    .text("INVOICE", pageWidth - margin - 100, yPos, {
      width: 100,
      align: "right",
    });

  yPos += 40;

  // Horizontal line separator
  doc
    .moveTo(margin, yPos)
    .lineTo(pageWidth - margin, yPos)
    .strokeColor("#34495E")
    .lineWidth(2)
    .stroke();

  yPos += 20;

  // ============================================
  // INVOICE INFO & BILL DETAILS
  // ============================================

  doc.fontSize(9).fillColor("#2C3E50").font("Helvetica");

  // Invoice Number (left)
  doc.text(`Invoice No: ${bill.billNumber}`, margin, yPos);

  // Date (right)
  doc.text(
    `Date: ${new Date(bill.billDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`,
    pageWidth - margin - 150,
    yPos,
  );

  yPos += 30;

  // ============================================
  // VENDOR & CUSTOMER DETAILS (Two Columns)
  // ============================================

  const leftColX = margin;
  const rightColX = margin + 260;
  const detailsStartY = yPos;

  // Vendor Details (Left Column)
  doc.fontSize(8).fillColor("#7F8C8D").text("FROM:", leftColX, yPos);
  yPos += 12;

  doc.fontSize(10).fillColor("#2C3E50").font("Helvetica-Bold");
  doc.text(bill.vendor?.vendorName || "Vendor Name", leftColX, yPos);
  yPos += 14;

  doc.fontSize(9).font("Helvetica").fillColor("#34495E");
  if (bill.vendor?.mobile) {
    doc.text(`Phone: ${bill.vendor.mobile}`, leftColX, yPos);
    yPos += 12;
  }
  if (bill.vendor?.email) {
    doc.text(`Email: ${bill.vendor.email}`, leftColX, yPos);
    yPos += 12;
  }
  if (bill.vendor?.address) {
    doc.text(bill.vendor.address, leftColX, yPos, { width: 240 });
  }

  // Customer Details (Right Column)
  yPos = detailsStartY;
  doc.fontSize(8).fillColor("#7F8C8D").text("BILL TO:", rightColX, yPos);
  yPos += 12;

  doc.fontSize(10).fillColor("#2C3E50").font("Helvetica-Bold");
  doc.text(bill.customer?.customerName || "Customer Name", rightColX, yPos);
  yPos += 14;

  doc.fontSize(9).font("Helvetica").fillColor("#34495E");
  if (bill.customer?.businessName) {
    doc.text(bill.customer.businessName, rightColX, yPos);
    yPos += 12;
  }
  if (bill.customer?.mobile) {
    doc.text(`Phone: ${bill.customer.mobile}`, rightColX, yPos);
    yPos += 12;
  }
  if (bill.customer?.email) {
    doc.text(`Email: ${bill.customer.email}`, rightColX, yPos);
  }

  yPos = Math.max(yPos, detailsStartY + 80) + 30;

  // ============================================
  // ITEMS TABLE
  // ============================================

  const tableStartY = yPos;
  const tableWidth = contentWidth;

  // Column definitions
  const columns = {
    description: { x: margin, width: 260, align: "left" },
    quantity: { x: margin + 260, width: 80, align: "center" },
    unitPrice: { x: margin + 340, width: 90, align: "right" },
    total: { x: margin + 430, width: 85, align: "right" },
  };

  // Table Header Background
  doc.rect(margin, yPos, tableWidth, 25).fillColor("#34495E").fill();

  // Table Header Text
  doc.fontSize(10).fillColor("#FFFFFF").font("Helvetica-Bold");

  doc.text("DESCRIPTION", columns.description.x + 5, yPos + 7, {
    width: columns.description.width - 10,
    align: columns.description.align,
  });

  doc.text("QUANTITY", columns.quantity.x + 5, yPos + 7, {
    width: columns.quantity.width - 10,
    align: columns.quantity.align,
  });

  doc.text("UNIT PRICE", columns.unitPrice.x + 5, yPos + 7, {
    width: columns.unitPrice.width - 10,
    align: columns.unitPrice.align,
  });

  doc.text("TOTAL", columns.total.x + 5, yPos + 7, {
    width: columns.total.width - 10,
    align: columns.total.align,
  });

  yPos += 25;

  // Draw table border
  doc
    .rect(margin, tableStartY, tableWidth, 25)
    .strokeColor("#34495E")
    .lineWidth(1)
    .stroke();

  // ============================================
  // ITEMS ROWS
  // ============================================

  const rowHeight = 22;
  doc.fontSize(9).fillColor("#2C3E50").font("Helvetica");

  bill.items.forEach((item, index) => {
    // Alternate row background
    if (index % 2 === 0) {
      doc.rect(margin, yPos, tableWidth, rowHeight).fillColor("#F8F9FA").fill();
    }

    doc.fillColor("#2C3E50");

    // Draw borders for this row
    doc
      .rect(margin, yPos, tableWidth, rowHeight)
      .strokeColor("#E0E0E0")
      .lineWidth(0.5)
      .stroke();

    // Description
    doc.text(item.description || "Item", columns.description.x + 5, yPos + 6, {
      width: columns.description.width - 10,
      align: columns.description.align,
    });

    // Quantity
    doc.text(item.qty.toString(), columns.quantity.x + 5, yPos + 6, {
      width: columns.quantity.width - 10,
      align: columns.quantity.align,
    });

    // Unit Price
    doc.text(
      `₹${parseFloat(item.rate).toFixed(2)}`,
      columns.unitPrice.x + 5,
      yPos + 6,
      {
        width: columns.unitPrice.width - 10,
        align: columns.unitPrice.align,
      },
    );

    // Total
    doc.text(
      `₹${parseFloat(item.amount).toFixed(2)}`,
      columns.total.x + 5,
      yPos + 6,
      {
        width: columns.total.width - 10,
        align: columns.total.align,
      },
    );

    yPos += rowHeight;
  });

  // Add empty rows for clean look (like Excel template)
  const emptyRows = Math.max(0, 3 - (bill.items.length % 3));
  for (let i = 0; i < emptyRows; i++) {
    doc
      .rect(margin, yPos, tableWidth, rowHeight)
      .strokeColor("#E0E0E0")
      .lineWidth(0.5)
      .stroke();
    yPos += rowHeight;
  }

  // ============================================
  // NOTES & TOTALS SECTION
  // ============================================

  yPos += 10;
  const notesHeight = 80;
  const notesWidth = 320;
  const totalsWidth = tableWidth - notesWidth;

  // Notes Box
  doc
    .rect(margin, yPos, notesWidth, notesHeight)
    .strokeColor("#34495E")
    .lineWidth(1)
    .stroke();

  doc
    .fontSize(8)
    .fillColor("#7F8C8D")
    .font("Helvetica-Bold")
    .text("Additional Information/Comments:", margin + 5, yPos + 5);

  if (bill.note) {
    doc
      .fontSize(9)
      .fillColor("#2C3E50")
      .font("Helvetica")
      .text(bill.note, margin + 5, yPos + 20, {
        width: notesWidth - 10,
        align: "left",
      });
  }

  // Totals Box - Right Side
  const totalsX = margin + notesWidth;
  let totalsY = yPos;
  const totalRowHeight = 26;

  // Helper function to draw total row
  const drawTotalRow = (label, value, isBold = false, fontSize = 12) => {
    // Background for total rows
    if (isBold) {
      doc
        .rect(totalsX, totalsY, totalsWidth, totalRowHeight)
        .fillColor("#ECF0F1")
        .fill();
    }

    // Border
    doc
      .rect(totalsX, totalsY, totalsWidth, totalRowHeight)
      .strokeColor("#34495E")
      .lineWidth(1)
      .stroke();

    // Text
    doc
      .fontSize(fontSize)
      .fillColor("#2C3E50")
      .font(isBold ? "Helvetica-Bold" : "Helvetica");

    doc.text(label, totalsX + 10, totalsY + 7, {
      width: 100,
      align: "left",
    });

    doc.text(`₹${parseFloat(value).toFixed(2)}`, totalsX + 115, totalsY + 7, {
      width: totalsWidth - 125,
      align: "right",
    });

    totalsY += totalRowHeight;
  };

  // Subtotal
  drawTotalRow("SUBTOTAL", bill.subtotal, true, 12);

  // GST/Sales Tax
  drawTotalRow("SALES TAX", bill.gstTotal, true, 12);

  // Grand Total
  doc.fontSize(16).font("Helvetica-Bold");
  drawTotalRow("TOTAL", bill.totalWithGST, true, 16);

  // ============================================
  // PAYMENT STATUS
  // ============================================

  totalsY += 10;

  if (parseFloat(paidAmount) > 0) {
    doc
      .fontSize(9)
      .fillColor("#27AE60")
      .font("Helvetica")
      .text(
        `Paid: ₹${parseFloat(paidAmount).toFixed(2)}`,
        totalsX + 10,
        totalsY,
      );
    totalsY += 15;
  }

  if (parseFloat(pendingAmount) > 0) {
    doc
      .fontSize(9)
      .fillColor("#E74C3C")
      .font("Helvetica-Bold")
      .text(
        `Balance Due: ₹${parseFloat(pendingAmount).toFixed(2)}`,
        totalsX + 10,
        totalsY,
      );
  }

  // ============================================
  // FOOTER
  // ============================================

  const footerY = pageHeight - 80;

  // Separator line
  doc
    .moveTo(margin, footerY)
    .lineTo(pageWidth - margin, footerY)
    .strokeColor("#BDC3C7")
    .lineWidth(1)
    .stroke();

  // Thank you message
  doc
    .fontSize(10)
    .fillColor("#7F8C8D")
    .font("Helvetica-Oblique")
    .text("Thank you for your business!", margin, footerY + 15, {
      width: contentWidth,
      align: "center",
    });

  // Terms & Conditions or additional info
  if (bill.vendor?.gstNumber) {
    doc
      .fontSize(8)
      .fillColor("#95A5A6")
      .font("Helvetica")
      .text(`GSTIN: ${bill.vendor.gstNumber}`, margin, footerY + 35, {
        width: contentWidth,
        align: "center",
      });
  }

  // Page number (optional)
  doc
    .fontSize(8)
    .fillColor("#BDC3C7")
    .text("Page 1", margin, pageHeight - 30, {
      width: contentWidth,
      align: "center",
    });
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
