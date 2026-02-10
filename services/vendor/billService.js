const {
  BillModel,
  BillItemModel,
  ChallanModel,
  CustomerModel,
  VendorModel,
} = require("../../models");
const invoiceSettingsService = require("./invoiceSettingsService");
const { generateBillPDF } = require("../../utils/templateRenderer");

exports.createBill = async (vendorId, payload) => {
  const {
    customerId,
    challanIds,
    billDate,
    discountPercent = 0,
    gstPercent = 0,
    customInvoicePrefix = null, // NEW: Allow custom prefix per bill
    note = null,
  } = payload;

  // Get invoice settings
  const invoiceSettings =
    await invoiceSettingsService.getInvoiceSettings(vendorId);

  // Get next invoice number
  const invoiceInfo =
    await invoiceSettingsService.getNextInvoiceNumber(vendorId);

  // Determine which prefix to use: custom (if provided) OR system default
  const finalPrefix = customInvoicePrefix || invoiceSettings.prefix;

  // Create full bill number: prefix + numeric part
  const billNumber = `${finalPrefix}${String(invoiceInfo.numericPart).padStart(
    String(invoiceSettings.startCount).length,
    "0",
  )}`;

  // Fetch challans
  const challans = await ChallanModel.findAll({
    where: {
      id: challanIds,
      vendorId,
      customerId,
    },
    include: [
      {
        association: "items",
        include: ["category"],
      },
    ],
  });

  if (challans.length === 0) {
    throw new Error("No valid challans found");
  }

  // Calculate totals
  let subtotal = 0;
  const billItems = [];

  challans.forEach((challan) => {
    challan.items.forEach((item) => {
      const itemTotal = item.pricePerUnit * item.qty;
      subtotal += itemTotal;

      billItems.push({
        productName: item.productName,
        categoryId: item.categoryId,
        qty: item.qty,
        unit: item.unit,
        pricePerUnit: item.pricePerUnit,
        amount: itemTotal,
        challanId: challan.id,
      });
    });
  });

  const discountAmount = (subtotal * discountPercent) / 100;
  const totalWithoutGST = subtotal - discountAmount;
  const gstTotal = (totalWithoutGST * gstPercent) / 100;
  const totalWithGST = totalWithoutGST + gstTotal;

  // Create bill with template from settings
  const bill = await BillModel.create({
    billNumber,
    invoicePrefix: finalPrefix, // Store the prefix used
    invoiceCount: invoiceInfo.numericPart, // Store numeric part
    customInvoicePrefix: customInvoicePrefix, // Store if custom prefix was used
    invoiceTemplate: invoiceSettings.invoiceTemplate || "template1", // Use template from settings
    vendorId,
    customerId,
    billDate,
    subtotal,
    gstTotal,
    totalWithoutGST,
    totalWithGST,
    totalAmount: totalWithGST,
    paidAmount: 0,
    pendingAmount: totalWithGST,
    status: "pending",
    note,
    challanIds: JSON.stringify(challanIds),
  });

  // Create bill items
  const itemsWithBillId = billItems.map((item) => ({
    ...item,
    billId: bill.id,
  }));

  await BillItemModel.bulkCreate(itemsWithBillId);

  // Update challans as billed
  await ChallanModel.update(
    { status: "billed" },
    {
      where: {
        id: challanIds,
      },
    },
  );

  // Reserve the invoice number
  await invoiceSettingsService.reserveInvoiceNumber(
    vendorId,
    invoiceInfo.numericPart,
  );

  // Fetch complete bill with relations
  const completeBill = await BillModel.findByPk(bill.id, {
    include: [
      {
        association: "customer",
        include: ["vendor"],
      },
      {
        association: "items",
        include: ["category"],
      },
    ],
  });

  return completeBill;
};

