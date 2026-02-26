const {
  SalesDebitNoteModel,
  SalesDebitNoteItemModel,
  CustomerModel,
  VendorModel,
  FirmModel,
  SalesDebitNotePaymentModel,
  AccountTransactionModel,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");

function toNumber(v) {
  return parseFloat(v || 0);
}

async function generateNoteNumber(vendorId) {
  const prefix = "SDN";
  const count = await SalesDebitNoteModel.count({ where: { vendorId } });
  return `${prefix}-${new Date().getFullYear()}-${count + 1001}`;
}

exports.createSalesDebitNote = async (vendorId, payload) => {
  const {
    customerId,
    invoicePrefix,
    invoiceNo,
    noteDate,
    items = [],
    otherCharge = 0,
    invoiceDiscount = 0,
    termsAndConditions,
    signatureImage,
    showSignature,
    note,
  } = payload;

  if (!customerId) throw new Error("customerId is required");

  return await sequelize.transaction(async (t) => {
    const finalNoteNumber = await generateNoteNumber(vendorId);

    let taxableAmount = 0;
    let gstTotal = 0;

    const salesDebitNoteItems = items.map((item) => {
      const qty = toNumber(item.qty || 1);
      const price = toNumber(item.price || 0);
      const discount = toNumber(item.discount || 0);
      const gstPercent = toNumber(item.gstPercent || 0);

      // Calculate taxable value (handling discount)
      const amount = qty * price;
      const discountAmount = (amount * discount) / 100;
      const taxableValue = +(amount - discountAmount).toFixed(2);

      const gstAmt = +((taxableValue * gstPercent) / 100).toFixed(2);
      const total = +(taxableValue + gstAmt).toFixed(2);

      taxableAmount += taxableValue;
      gstTotal += gstAmt;

      return {
        itemName: item.itemName || "Item",
        hsn: item.hsn || "",
        qty,
        unit: item.unit || "",
        price,
        taxType: item.taxType || "Exclusive",
        discount,
        taxableValue,
        gstPercent,
        total,
      };
    });

    const totalAmount = +(taxableAmount + gstTotal).toFixed(2);
    const finalAmount = +(
      totalAmount +
      toNumber(otherCharge) -
      toNumber(invoiceDiscount)
    ).toFixed(2);

    const salesDebitNote = await SalesDebitNoteModel.create(
      {
        noteNumber: finalNoteNumber,
        invoicePrefix,
        invoiceNo,
        noteDate: noteDate || new Date(),
        vendorId,
        customerId,
        taxableAmount,
        gstTotal,
        otherCharge: toNumber(otherCharge),
        invoiceDiscount: toNumber(invoiceDiscount),
        totalAmount,
        finalAmount,
        paidAmount: 0,
        pendingAmount: finalAmount,
        termsAndConditions,
        signatureImage,
        showSignature: !!showSignature,
        status: payload.status || "unpaid",
        note,
      },
      { transaction: t },
    );

    await SalesDebitNoteItemModel.bulkCreate(
      salesDebitNoteItems.map((i) => ({
        ...i,
        salesDebitNoteId: salesDebitNote.id,
      })),
      { transaction: t },
    );

    return await SalesDebitNoteModel.findByPk(salesDebitNote.id, {
      include: [
        { model: SalesDebitNoteItemModel, as: "items" },
        { model: CustomerModel, as: "customer" },
      ],
      transaction: t,
    });
  });
};

exports.listSalesDebitNotes = async ({
  vendorId,
  customerId,
  page = 1,
  size = 20,
  search,
  fromDate,
  toDate,
  status,
  sortBy = "noteDate",
  sortOrder = "DESC",
} = {}) => {
  const where = { vendorId };

  if (customerId) where.customerId = Number(customerId);
  if (status) where.status = status;

  if (fromDate || toDate) {
    where.noteDate = {};
    if (fromDate) where.noteDate[Op.gte] = new Date(fromDate);
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      where.noteDate[Op.lte] = endDate;
    }
  }

  if (search) {
    where[Op.or] = [{ noteNumber: { [Op.like]: `%${search}%` } }];
  }

  const result = await SalesDebitNoteModel.findAndCountAll({
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
    order: [[sortBy, sortOrder.toUpperCase()]],
    distinct: true,
  });

  return {
    total: result.count,
    rows: result.rows,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(result.count / Number(size)),
  };
};

