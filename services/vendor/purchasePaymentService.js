const {
  PurchasePaymentModel,
  PurchaseModel,
  VendorModel,
  VendorVendorModel,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");

function toNumber(v) {
  return parseFloat(v || 0);
}

async function generateReceiptNumber(transaction = null) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const datePrefix = `PP-${year}${month}${day}`;

  const lastPayment = await PurchasePaymentModel.findOne({
    where: {
      receiptNumber: {
        [Op.like]: `${datePrefix}%`,
      },
    },
    order: [["receiptNumber", "DESC"]],
    transaction,
  });

  let sequence = 1;
  if (lastPayment) {
    const lastNumber = lastPayment.receiptNumber.split("-").pop();
    sequence = parseInt(lastNumber) + 1;
  }

  const sequenceStr = String(sequence).padStart(5, "0");
  return `${datePrefix}-${sequenceStr}`;
}

exports.createPayment = async (vendorId, payload) => {
  console.log(
    "Creating Purchase Payment. Payload:",
    JSON.stringify(payload, null, 2),
  );

  const {
    sellerId,
    amount,
    advanceAmount = 0,
    paymentDate,
    method,
    reference,
    note,
    status = "completed",
    adjustedPurchases = [],
  } = payload;

  if (!sellerId) throw new Error("Seller ID is required");
  if (!amount || toNumber(amount) <= 0)
    throw new Error("Valid amount is required");
  if (!paymentDate) throw new Error("Payment date is required");

  // Validate Seller
  const seller = await VendorVendorModel.findByPk(sellerId);
  if (!seller) {
    throw new Error(
      `Seller with ID ${sellerId} not found. Please use a valid Seller ID.`,
    );
  }

  // Ensure adjustedPurchases is actually an array
  let adjustments = Array.isArray(adjustedPurchases) ? adjustedPurchases : [];
  if (typeof adjustedPurchases === "string") {
    try {
      adjustments = JSON.parse(adjustedPurchases);
    } catch (e) {
      console.error("Failed to parse adjustedPurchases", e);
    }
  }

  return await sequelize.transaction(async (t) => {
    const receiptNumber = await generateReceiptNumber(t);
    console.log("Generated Receipt:", receiptNumber);

    const payment = await PurchasePaymentModel.create(
      {
        receiptNumber,
        vendorId,
        sellerId,
        amount: toNumber(amount).toFixed(2),
        advanceAmount: toNumber(advanceAmount).toFixed(2),
        paymentDate,
        method,
        reference,
        note,
        status,
        adjustedPurchases: adjustments,
      },
      { transaction: t },
    );

    console.log(`Processing ${adjustments.length} adjusted purchases...`);

    // Update purchases
    if (status === "completed" && adjustments.length > 0) {
      for (const adj of adjustments) {
        console.log(
          "Updating Purchase ID:",
          adj.purchaseId,
          "with amount:",
          adj.payAmount,
        );
        if (!adj.purchaseId) continue;

        const purchase = await PurchaseModel.findByPk(adj.purchaseId, {
          transaction: t,
        });

        if (!purchase) {
          console.warn(`Purchase with ID ${adj.purchaseId} not found!`);
          continue;
        }

        const payAmt = toNumber(adj.payAmount);
        const previousPaid = toNumber(purchase.paidAmount);
        const totalPur = toNumber(purchase.totalAmount);

        const newPaidAmount = +(previousPaid + payAmt).toFixed(2);
        const pendingAmount = +(totalPur - newPaidAmount).toFixed(2);

        let newStatus = "unpaid";
        if (pendingAmount <= 0.05) {
          newStatus = "paid";
        } else if (newPaidAmount > 0) {
          newStatus = "partial";
        }

        console.log(
          `New Status: ${newStatus}, New Paid: ${newPaidAmount}, Pending: ${pendingAmount}`,
        );

        await purchase.update(
          {
            paidAmount: newPaidAmount.toFixed(2),
            pendingAmount:
              pendingAmount > 0 ? pendingAmount.toFixed(2) : "0.00",
            status: newStatus,
          },
          { transaction: t },
        );
      }
    } else {
      console.log("No adjustments to process or status not completed.");
    }

    return await PurchasePaymentModel.findByPk(payment.id, {
      include: [{ model: VendorVendorModel, as: "seller" }],
      transaction: t,
    });
  });
};

