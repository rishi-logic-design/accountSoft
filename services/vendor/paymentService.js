const {
  PaymentModel,
  TransactionModel,
  VendorModel,
  CustomerModel,
  BillModel,
  ChallanModel,
  sequelize,
} = require("../../models");
const { generatePaymentNumber } = require("../../utils/paymentUtil");
const { Op } = require("sequelize");

function toNumber(v) {
  return parseFloat(v || 0);
}

exports.createPayment = async (vendorId, payload) => {
  const {
    type,
    customerId,
    amout,
    paymentDate,
    method,
    reference,
    note,
    billId,
    challanId,
    attachments = [],
    bankname,
    accountNumber,
    ifscCode,
    upiId,
    status = "completed",
  } = payload;

  if (!type || !["inward", "outward"].includes(type)) {
    throw new Error("Invalid payment type. Must be 'inward' or 'outward'");
  }
  if (!amount || toNumber(amount) <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  if (!paymentDate) {
    throw new Error("Payment date is required");
  }
  if (method === "bank") {
    if (!bankName) throw new Error("Bank name is required for bank payments");
    if (!accountNumber)
      throw new Error("Account number is required for bank payments");
    if (!ifscCode) throw new Error("IFSC code is required for bank payments");
  }
  if (method === "online" && !upiId) {
    throw new Error("UPI ID is required for online payments");
  }

  return await sequelize.transaction(async (t) => {
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) throw new Error("Vendor not found");

    if (customerId) {
      const cust = await CustomerModel.findByPk(customerId, { transaction: t });
      if (!cust) throw new Error("Customer not found");
    }

    if (billId) {
      const bill = await BillModel.findByPk(billId, { transaction: t });
      if (!bill) throw new Error("Bill not found");
    }

    if (challanId) {
      const ch = await ChallanModel.findByPk(challanId, { transaction: t });
      if (!ch) throw new Error("Challan not found");
    }

    const paymentNumber = await generatePaymentNumber(PaymentModel, t);

    const payment = await PaymentModel.create(
      {
        paymentNumber,
        vendorId,
        customerId: customerId || null,
        type,
        amount: toNumber(amount).toFixed(2),
        paymentDate,
        method: method || "cash",
        reference: reference || null,
        note: note || null,
        attachments: attachments.length ? JSON.stringify(attachments) : null,
        billId: billId || null,
        challanId: challanId || null,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        ifscCode: ifscCode || null,
        upiId: upiId || null,
        status: status || "completed",
      },
      { transaction: t }
    );

    if (TransactionModel) {
      await TransactionModel.create(
        {
          vendorId,
          customerId: customerId || null,
          amount: toNumber(amount).toFixed(2),
          type: "payment",
          description: note || `Payment ${paymentNumber}`,
          transactionDate: paymentDate,
          billId: billId || null,
          challanId: challanId || null,
          paymentId: payment.id,
        },
        { transaction: t }
      );
    }
    return payment;
  });
};

exports.listPayments = async ({
  vendorId,
  type,
  customerId,
  method,
  status,
  fromDate,
  toDate,
  page = 1,
  size = 20,
  search,
} = {}) => {
  const where = {};

  if (vendorId) where.vendorId = vendorId;
  if (type) where.type = type;
  if (customerId) where.customerId = customerId;
  if (method) where.method = method;
  if (status) where.status = status;

  if (fromDate || toDate) {
    where.paymentDate = {};
    if (fromDate) where.paymentDate[Op.gte] = fromDate;
    if (toDate) where.paymentDate[Op.lte] = toDate;
  }

  if (search) {
    where[Op.or] = [
      { paymentNumber: { [Op.like]: `%${search}%` } },
      { reference: { [Op.like]: `%${search}%` } },
    ];
  }

  const result = await PaymentModel.findAndCountAll({
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
    order: [
      ["paymentDate", "DESC"],
      ["createdAt", "DESC"],
    ],
    distinct: true,
  });

  return {
    total: result.count,
    rows: result.rows,
    page: Number(page),
    totalPages: Math.ceil(result.count / Number(size)),
  };
};