exports.getSalesDebitNoteById = async (id, vendorId) => {
  const salesDebitNote = await SalesDebitNoteModel.findOne({
    where: { id, vendorId },
    include: [
      { model: SalesDebitNoteItemModel, as: "items" },
      { model: CustomerModel, as: "customer" },
      {
        model: VendorModel,
        as: "vendor",
        include: [{ model: FirmModel, as: "firm" }],
      },
    ],
  });

  if (!salesDebitNote) throw new Error("Sales Debit Note not found");

  return salesDebitNote;
};

exports.updateSalesDebitNote = async (id, vendorId, payload) => {
  const {
    customerId,
    invoicePrefix,
    invoiceNo,
    noteDate,
    items = [],
    otherCharge,
    invoiceDiscount,
    termsAndConditions,
    signatureImage,
    showSignature,
    note,
    status,
  } = payload;

  return await sequelize.transaction(async (t) => {
    const salesDebitNote = await SalesDebitNoteModel.findOne({
      where: { id, vendorId },
      transaction: t,
    });

    if (!salesDebitNote) throw new Error("Sales Debit Note not found");

    let taxableAmount = 0;
    let gstTotal = 0;

    const salesDebitNoteItems = items.map((item) => {
      const qty = toNumber(item.qty || 1);
      const price = toNumber(item.price || 0);
      const discount = toNumber(item.discount || 0);
      const gstPercent = toNumber(item.gstPercent || 0);

      const amount = qty * price;
      const discountAmount = (amount * discount) / 100;
      const taxableValue = +(amount - discountAmount).toFixed(2);

      const gstAmt = +((taxableValue * gstPercent) / 100).toFixed(2);
      const total = +(taxableValue + gstAmt).toFixed(2);

      taxableAmount += taxableValue;
      gstTotal += gstAmt;

      return {
        itemName: item.itemName || "Item",
        hsn: item.hsn || "",
        qty,
        unit: item.unit || "",
        price,
        taxType: item.taxType || "Exclusive",
        discount,
        taxableValue,
        gstPercent,
        total,
        salesDebitNoteId: id,
      };
    });

    const currentOtherCharge =
      otherCharge !== undefined
        ? toNumber(otherCharge)
        : toNumber(salesDebitNote.otherCharge);
    const currentInvoiceDiscount =
      invoiceDiscount !== undefined
        ? toNumber(invoiceDiscount)
        : toNumber(salesDebitNote.invoiceDiscount);

    const totalAmount = +(taxableAmount + gstTotal).toFixed(2);
    const finalAmount = +(
      totalAmount +
      currentOtherCharge -
      currentInvoiceDiscount
    ).toFixed(2);

    await salesDebitNote.update(
      {
        invoicePrefix: invoicePrefix || salesDebitNote.invoicePrefix,
        invoiceNo: invoiceNo || salesDebitNote.invoiceNo,
        noteDate: noteDate || salesDebitNote.noteDate,
        customerId: customerId || salesDebitNote.customerId,
        taxableAmount,
        gstTotal,
        otherCharge: currentOtherCharge,
        invoiceDiscount: currentInvoiceDiscount,
        totalAmount,
        finalAmount,
        pendingAmount: +(
          finalAmount - toNumber(salesDebitNote.paidAmount)
        ).toFixed(2),
        termsAndConditions:
          termsAndConditions !== undefined
            ? termsAndConditions
            : salesDebitNote.termsAndConditions,
        signatureImage:
          signatureImage !== undefined
            ? signatureImage
            : salesDebitNote.signatureImage,
        showSignature:
          showSignature !== undefined
            ? !!showSignature
            : salesDebitNote.showSignature,
        status: status || salesDebitNote.status,
        note: note !== undefined ? note : salesDebitNote.note,
      },
      { transaction: t },
    );

    await SalesDebitNoteItemModel.destroy({
      where: { salesDebitNoteId: id },
      transaction: t,
    });

    await SalesDebitNoteItemModel.bulkCreate(salesDebitNoteItems, {
      transaction: t,
    });

    return await SalesDebitNoteModel.findByPk(id, {
      include: [
        { model: SalesDebitNoteItemModel, as: "items" },
        { model: CustomerModel, as: "customer" },
      ],
      transaction: t,
    });
  });
};

