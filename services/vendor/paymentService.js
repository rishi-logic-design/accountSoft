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

function getFinancialYearStartDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const startYear = month >= 4 ? year : year - 1;
  return new Date(`${startYear}-04-01`);
}

function getFinancialYearStartDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const startYear = month >= 4 ? year : year - 1;
  return new Date(`${startYear}-04-01`);
}
exports.createPayment = async (vendorId, payload) => {
  const {
    customerId,
    type,
    subType,
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
    chequeNumber,
    chequeDate,
    chequeBankName,
    status,
    adjustedInvoices,
  } = payload;
  if (subType === "customer") {
    if (!customerId) {
      throw new Error("customerId is required when subType is customer");
    }
  } else {
    if (customerId) {
      throw new Error(
        `customerId should not be provided when subType is ${subType}`,
      );
    }
  }
  return await sequelize.transaction(async (t) => {
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) throw new Error("Vendor not found");

    if (subType === "customer") {
      const customer = await CustomerModel.findByPk(customerId, {
        transaction: t,
      });
      if (!customer) throw new Error("Customer not found");
    }

    const paymentNumber = await generatePaymentNumber(PaymentModel, t);

    let totalOutstanding = 0;
    let outstandingAfterPayment = 0;

    if (customerId) {
      totalOutstanding = parseFloat(
        await calculateCustomerOutstanding(vendorId, customerId, t),
      );

      if (type === "credit") {
        outstandingAfterPayment = totalOutstanding - toNumber(amount);
      } else if (type === "debit") {
        outstandingAfterPayment = totalOutstanding + toNumber(amount);
      } else {
        outstandingAfterPayment = totalOutstanding;
      }
    }

    const payment = await PaymentModel.create(
      {
        paymentNumber,
        vendorId,
        customerId: subType === "customer" ? customerId : null,
        type,
        subType,
        amount: toNumber(amount).toFixed(2),
        paymentDate,
        method,
        reference: reference || null,
        note: note || null,
        attachments: Array.isArray(attachments) ? attachments : [],
        billId: billId || null,
        challanId: challanId || null,
        status: status || "completed",
        totalOutstanding: totalOutstanding.toFixed(2),
        outstandingAfterPayment: outstandingAfterPayment.toFixed(2),
        adjustedInvoices: adjustedInvoices || [],
      },
      { transaction: t },
    );

    if (TransactionModel && subType === "customer") {
      await TransactionModel.create(
        {
          vendorId,
          customerId: subType === "customer" ? customerId : null,
          amount: toNumber(amount).toFixed(2),
          type: "payment",
          description:
            note ||
            `Payment ${paymentNumber} (${
              type === "credit" ? "Received" : "Paid"
            })`,
          transactionDate: paymentDate,
          billId: billId || null,
          challanId: challanId || null,
          paymentId: payment.id,
        },
        { transaction: t },
      );
    }

    if (
      type === "credit" &&
      Array.isArray(adjustedInvoices) &&
      adjustedInvoices.length > 0
    ) {
      console.log("Processing adjusted invoices:", adjustedInvoices);

      for (const inv of adjustedInvoices) {
        if (!inv.billId) {
          console.warn("Skipping invoice without billId:", inv);
          continue;
        }

        const bill = await BillModel.findByPk(inv.billId, {
          transaction: t,
        });

        if (!bill) {
          console.warn(`Bill not found for billId: ${inv.billId}`);
          continue;
        }

        console.log(`Updating bill ${bill.billNumber}:`, {
          currentPaidAmount: bill.paidAmount,
          payAmount: inv.payAmount,
          totalWithGST: bill.totalWithGST,
        });

        const previousPaid = toNumber(bill.paidAmount);
        const payAmount = toNumber(inv.payAmount);
        const totalBill = toNumber(bill.totalWithGST);

        const newPaidAmount = previousPaid + payAmount;
        const pendingAmount = totalBill - newPaidAmount;

        let newStatus = "pending";
        if (pendingAmount <= 0.01) {
          // Allow small rounding differences
          newStatus = "paid";
        } else if (newPaidAmount > 0) {
          newStatus = "partial";
        }

        console.log(`New bill status: ${newStatus}`, {
          newPaidAmount,
          pendingAmount,
        });

        await bill.update(
          {
            paidAmount: newPaidAmount.toFixed(2),
            pendingAmount:
              pendingAmount > 0 ? pendingAmount.toFixed(2) : "0.00",
            status: newStatus,
          },
          { transaction: t },
        );

        console.log(`Bill ${bill.billNumber} updated successfully`);
      }
    }

    const completePayment = await PaymentModel.findByPk(payment.id, {
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
      ],
      transaction: t,
    });

    return completePayment;
  });
};