exports.getPaymentById = async (id, vendorId) => {
  const where = { id };
  if (vendorId) where.vendorId = vendorId;

  const payment = await PaymentModel.findOne({
    where,
    include: [
      {
        model: CustomerModel,
        as: "customer",
        attributes: [
          "id",
          "customerName",
          "businessName",
          "mobileNumber",
          "email",
        ],
      },
      {
        model: BillModel,
        as: "bill",
        attributes: ["id", "billNumber", "totalAmount"],
      },
      {
        model: ChallanModel,
        as: "challan",
        attributes: ["id", "challanNumber"],
      },
    ],
  });

  if (!payment) throw new Error("Payment not found");

  const txn = TransactionModel
    ? await TransactionModel.findOne({ where: { paymentId: payment.id } })
    : null;

  return { payment, transaction: txn };
};

exports.updatePayment = async (id, vendorId, payload) => {
  const {
    customerId,
    amount,
    paymentDate,
    method,
    reference,
    note,
    billId,
    challanId,
    attachments,
    bankName,
    accountNumber,
    ifscCode,
    upiId,
    status,
  } = payload;

  return await sequelize.transaction(async (t) => {
    const payment = await PaymentModel.findOne({
      where: { id, vendorId },
      transaction: t,
    });

    if (!payment) throw new Error("Payment not found");

    // Validations
    if (amount && toNumber(amount) <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (method === "bank") {
      if (!bankName && !payment.bankName)
        throw new Error("Bank name is required");
      if (!accountNumber && !payment.accountNumber)
        throw new Error("Account number is required");
      if (!ifscCode && !payment.ifscCode)
        throw new Error("IFSC code is required");
    }

    // Update payment
    const updateData = {};
    if (customerId !== undefined) updateData.customerId = customerId;
    if (amount) updateData.amount = toNumber(amount).toFixed(2);
    if (paymentDate) updateData.paymentDate = paymentDate;
    if (method) updateData.method = method;
    if (reference !== undefined) updateData.reference = reference;
    if (note !== undefined) updateData.note = note;
    if (billId !== undefined) updateData.billId = billId;
    if (challanId !== undefined) updateData.challanId = challanId;
    if (attachments) updateData.attachments = JSON.stringify(attachments);
    if (bankName !== undefined) updateData.bankName = bankName;
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber;
    if (ifscCode !== undefined) updateData.ifscCode = ifscCode;
    if (upiId !== undefined) updateData.upiId = upiId;
    if (status) updateData.status = status;

    await payment.update(updateData, { transaction: t });

    // Update transaction if exists
    if (TransactionModel && (amount || paymentDate || note)) {
      const txn = await TransactionModel.findOne({
        where: { paymentId: payment.id },
        transaction: t,
      });

      if (txn) {
        const txnUpdate = {};
        if (amount) txnUpdate.amount = toNumber(amount).toFixed(2);
        if (paymentDate) txnUpdate.transactionDate = paymentDate;
        if (note) txnUpdate.description = note;
        await txn.update(txnUpdate, { transaction: t });
      }
    }

    return payment;
  });
};

exports.deletePayment = async (id, vendorId) => {
  return await sequelize.transaction(async (t) => {
    const payment = await PaymentModel.findOne({
      where: { id, vendorId },
      transaction: t,
    });

    if (!payment) throw new Error("Payment not found");

    // Delete transaction record if exists
    if (TransactionModel) {
      await TransactionModel.destroy({
        where: { paymentId: payment.id },
        transaction: t,
      });
    }

    // Soft delete payment
    await payment.destroy({ transaction: t });

    return true;
  });
};

exports.getPaymentStats = async (vendorId, { fromDate, toDate } = {}) => {
  const where = { vendorId };

  if (fromDate || toDate) {
    where.paymentDate = {};
    if (fromDate) where.paymentDate[Op.gte] = fromDate;
    if (toDate) where.paymentDate[Op.lte] = toDate;
  }

  const [inward, outward] = await Promise.all([
    PaymentModel.sum("amount", { where: { ...where, type: "inward" } }),
    PaymentModel.sum("amount", { where: { ...where, type: "outward" } }),
  ]);

  const totalPayments = await PaymentModel.count({ where });

  return {
    totalInward: parseFloat(inward || 0).toFixed(2),
    totalOutward: parseFloat(outward || 0).toFixed(2),
    netAmount: parseFloat((inward || 0) - (outward || 0)).toFixed(2),
    totalPayments,
  };
};

