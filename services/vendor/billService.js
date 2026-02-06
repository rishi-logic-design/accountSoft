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
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  // ============================================
  // HEADER - INVOICE TITLE & NUMBER
  // ============================================

  let yPos = margin + 20;

  // Invoice Title - Right aligned
  doc
    .fontSize(32)
    .fillColor("#2C3E50")
    .font("Helvetica-Bold")
    .text("INVOICE", margin, yPos, {
      width: contentWidth,
      align: "right",
    });

  yPos += 40;

  // Invoice/Bill Number - Right aligned, smaller
  doc
    .fontSize(11)
    .fillColor("#5D6D7E")
    .font("Helvetica")
    .text(bill.billNumber, margin, yPos, {
      width: contentWidth,
      align: "right",
    });

  yPos += 50;

  // ============================================
  // FROM & BILL TO SECTION (Two Columns)
  // ============================================

  const leftColX = margin;
  const rightColX = pageWidth / 2 + 20;

  // FROM Section (Left)
  doc
    .fontSize(9)
    .fillColor("#95A5A6")
    .font("Helvetica")
    .text("FROM", leftColX, yPos);

  yPos += 15;

  doc
    .fontSize(11)
    .fillColor("#2C3E50")
    .font("Helvetica-Bold")
    .text(bill.vendor?.vendorName || "Vendor Name", leftColX, yPos);

  yPos += 16;

  doc.fontSize(9).fillColor("#34495E").font("Helvetica");

  if (bill.vendor?.mobile) {
    doc.text(`Phone: ${bill.vendor.mobile}`, leftColX, yPos);
    yPos += 14;
  }

  if (bill.vendor?.email) {
    doc.text(`Email: ${bill.vendor.email}`, leftColX, yPos);
    yPos += 14;
  }

  if (bill.vendor?.address) {
    doc.text(bill.vendor.address, leftColX, yPos, { width: 220 });
  }

  // BILL TO Section (Right)
  yPos = margin + 110; // Reset to same starting position

  doc
    .fontSize(9)
    .fillColor("#95A5A6")
    .font("Helvetica")
    .text("BILL TO", rightColX, yPos);

  yPos += 15;

  doc
    .fontSize(11)
    .fillColor("#2C3E50")
    .font("Helvetica-Bold")
    .text(bill.customer?.customerName || "Customer Name", rightColX, yPos);

  yPos += 16;

  doc.fontSize(9).fillColor("#34495E").font("Helvetica");

  if (bill.customer?.businessName) {
    doc.text(bill.customer.businessName, rightColX, yPos);
    yPos += 14;
  }

  if (bill.customer?.email) {
    doc.text(`Email: ${bill.customer.email}`, rightColX, yPos);
  }

  yPos = margin + 220; // Move down for next section

  // ============================================
  // INVOICE DATE & STATUS BAR
  // ============================================

  // Light gray background bar
  doc.rect(margin, yPos, contentWidth, 35).fillColor("#F5F6F7").fill();

  // Invoice Date - Left side
  doc.fontSize(10).fillColor("#2C3E50").font("Helvetica");

  doc.text("Invoice Date:", margin + 15, yPos + 11);

  doc.font("Helvetica-Bold");
  doc.text(
    new Date(bill.billDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    margin + 95,
    yPos + 11,
  );

  // Status Badge - Right side
  const statusColors = {
    paid: "#27AE60",
    partial: "#F39C12",
    pending: "#E74C3C",
    cancelled: "#95A5A6",
  };

  const statusColor = statusColors[bill.status] || statusColors.pending;
  const statusText = bill.status.toUpperCase();
  const badgeX = pageWidth - margin - 100;

  doc
    .roundedRect(badgeX, yPos + 7, 90, 22, 3)
    .fillColor(statusColor)
    .fill();

  doc
    .fillColor("#FFFFFF")
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(statusText, badgeX, yPos + 11, {
      width: 90,
      align: "center",
    });

  yPos += 60;

  // ============================================
  // ITEMS TABLE
  // ============================================

  const tableTop = yPos;

  // Column definitions
  const cols = {
    num: { x: margin, width: 35 },
    desc: { x: margin + 35, width: 220 },
    qty: { x: margin + 255, width: 70 },
    rate: { x: margin + 325, width: 70 },
    gst: { x: margin + 395, width: 60 },
    amount: { x: margin + 455, width: 90 },
  };

  // Table Header - Dark background
  doc.rect(margin, tableTop, contentWidth, 30).fillColor("#34495E").fill();

  // Table Header Text
  doc.fontSize(10).fillColor("#FFFFFF").font("Helvetica-Bold");

  doc.text("#", cols.num.x + 8, tableTop + 10);
  doc.text("Description", cols.desc.x + 5, tableTop + 10);
  doc.text("Qty", cols.qty.x + 5, tableTop + 10, {
    width: cols.qty.width - 10,
    align: "center",
  });
  doc.text("Rate", cols.rate.x + 5, tableTop + 10, {
    width: cols.rate.width - 10,
    align: "right",
  });
  doc.text("GST%", cols.gst.x + 5, tableTop + 10, {
    width: cols.gst.width - 10,
    align: "center",
  });
  doc.text("Amount", cols.amount.x + 5, tableTop + 10, {
    width: cols.amount.width - 10,
    align: "right",
  });

  yPos = tableTop + 30;

  // Table Items
  doc.fontSize(9).fillColor("#2C3E50").font("Helvetica");

  bill.items.forEach((item, index) => {
    const rowHeight = 26;

    // Alternate row background
    if (index % 2 === 1) {
      doc
        .rect(margin, yPos, contentWidth, rowHeight)
        .fillColor("#FAFAFA")
        .fill();
    }

    doc.fillColor("#2C3E50");

    // Row number
    doc.text((index + 1).toString(), cols.num.x + 8, yPos + 8);

    // Description
    doc.text(item.description || "Item", cols.desc.x + 5, yPos + 8, {
      width: cols.desc.width - 10,
    });

    // Quantity
    doc.text(parseFloat(item.qty).toFixed(2), cols.qty.x + 5, yPos + 8, {
      width: cols.qty.width - 10,
      align: "center",
    });

    // Rate with Rupee symbol
    doc.text(
      `₹${parseFloat(item.rate).toFixed(2)}`,
      cols.rate.x + 5,
      yPos + 8,
      {
        width: cols.rate.width - 10,
        align: "right",
      },
    );

    // GST percentage
    doc.text(parseFloat(item.gstPercent).toFixed(2), cols.gst.x + 5, yPos + 8, {
      width: cols.gst.width - 10,
      align: "center",
    });

    // Amount with Rupee symbol
    doc.text(
      `₹${parseFloat(item.amount).toFixed(2)}`,
      cols.amount.x + 5,
      yPos + 8,
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
    .strokeColor("#D5DBDB")
    .lineWidth(1)
    .stroke();

  yPos += 40;

  // ============================================
  // TOTALS SECTION (Right Aligned)
  // ============================================

  const totalsX = pageWidth - margin - 250;
  const labelX = totalsX;
  const valueX = totalsX + 140;

  doc.fontSize(10).fillColor("#2C3E50").font("Helvetica");

  // Subtotal
  doc.text("Subtotal:", labelX, yPos, { width: 130, align: "right" });
  doc.text(`₹${parseFloat(bill.subtotal).toFixed(2)}`, valueX, yPos, {
    width: 100,
    align: "right",
  });
  yPos += 20;

  // GST
  doc.text("GST:", labelX, yPos, { width: 130, align: "right" });
  doc.text(`₹${parseFloat(bill.gstTotal).toFixed(2)}`, valueX, yPos, {
    width: 100,
    align: "right",
  });
  yPos += 25;

  // Horizontal line
  doc
    .moveTo(totalsX, yPos - 5)
    .lineTo(pageWidth - margin, yPos - 5)
    .strokeColor("#34495E")
    .lineWidth(1)
    .stroke();

  // Total Amount
  doc.fontSize(12).font("Helvetica-Bold");
  doc.text("Total Amount:", labelX, yPos, { width: 130, align: "right" });
  doc.text(`₹${parseFloat(bill.totalWithGST).toFixed(2)}`, valueX, yPos, {
    width: 100,
    align: "right",
  });
  yPos += 25;

  // Paid Amount (if any)
  if (parseFloat(paidAmount) > 0) {
    doc.fontSize(10).font("Helvetica").fillColor("#27AE60");
    doc.text("Paid:", labelX, yPos, { width: 130, align: "right" });
    doc.text(`₹${parseFloat(paidAmount).toFixed(2)}`, valueX, yPos, {
      width: 100,
      align: "right",
    });
    yPos += 25;
  }

  // Amount Due (if pending)
  if (parseFloat(pendingAmount) > 0) {
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#E67E22");
    doc.text("Amount Due:", labelX, yPos, { width: 130, align: "right" });
    doc.text(`₹${parseFloat(pendingAmount).toFixed(2)}`, valueX, yPos, {
      width: 100,
      align: "right",
    });
  }

  // ============================================
  // FOOTER
  // ============================================

  if (bill.note) {
    yPos += 60;
    doc.fontSize(9).fillColor("#7F8C8D").font("Helvetica-Oblique");
    doc.text(`Note: ${bill.note}`, margin, yPos, {
      width: contentWidth - 100,
    });
  }
};

//  Template 2: Modern Professional Invoice

exports.generateTemplate2 = (doc, bill, paidAmount, pendingAmount) => {
  const pageWidth = 595.28; // A4 width
  const pageHeight = 841.89; // A4 height
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let yPos = margin + 20;

  // ============================================
  // HEADER - INVOICE TITLE & NUMBER
  // ============================================

  // Invoice Title - Right aligned
  doc
    .fontSize(32)
    .fillColor("#2C3E50")
    .font("Helvetica-Bold")
    .text("INVOICE", margin, yPos, {
      width: contentWidth,
      align: "right",
    });

  yPos += 40;

  // Invoice/Bill Number - Right aligned
  doc
    .fontSize(11)
    .fillColor("#5D6D7E")
    .font("Helvetica")
    .text(bill.billNumber, margin, yPos, {
      width: contentWidth,
      align: "right",
    });

  yPos += 50;

  // ============================================
  // FROM & BILL TO SECTION
  // ============================================

  const leftColX = margin;
  const rightColX = pageWidth / 2 + 20;

  // FROM Section
  doc
    .fontSize(9)
    .fillColor("#95A5A6")
    .font("Helvetica")
    .text("FROM", leftColX, yPos);

  yPos += 15;

  doc
    .fontSize(11)
    .fillColor("#2C3E50")
    .font("Helvetica-Bold")
    .text(bill.vendor?.vendorName || "Vendor Name", leftColX, yPos);

  yPos += 16;

  doc.fontSize(9).fillColor("#34495E").font("Helvetica");

  if (bill.vendor?.mobile) {
    doc.text(`Phone: ${bill.vendor.mobile}`, leftColX, yPos);
    yPos += 14;
  }

  if (bill.vendor?.email) {
    doc.text(`Email: ${bill.vendor.email}`, leftColX, yPos);
    yPos += 14;
  }

  if (bill.vendor?.address) {
    doc.text(bill.vendor.address, leftColX, yPos, { width: 220 });
  }

  // BILL TO Section
  yPos = margin + 110;

  doc
    .fontSize(9)
    .fillColor("#95A5A6")
    .font("Helvetica")
    .text("BILL TO", rightColX, yPos);

  yPos += 15;

  doc
    .fontSize(11)
    .fillColor("#2C3E50")
    .font("Helvetica-Bold")
    .text(bill.customer?.customerName || "Customer Name", rightColX, yPos);

  yPos += 16;

  doc.fontSize(9).fillColor("#34495E").font("Helvetica");

  if (bill.customer?.businessName) {
    doc.text(bill.customer.businessName, rightColX, yPos);
    yPos += 14;
  }

  if (bill.customer?.email) {
    doc.text(`Email: ${bill.customer.email}`, rightColX, yPos);
  }

  yPos = margin + 220;

  // ============================================
  // INVOICE DATE & STATUS BAR
  // ============================================

  doc.rect(margin, yPos, contentWidth, 35).fillColor("#F5F6F7").fill();

  doc.fontSize(10).fillColor("#2C3E50").font("Helvetica");

  doc.text("Invoice Date:", margin + 15, yPos + 11);
  doc.font("Helvetica-Bold");
  doc.text(
    new Date(bill.billDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    margin + 95,
    yPos + 11,
  );

  // Status Badge
  const statusColors = {
    paid: "#27AE60",
    partial: "#F39C12",
    pending: "#E74C3C",
    cancelled: "#95A5A6",
  };

  const statusColor = statusColors[bill.status] || statusColors.pending;
  const statusText = bill.status.toUpperCase();
  const badgeX = pageWidth - margin - 100;

  doc
    .roundedRect(badgeX, yPos + 7, 90, 22, 3)
    .fillColor(statusColor)
    .fill();

  doc
    .fillColor("#FFFFFF")
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(statusText, badgeX, yPos + 11, {
      width: 90,
      align: "center",
    });

  yPos += 60;

  // ============================================
  // ITEMS TABLE
  // ============================================

  const tableTop = yPos;

  const cols = {
    num: { x: margin, width: 35 },
    desc: { x: margin + 35, width: 220 },
    qty: { x: margin + 255, width: 70 },
    rate: { x: margin + 325, width: 70 },
    gst: { x: margin + 395, width: 60 },
    amount: { x: margin + 455, width: 90 },
  };

  // Table Header
  doc.rect(margin, tableTop, contentWidth, 30).fillColor("#34495E").fill();

  doc.fontSize(10).fillColor("#FFFFFF").font("Helvetica-Bold");

  doc.text("#", cols.num.x + 8, tableTop + 10);
  doc.text("Description", cols.desc.x + 5, tableTop + 10);
  doc.text("Qty", cols.qty.x + 5, tableTop + 10, {
    width: cols.qty.width - 10,
    align: "center",
  });
  doc.text("Rate", cols.rate.x + 5, tableTop + 10, {
    width: cols.rate.width - 10,
    align: "right",
  });
  doc.text("GST%", cols.gst.x + 5, tableTop + 10, {
    width: cols.gst.width - 10,
    align: "center",
  });
  doc.text("Amount", cols.amount.x + 5, tableTop + 10, {
    width: cols.amount.width - 10,
    align: "right",
  });

  yPos = tableTop + 30;

  // Table Rows
  doc.fontSize(9).fillColor("#2C3E50").font("Helvetica");

  bill.items.forEach((item, index) => {
    const rowHeight = 26;

    if (index % 2 === 1) {
      doc
        .rect(margin, yPos, contentWidth, rowHeight)
        .fillColor("#FAFAFA")
        .fill();
    }

    doc.fillColor("#2C3E50");

    doc.text((index + 1).toString(), cols.num.x + 8, yPos + 8);
    doc.text(item.description || "Item", cols.desc.x + 5, yPos + 8, {
      width: cols.desc.width - 10,
    });
    doc.text(parseFloat(item.qty).toFixed(2), cols.qty.x + 5, yPos + 8, {
      width: cols.qty.width - 10,
      align: "center",
    });
    doc.text(
      `₹${parseFloat(item.rate).toFixed(2)}`,
      cols.rate.x + 5,
      yPos + 8,
      { width: cols.rate.width - 10, align: "right" },
    );
    doc.text(parseFloat(item.gstPercent).toFixed(2), cols.gst.x + 5, yPos + 8, {
      width: cols.gst.width - 10,
      align: "center",
    });
    doc.text(
      `₹${parseFloat(item.amount).toFixed(2)}`,
      cols.amount.x + 5,
      yPos + 8,
      { width: cols.amount.width - 10, align: "right" },
    );

    yPos += rowHeight;
  });

  doc
    .moveTo(margin, yPos)
    .lineTo(pageWidth - margin, yPos)
    .strokeColor("#D5DBDB")
    .lineWidth(1)
    .stroke();

  yPos += 40;

  // ============================================
  // TOTALS SECTION
  // ============================================

  const totalsX = pageWidth - margin - 250;
  const labelX = totalsX;
  const valueX = totalsX + 140;

  doc.fontSize(10).fillColor("#2C3E50").font("Helvetica");

  doc.text("Subtotal:", labelX, yPos, { width: 130, align: "right" });
  doc.text(`₹${parseFloat(bill.subtotal).toFixed(2)}`, valueX, yPos, {
    width: 100,
    align: "right",
  });
  yPos += 20;

  doc.text("GST:", labelX, yPos, { width: 130, align: "right" });
  doc.text(`₹${parseFloat(bill.gstTotal).toFixed(2)}`, valueX, yPos, {
    width: 100,
    align: "right",
  });
  yPos += 25;

  doc
    .moveTo(totalsX, yPos - 5)
    .lineTo(pageWidth - margin, yPos - 5)
    .strokeColor("#34495E")
    .lineWidth(1)
    .stroke();

  doc.fontSize(12).font("Helvetica-Bold");
  doc.text("Total Amount:", labelX, yPos, { width: 130, align: "right" });
  doc.text(`₹${parseFloat(bill.totalWithGST).toFixed(2)}`, valueX, yPos, {
    width: 100,
    align: "right",
  });
  yPos += 25;

  if (parseFloat(paidAmount) > 0) {
    doc.fontSize(10).font("Helvetica").fillColor("#27AE60");
    doc.text("Paid:", labelX, yPos, { width: 130, align: "right" });
    doc.text(`₹${parseFloat(paidAmount).toFixed(2)}`, valueX, yPos, {
      width: 100,
      align: "right",
    });
    yPos += 25;
  }

  if (parseFloat(pendingAmount) > 0) {
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#E67E22");
    doc.text("Amount Due:", labelX, yPos, { width: 130, align: "right" });
    doc.text(`₹${parseFloat(pendingAmount).toFixed(2)}`, valueX, yPos, {
      width: 100,
      align: "right",
    });
  }

  if (bill.note) {
    yPos += 60;
    doc.fontSize(9).fillColor("#7F8C8D").font("Helvetica-Oblique");
    doc.text(`Note: ${bill.note}`, margin, yPos, { width: contentWidth - 100 });
  }
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