exports.listPayments = async (options = {}) => {
  const {
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
  } = options;

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
      { note: { [Op.like]: `%${search}%` } },
    ];
  }

  const result = await PaymentModel.findAndCountAll({
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
    size: Number(size),
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
    ],
  });

  if (!payment) throw new Error("Payment not found");

  if (payment.billId) {
    const bill = await BillModel.findByPk(payment.billId, {
      attributes: [
        "id",
        "billNumber",
        "billDate",
        "totalWithGST",
        "status",
        "paidAmount",
        "pendingAmount",
      ],
    });
    payment.dataValues.bill = bill;
  }
  if (payment.challanId) {
    const challan = await ChallanModel.findByPk(payment.challanId, {
      attributes: ["id", "challanNumber", "challanDate"],
    });
    payment.dataValues.challan = challan;
  }
  return payment;
};

exports.updatePayment = async (id, vendorId, payload) => {
  return await sequelize.transaction(async (t) => {
    const payment = await PaymentModel.findOne({
      where: { id, vendorId },
      transaction: t,
    });

    if (!payment) throw new Error("Payment not found");

    const {
      amount,
      paymentDate,
      method,
      reference,
      note,
      attachments,
      bankName,
      accountNumber,
      ifscCode,
      upiId,
      chequeNumber,
      chequeDate,
      chequeBankName,
      status,
      subType,
      billId,
      type,
    } = payload;

    // Build update object
    const updateData = {};
    if (amount !== undefined) updateData.amount = toNumber(amount).toFixed(2);
    if (paymentDate) updateData.paymentDate = paymentDate;
    if (method) updateData.method = method;
    if (type) updateData.type = type;
    if (subType) updateData.subType = subType;
    if (billId !== undefined) updateData.billId = billId;
    if (reference !== undefined) updateData.reference = reference;
    if (note !== undefined) updateData.note = note;
    if (attachments !== undefined) updateData.attachments = attachments;
    if (bankName !== undefined) updateData.bankName = bankName;
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber;
    if (ifscCode !== undefined) updateData.ifscCode = ifscCode;
    if (upiId !== undefined) updateData.upiId = upiId;
    if (chequeNumber !== undefined) updateData.chequeNumber = chequeNumber;
    if (chequeDate !== undefined) updateData.chequeDate = chequeDate;
    if (chequeBankName !== undefined)
      updateData.chequeBankName = chequeBankName;
    if (status) updateData.status = status;

    // Recalculate outstanding if amount changed
    if (amount !== undefined) {
      const oldAmount = toNumber(payment.amount);
      const newAmount = toNumber(amount);
      const difference = newAmount - oldAmount;

      let newOutstanding = toNumber(payment.outstandingAfterPayment);
      if (payment.type === "credit") {
        newOutstanding += difference;
      } else if (payment.type === "debit") {
        newOutstanding -= difference;
      }

      updateData.outstandingAfterPayment = newOutstanding.toFixed(2);
    }

    await payment.update(updateData, { transaction: t });

    // Update transaction record if exists
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

    // If payment was adjusted with bills, reverse the bill updates
    if (
      payment.type === "credit" &&
      payment.adjustedInvoices &&
      payment.adjustedInvoices.length > 0
    ) {
      console.log("Reversing bill adjustments for deleted payment");

      for (const inv of payment.adjustedInvoices) {
        if (!inv.billId) continue;

        const bill = await BillModel.findByPk(inv.billId, { transaction: t });
        if (!bill) continue;

        const previousPaid = toNumber(bill.paidAmount);
        const payAmount = toNumber(inv.payAmount);
        const totalBill = toNumber(bill.totalWithGST);

        const newPaidAmount = previousPaid - payAmount;
        const pendingAmount = totalBill - newPaidAmount;

        let newStatus = "pending";
        if (pendingAmount <= 0.01) {
          newStatus = "paid";
        } else if (newPaidAmount > 0) {
          newStatus = "partial";
        }

        await bill.update(
          {
            paidAmount: newPaidAmount > 0 ? newPaidAmount.toFixed(2) : "0.00",
            pendingAmount:
              pendingAmount > 0 ? pendingAmount.toFixed(2) : "0.00",
            status: newStatus,
          },
          { transaction: t },
        );
      }
    }

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

exports.setOpeningBalance = async (req, res) => {
  const vendorId =
    req.user?.role === "vendor" ? req.user.id : req.body.vendorId;

  const { method, amount } = req.body; // cash or bank

  if (!["cash", "bank"].includes(method)) {
    return error(res, "Invalid account type", 400);
  }

  if (!amount || isNaN(amount)) {
    return error(res, "Invalid amount", 400);
  }

  const financialStart = getFinancialYearStartDate();

  // Already exists check
  const existing = await PaymentModel.findOne({
    where: {
      vendorId,
      method,
      paymentDate: financialStart,
      openingBalance: { [Op.gt]: 0 },
    },
  });

  if (existing) {
    return error(
      res,
      "Opening balance already set for this financial year",
      400,
    );
  }

  const opening = await PaymentModel.create({
    paymentNumber: `OPEN-${Date.now()}`,
    vendorId,
    type: "credit",
    amount: 0,
    openingBalance: amount,
    paymentDate: financialStart,
    method,
    status: "completed",
  });

  success(res, opening, "Opening balance set successfully");
};

exports.getPaymentStats = async (vendorId, options = {}) => {
  const { fromDate, toDate } = options;
  const financialStart = getFinancialYearStartDate();

  const where = { vendorId, status: "completed" };

  if (fromDate || toDate) {
    where.paymentDate = {};
    if (fromDate) where.paymentDate[Op.gte] = fromDate;
    if (toDate) where.paymentDate[Op.lte] = toDate;
  }

  const [
    cashOpening,
    bankOpening,
    cashCredit,
    cashDebit,
    bankCredit,
    bankDebit,
    totalPayments,
    paymentsByMethod,
  ] = await Promise.all([
    PaymentModel.sum("openingBalance", { where: { ...where, method: "cash" } }),
    PaymentModel.sum("openingBalance", { where: { ...where, method: "bank" } }),
    PaymentModel.sum("amount", { where: { ...where, type: "credit" } }),
    PaymentModel.sum("amount", { where: { ...where, type: "debit" } }),
    PaymentModel.count({ where }),
    PaymentModel.findAll({
      where,
      attributes: [
        "method",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("amount")), "total"],
      ],
      group: ["method"],
      raw: true,
    }),
  ]);
  const cashBalance =
    parseFloat(cashOpening || 0) +
    parseFloat(cashCredit || 0) -
    parseFloat(cashDebit || 0);

  const bankBalance =
    parseFloat(bankOpening || 0) +
    parseFloat(bankCredit || 0) -
    parseFloat(bankDebit || 0);

  return {
    financialYearStart: financialStart,

    cashOpening: parseFloat(cashOpening || 0).toFixed(2),
    bankOpening: parseFloat(bankOpening || 0).toFixed(2),

    cashBalance: cashBalance.toFixed(2),
    bankBalance: bankBalance.toFixed(2),

    totalCredit: (
      parseFloat(cashCredit || 0) + parseFloat(bankCredit || 0)
    ).toFixed(2),

    totalDebit: (
      parseFloat(cashDebit || 0) + parseFloat(bankDebit || 0)
    ).toFixed(2),

    totalBalance: (cashBalance + bankBalance).toFixed(2),
    totalPayments,
    paymentsByMethod,
  };
};

exports.getCustomerOutstanding = async (vendorId, customerId) => {
  const outstanding = await calculateCustomerOutstanding(vendorId, customerId);

  const recentPayments = await PaymentModel.findAll({
    where: { vendorId, customerId },
    order: [["paymentDate", "DESC"]],
    limit: 5,
    attributes: [
      "id",
      "paymentNumber",
      "paymentDate",
      "amount",
      "type",
      "method",
      "status",
    ],
  });

  return {
    customerId: parseInt(customerId),
    outstanding: parseFloat(outstanding).toFixed(2),
    recentPayments,
  };
};

exports.getCustomerPendingInvoices = async (vendorId, customerId) => {
  // Get all bills with pending/partial status
  const bills = await BillModel.findAll({
    where: {
      vendorId,
      customerId,
      status: {
        [Op.in]: ["pending", "partial"],
      },
    },
    attributes: [
      "id",
      "billNumber",
      "billDate",
      "totalWithGST",
      "paidAmount",
      "pendingAmount",
      "status",
    ],
    order: [["billDate", "ASC"]],
  });

  // Map bills with proper amounts
  const billsWithPayments = bills.map((bill) => {
    const totalAmount = toNumber(bill.totalWithGST);
    const paid = toNumber(bill.paidAmount);
    const pending = toNumber(bill.pendingAmount || totalAmount - paid);

    return {
      id: bill.id,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      invoiceDate: bill.billDate,
      totalAmount: totalAmount.toFixed(2),
      paidAmount: paid.toFixed(2),
      pendingAmount: pending.toFixed(2),
      status: bill.status,
    };
  });

  // Get all challans with pending/partial status (if applicable)
  let challansWithPayments = [];
  try {
    const challans = await ChallanModel.findAll({
      where: {
        vendorId,
        customerId,
        status: {
          [Op.in]: ["pending", "partial"],
        },
      },
      attributes: [
        "id",
        "challanNumber",
        "challanDate",
        "totalWithGST",
        "paidAmount",
        "pendingAmount",
        "status",
      ],
      order: [["challanDate", "ASC"]],
    });

    challansWithPayments = challans.map((challan) => {
      const totalAmount = toNumber(challan.totalWithGST);
      const paid = toNumber(challan.paidAmount);
      const pending = toNumber(challan.pendingAmount || totalAmount - paid);

      return {
        id: challan.id,
        challanNumber: challan.challanNumber,
        challanDate: challan.challanDate,
        totalAmount: totalAmount.toFixed(2),
        paidAmount: paid.toFixed(2),
        pendingAmount: pending.toFixed(2),
        status: challan.status,
      };
    });
  } catch (err) {
    console.log("Challan fetch error:", err.message);
  }

  const totalPending = [...billsWithPayments, ...challansWithPayments].reduce(
    (sum, item) => sum + toNumber(item.pendingAmount),
    0,
  );

  return {
    bills: billsWithPayments,
    challans: challansWithPayments,
    invoices: [...billsWithPayments, ...challansWithPayments], // Combined for easier frontend handling
    totalPending: totalPending.toFixed(2),
  };
};

async function calculateCustomerOutstanding(
  vendorId,
  customerId,
  transaction = null,
) {
  const totalBilled = await BillModel.sum("totalWithGST", {
    where: {
      vendorId,
      customerId,
      status: { [Op.ne]: "cancelled" },
    },
    transaction,
  });

  const totalPaid = await PaymentModel.sum("amount", {
    where: {
      vendorId,
      customerId,
      type: "credit",
      status: "completed",
    },
    transaction,
  });

  const totalDebit = await PaymentModel.sum("amount", {
    where: {
      vendorId,
      customerId,
      type: "debit",
      status: "completed",
    },
    transaction,
  });

  const outstanding =
    toNumber(totalBilled) - toNumber(totalPaid) + toNumber(totalDebit);

  return parseFloat(outstanding).toFixed(2);
}