exports.listBills = async ({
  vendorId,
  page = 1,
  limit = 20,
  status,
  customerId,
}) => {
  const where = { vendorId };

  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  const offset = (page - 1) * limit;

  const { count, rows } = await BillModel.findAndCountAll({
    where,
    include: [
      {
        association: "customer",
        attributes: ["id", "customerName", "mobileNumber", "company"],
      },
    ],
    order: [["createdAt", "DESC"]],
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  return {
    rows,
    total: count,
    page: parseInt(page),
    totalPages: Math.ceil(count / limit),
  };
};

exports.getBillById = async (billId, vendorId) => {
  const bill = await BillModel.findOne({
    where: { id: billId, vendorId },
    include: [
      {
        association: "customer",
        include: ["vendor"],
      },
      {
        association: "items",
        include: ["category"],
      },
    ],
  });

  if (!bill) {
    throw new Error("Bill not found");
  }

  return bill;
};

exports.editBill = async (billId, vendorId, payload) => {
  const bill = await BillModel.findOne({
    where: { id: billId, vendorId },
  });

  if (!bill) {
    throw new Error("Bill not found");
  }

  const {
    billDate,
    discountPercent,
    gstPercent,
    customInvoicePrefix, // NEW: Allow changing prefix
    note,
  } = payload;

  const updateData = {};

  if (billDate) updateData.billDate = billDate;
  if (note !== undefined) updateData.note = note;

  // Allow updating custom prefix
  if (customInvoicePrefix !== undefined) {
    updateData.customInvoicePrefix = customInvoicePrefix;

    // Regenerate bill number with new prefix
    const numericPart = bill.invoiceCount || bill.billNumber.replace(/\D/g, "");
    const invoiceSettings =
      await invoiceSettingsService.getInvoiceSettings(vendorId);
    const finalPrefix = customInvoicePrefix || invoiceSettings.prefix;

    updateData.billNumber = `${finalPrefix}${String(numericPart).padStart(
      String(invoiceSettings.startCount).length,
      "0",
    )}`;
    updateData.invoicePrefix = finalPrefix;
  }

  if (discountPercent !== undefined || gstPercent !== undefined) {
    const items = await BillItemModel.findAll({
      where: { billId: bill.id },
    });

    const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0);
    const discount = discountPercent !== undefined ? discountPercent : 0;
    const gst = gstPercent !== undefined ? gstPercent : 0;

    const discountAmount = (subtotal * discount) / 100;
    const totalWithoutGST = subtotal - discountAmount;
    const gstTotal = (totalWithoutGST * gst) / 100;
    const totalWithGST = totalWithoutGST + gstTotal;

    updateData.subtotal = subtotal;
    updateData.gstTotal = gstTotal;
    updateData.totalWithoutGST = totalWithoutGST;
    updateData.totalWithGST = totalWithGST;
    updateData.totalAmount = totalWithGST;
    updateData.pendingAmount = totalWithGST - bill.paidAmount;
  }

  await bill.update(updateData);

  return this.getBillById(billId, vendorId);
};

exports.markBillPaid = async (billId, vendorId, payload) => {
  const bill = await this.getBillById(billId, vendorId);

  const { paidAmount, paymentDate, paymentMode } = payload;

  const newPaidAmount =
    Number(bill.paidAmount) + Number(paidAmount || bill.pendingAmount);
  const newPendingAmount = Number(bill.totalAmount) - newPaidAmount;

  let status = "pending";
  if (newPendingAmount <= 0) {
    status = "paid";
  } else if (newPaidAmount > 0) {
    status = "partial";
  }

  await bill.update({
    paidAmount: newPaidAmount,
    pendingAmount: newPendingAmount,
    status,
  });

  return this.getBillById(billId, vendorId);
};

exports.generateBillPdf = async (billId, vendorId, templateOverride = null) => {
  const bill = await this.getBillById(billId, vendorId);

  const templateToUse = templateOverride || bill.invoiceTemplate || "template1";

  const pdfBuffer = await generateBillPDF(bill, templateToUse);
  return pdfBuffer;
};

exports.getWhatsappLinkForBill = async (
  billId,
  vendorId,
  customMessage = null,
) => {
  const bill = await this.getBillById(billId, vendorId);

  const message =
    customMessage ||
    `Hello ${bill.customer.customerName}, your bill ${bill.billNumber} for ₹${bill.totalAmount} is pending. Please make payment at your earliest convenience.`;

  const whatsappLink = `https://wa.me/${bill.customer.mobileNumber}?text=${encodeURIComponent(message)}`;

  return { whatsappLink, message };
};

exports.deleteBill = async (billId, vendorId) => {
  const bill = await BillModel.findOne({
    where: { id: billId, vendorId },
  });

  if (!bill) {
    throw new Error("Bill not found");
  }

  // Update challans back to unpaid
  if (bill.challanIds) {
    const challanIds = JSON.parse(bill.challanIds);
    await ChallanModel.update(
      { status: "unpaid" },
      {
        where: { id: challanIds },
      },
    );
  }

  await bill.destroy();
  return true;
};

exports.getVendorPendingBillTotal = async (vendorId) => {
  const result = await BillModel.findOne({
    where: { vendorId },
    attributes: [
      [
        BillModel.sequelize.fn("SUM", BillModel.sequelize.col("pendingAmount")),
        "totalPending",
      ],
    ],
  });

  return {
    totalPending: result?.dataValues?.totalPending || 0,
  };
};

exports.updateBillTemplate = async (billId, vendorId, templateId) => {
  const bill = await BillModel.findOne({
    where: { id: billId, vendorId },
  });

  if (!bill) {
    throw new Error("Bill not found");
  }

  await bill.update({ invoiceTemplate: templateId });

  return this.getBillById(billId, vendorId);
};