exports.deleteSalesDebitNote = async (id, vendorId) => {
  return await sequelize.transaction(async (t) => {
    const salesDebitNote = await SalesDebitNoteModel.findOne({
      where: { id, vendorId },
      transaction: t,
    });

    if (!salesDebitNote) throw new Error("Sales Debit Note not found");

    await SalesDebitNoteItemModel.destroy({
      where: { salesDebitNoteId: salesDebitNote.id },
      transaction: t,
    });

    await salesDebitNote.destroy({ transaction: t });

    return true;
  });
};

exports.recordPayment = async (vendorId, payload) => {
  const {
    salesDebitNoteId,
    amount,
    paymentDate,
    method,
    accountId,
    reference,
    note,
    receiptNumber,
  } = payload;

  if (!salesDebitNoteId) throw new Error("salesDebitNoteId is required");
  if (!amount || amount <= 0) throw new Error("Valid amount is required");

  return await sequelize.transaction(async (t) => {
    const noteEntry = await SalesDebitNoteModel.findOne({
      where: { id: salesDebitNoteId, vendorId },
      transaction: t,
    });

    if (!noteEntry) throw new Error("Sales Debit Note not found");

    // Generate receipt number if not provided
    let finalReceiptNumber = receiptNumber;
    if (!finalReceiptNumber) {
      const count = await SalesDebitNotePaymentModel.count({
        where: { vendorId },
        transaction: t,
      });
      finalReceiptNumber = `PR-${count + 1}`;
    }

    // Create payment record
    const payment = await SalesDebitNotePaymentModel.create(
      {
        receiptNumber: finalReceiptNumber,
        salesDebitNoteId,
        vendorId,
        customerId: noteEntry.customerId,
        accountId,
        amount,
        paymentDate: paymentDate || new Date(),
        method,
        reference,
        note,
        status: "completed",
      },
      { transaction: t },
    );

    // Update Note balance and status
    const newPaidAmount = +(
      toNumber(noteEntry.paidAmount) + toNumber(amount)
    ).toFixed(2);
    const newPendingAmount = +(
      toNumber(noteEntry.finalAmount) - newPaidAmount
    ).toFixed(2);

    let newStatus = "partial";
    if (newPendingAmount <= 0) {
      newStatus = "paid";
    } else if (newPaidAmount === 0) {
      newStatus = "unpaid";
    }

    await noteEntry.update(
      {
        paidAmount: newPaidAmount,
        pendingAmount: Math.max(0, newPendingAmount),
        status: newStatus,
      },
      { transaction: t },
    );

    // Create Account Transaction if account is selected
    if (accountId) {
      await AccountTransactionModel.create(
        {
          vendorId,
          accountId,
          transactionType: "PAYMENT_IN",
          amount,
          transactionDate: paymentDate || new Date(),
          remark: note || `Payment for Debit Note ${noteEntry.noteNumber}`,
          voucherNumber: finalReceiptNumber,
          refId: payment.id,
          refType: "SalesDebitNotePayment",
        },
        { transaction: t },
      );
    }

    return payment;
  });
};
