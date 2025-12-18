// services/payment.service.js
const {
  PaymentModel,
  TransactionModel,
  VendorModel,
  CustomerModel,
  BillModel,
  ChallanModel,
  sequelize,
} = require("../../models/index");
const { generatePaymentNumber } = require("../../utils/paymentUtil");
const { Op } = require("sequelize");

function toNumber(v) {
  return parseFloat(v || 0);
}

exports.createPayment = async (vendorId, payload) => {
  const {
    type,
    customerId,
    amount,
    paymentDate,
    method,
    reference,
    note,
    billId,
    challanId,
    attachments = [],
  } = payload;

  if (!type || !["inward", "outward"].includes(type))
    throw new Error("Invalid payment type");
  if (!amount || toNumber(amount) <= 0) throw new Error("Amount must be > 0");
  if (!paymentDate) throw new Error("paymentDate required");

  return await sequelize.transaction(async (t) => {
    // validate vendor
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) throw new Error("Vendor not found");

    // optional validations
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

    // generate payment number
    const paymentNumber = await generatePaymentNumber(PaymentModel, t);

    // create payment
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
      },
      { transaction: t }
    );

    // create a TransactionModel ledger entry to keep single ledger
    // TransactionModel should have fields: vendorId, customerId, amount, type ('payment' or 'sale'), description, transactionDate, billId, challanId, paymentId
    if (TransactionModel) {
      await TransactionModel.create(
        {
          vendorId,
          customerId: customerId || null,
          amount: toNumber(amount).toFixed(2),
          type: "payment", // payments always create 'payment' type ledger rows
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
  fromDate,
  toDate,
  page = 1,
  size = 20,
} = {}) => {
  const where = {};
  if (vendorId) where.vendorId = vendorId;
  if (type) where.type = type;
  if (customerId) where.customerId = customerId;
  if (method) where.method = method;
  if (fromDate)
    where.paymentDate = { ...(where.paymentDate || {}), [Op.gte]: fromDate };
  if (toDate)
    where.paymentDate = { ...(where.paymentDate || {}), [Op.lte]: toDate };

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
    order: [["paymentDate", "DESC"]],
    distinct: true,
  });

  return { total: result.count, rows: result.rows };
};

exports.getPaymentById = async (id, vendorId) => {
  const where = { id };
  if (vendorId) where.vendorId = vendorId;
  const payment = await PaymentModel.findOne({
    where,
    include: [{ model: CustomerModel, as: "customer" }],
  });
  if (!payment) throw new Error("Payment not found");

  // fetch related transaction
  const txn = TransactionModel
    ? await TransactionModel.findOne({ where: { paymentId: payment.id } })
    : null;
  return { payment, transaction: txn };
};

exports.deletePayment = async (id, vendorId) => {
  return await sequelize.transaction(async (t) => {
    const payment = await PaymentModel.findOne({
      where: { id, vendorId },
      transaction: t,
    });
    if (!payment) throw new Error("Payment not found");
    // delete transaction record if exists
    if (TransactionModel) {
      await TransactionModel.destroy({
        where: { paymentId: payment.id },
        transaction: t,
      });
    }
    await payment.destroy({ transaction: t });
    return true;
  });
};