exports.listPayments = async (options = {}) => {
  const {
    vendorId,
    sellerId,
    method,
    status,
    fromDate,
    toDate,
    page = 1,
    size = 20,
    search,
  } = options;

  const where = { vendorId };
  if (sellerId) where.sellerId = sellerId;
  if (method) where.method = method;
  if (status) where.status = status;

  if (fromDate || toDate) {
    where.paymentDate = {};
    if (fromDate) where.paymentDate[Op.gte] = fromDate;
    if (toDate) where.paymentDate[Op.lte] = toDate;
  }

  if (search) {
    where[Op.or] = [
      { receiptNumber: { [Op.like]: `%${search}%` } },
      { reference: { [Op.like]: `%${search}%` } },
      { note: { [Op.like]: `%${search}%` } },
    ];
  }

  const result = await PurchasePaymentModel.findAndCountAll({
    where,
    include: [{ model: VendorVendorModel, as: "seller" }],
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [
      ["paymentDate", "DESC"],
      ["createdAt", "DESC"],
    ],
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
  const payment = await PurchasePaymentModel.findOne({
    where: { id, vendorId },
    include: [{ model: VendorVendorModel, as: "seller" }],
  });

  if (!payment) throw new Error("Payment not found");
  return payment;
};

exports.deletePayment = async (id, vendorId) => {
  return await sequelize.transaction(async (t) => {
    const payment = await PurchasePaymentModel.findOne({
      where: { id, vendorId },
      transaction: t,
    });

    if (!payment) throw new Error("Payment not found");

    // Reverse purchase updates
    if (payment.status === "completed" && payment.adjustedPurchases) {
      for (const adj of payment.adjustedPurchases) {
        if (!adj.purchaseId) continue;

        const purchase = await PurchaseModel.findByPk(adj.purchaseId, {
          transaction: t,
        });

        if (!purchase) continue;

        const payAmt = toNumber(adj.payAmount);
        const previousPaid = toNumber(purchase.paidAmount);
        const totalPur = toNumber(purchase.totalAmount);

        const newPaidAmount = previousPaid - payAmt;
        const pendingAmount = totalPur - newPaidAmount;

        let newStatus = "unpaid";
        if (pendingAmount <= 0.01) {
          newStatus = "paid";
        } else if (newPaidAmount > 0) {
          newStatus = "partial";
        }

        await purchase.update(
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

    await payment.destroy({ transaction: t });
    return true;
  });
};

exports.getSellerOutstanding = async (vendorId, sellerId) => {
  const totalPurchased = await PurchaseModel.sum("totalAmount", {
    where: { vendorId, sellerId, status: { [Op.ne]: "cancelled" } },
  });

  const totalPaid = await PurchasePaymentModel.sum("amount", {
    where: { vendorId, sellerId, status: "completed" },
  });

  const outstanding = toNumber(totalPurchased) - toNumber(totalPaid);

  return {
    sellerId: parseInt(sellerId),
    outstanding: outstanding.toFixed(2),
  };
};

exports.getSellerPendingPurchases = async (vendorId, sellerId) => {
  const purchases = await PurchaseModel.findAll({
    where: {
      vendorId,
      sellerId,
      status: { [Op.in]: ["pending", "unpaid", "partial"] },
    },
    order: [["purchaseDate", "ASC"]],
  });

  return purchases.map((pur) => ({
    id: pur.id,
    purchaseNumber: pur.purchaseNumber,
    purchaseDate: pur.purchaseDate,
    totalAmount: toNumber(pur.totalAmount).toFixed(2),
    paidAmount: toNumber(pur.paidAmount).toFixed(2),
    pendingAmount: toNumber(
      pur.pendingAmount || toNumber(pur.totalAmount) - toNumber(pur.paidAmount),
    ).toFixed(2),
    status: pur.status,
  }));
};
