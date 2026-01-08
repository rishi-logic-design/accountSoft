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

  return await sequelize.transaction(async (t) => {
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) throw new Error("Vendor not found");

    // Verify customer exists
    if (customerId && ["customer", "vendor"].includes(subType)) {
      const customer = await CustomerModel.findByPk(customerId, {
        transaction: t,
      });
      if (!customer) throw new Error("Customer not found");
    }
    // Verify bill if provided
    if (billId) {
      const bill = await BillModel.findByPk(billId, { transaction: t });
      if (!bill) throw new Error("Bill not found");
    }

    // Verify challan if provided
    if (challanId) {
      const challan = await ChallanModel.findByPk(challanId, {
        transaction: t,
      });
      if (!challan) throw new Error("Challan not found");
    }

    // Calculate current outstanding
    let currentOutstanding = 0;
    if (customerId && subType === "customer") {
      currentOutstanding = await calculateCustomerOutstanding(
        vendorId,
        customerId,
        t
      );
    }

    // Calculate outstanding after payment
    let outstandingAfter = toNumber(currentOutstanding);
    if (customerId && subType === "customer") {
      if (type === "credit") {
        outstandingAfter -= toNumber(amount);
      } else if (type === "debit") {
        outstandingAfter += toNumber(amount);
      }
    }

    // Generate unique payment number
    const paymentNumber = await generatePaymentNumber(PaymentModel, t);

    // Create payment record
    const payment = await PaymentModel.create(
      {
        paymentNumber,
        vendorId,
        customerId,
        type,
        subType,
        amount: toNumber(amount).toFixed(2),
        paymentDate,
        method,
        reference: reference || null,
        note: note || null,
        attachments: attachments || null,
        billId: billId,
        challanId: challanId || null,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        ifscCode: ifscCode || null,
        upiId: upiId || null,
        chequeNumber: chequeNumber || null,
        chequeDate: chequeDate || null,
        chequeBankName: chequeBankName || null,
        status: status || "completed",
        totalOutstanding: toNumber(currentOutstanding).toFixed(2),
        outstandingAfterPayment: outstandingAfter.toFixed(2),
        adjustedInvoices: adjustedInvoices || null,
      },
      { transaction: t }
    );

    // Create transaction record
    if (TransactionModel) {
      await TransactionModel.create(
        {
          vendorId,
          customerId,
          amount: toNumber(amount).toFixed(2),
          type: "payment",
          description:
            note ||
            `Payment ${paymentNumber} (${
              type === "credit" ? "Received" : "Made"
            })`,
          transactionDate: paymentDate,
          billId: billId || null,
          challanId: challanId || null,
          paymentId: payment.id,
        },
        { transaction: t }
      );
    }

    // Update adjusted invoices if provided
    if (
      adjustedInvoices &&
      Array.isArray(adjustedInvoices) &&
      adjustedInvoices.length > 0
    ) {
      for (const invoice of adjustedInvoices) {
        if (invoice.billId) {
          const bill = await BillModel.findByPk(invoice.billId, {
            transaction: t,
          });

          if (bill) {
            // Get existing payments for this bill
            const existingPayments = await TransactionModel.sum("amount", {
              where: {
                billId: invoice.billId,
                type: "payment",
                vendorId,
              },
              transaction: t,
            });

            const totalPaid =
              toNumber(existingPayments) + toNumber(invoice.payAmount);
            const totalBill = toNumber(bill.totalWithGST);
            const pending = totalBill - totalPaid;

            // Determine status
            let newStatus = "pending";
            if (pending <= 0) {
              newStatus = "paid";
            } else if (totalPaid > 0) {
              newStatus = "partial";
            }

            await bill.update(
              {
                status: newStatus,
              },
              { transaction: t }
            );
          }
        }
      }
    }

    return payment;
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
        attributes: ["id", "customerName", "businessName", "mobile", "email"],
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
          "mobile",
          "email",
          "address",
        ],
      },
    ],
  });

  if (!payment) throw new Error("Payment not found");

  if (payment.billId) {
    const bill = await BillModel.findByPk(payment.billId, {
      attributes: ["id", "billNumber", "billDate", "totalWithGST", "status"],
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
    } = payload;

    // Build update object
    const updateData = {};
    if (amount !== undefined) updateData.amount = toNumber(amount).toFixed(2);
    if (paymentDate) updateData.paymentDate = paymentDate;
    if (method) updateData.method = method;
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

exports.getPaymentStats = async (vendorId, options = {}) => {
  const { fromDate, toDate } = options;

  const where = { vendorId, status: "completed" };

  if (fromDate || toDate) {
    where.paymentDate = {};
    if (fromDate) where.paymentDate[Op.gte] = fromDate;
    if (toDate) where.paymentDate[Op.lte] = toDate;
  }

  const [totalCredit, totalDebit, totalPayments, paymentsByMethod] =
    await Promise.all([
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

  return {
    totalCredit: parseFloat(totalCredit || 0).toFixed(2),
    totalDebit: parseFloat(totalDebit || 0).toFixed(2),
    netAmount: parseFloat((totalCredit || 0) - (totalDebit || 0)).toFixed(2),
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
    attributes: ["id", "billNumber", "billDate", "totalWithGST", "status"],
    order: [["billDate", "ASC"]],
  });

  // Calculate paid amount for each bill from transactions
  const billsWithPayments = await Promise.all(
    bills.map(async (bill) => {
      const paidAmount = await TransactionModel.sum("amount", {
        where: {
          billId: bill.id,
          type: "payment",
          vendorId,
        },
      });

      const totalAmount = toNumber(bill.totalWithGST);
      const paid = toNumber(paidAmount);
      const pending = totalAmount - paid;

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
    })
  );

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
        "status",
      ],
      order: [["challanDate", "ASC"]],
    });

    challansWithPayments = await Promise.all(
      challans.map(async (challan) => {
        const paidAmount = await TransactionModel.sum("amount", {
          where: {
            challanId: challan.id,
            type: "payment",
            vendorId,
          },
        });

        const totalAmount = toNumber(challan.totalWithGST);
        const paid = toNumber(paidAmount);
        const pending = totalAmount - paid;

        return {
          id: challan.id,
          challanNumber: challan.challanNumber,
          challanDate: challan.challanDate,
          totalAmount: totalAmount.toFixed(2),
          paidAmount: paid.toFixed(2),
          pendingAmount: pending.toFixed(2),
          status: challan.status,
        };
      })
    );
  } catch (err) {
    console.log("Challan fetch error:", err.message);
  }

  const totalPending = [...billsWithPayments, ...challansWithPayments].reduce(
    (sum, item) => sum + toNumber(item.pendingAmount),
    0
  );

  return {
    bills: billsWithPayments,
    challans: challansWithPayments,
    totalPending: totalPending.toFixed(2),
  };
};

async function calculateCustomerOutstanding(
  vendorId,
  customerId,
  transaction = null
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
