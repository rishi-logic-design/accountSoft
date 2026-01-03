exports.generatePaymentNumber = async (PaymentModel, transaction = null) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const datePrefix = `PAY-${year}${month}${day}`;

  // Find the last payment number for today
  const lastPayment = await PaymentModel.findOne({
    where: {
      paymentNumber: {
        [require("sequelize").Op.like]: `${datePrefix}%`,
      },
    },
    order: [["paymentNumber", "DESC"]],
    transaction,
  });

  let sequence = 1;

  if (lastPayment) {
    // Extract sequence number from last payment
    const lastNumber = lastPayment.paymentNumber.split("-").pop();
    sequence = parseInt(lastNumber) + 1;
  }

  // Format sequence with leading zeros (5 digits)
  const sequenceStr = String(sequence).padStart(5, "0");

  return `${datePrefix}-${sequenceStr}`;
};

exports.formatPaymentMethod = (method) => {
  const methodMap = {
    cash: "Cash",
    bank: "Bank Transfer",
    cheque: "Cheque",
    online: "Online Payment",
    upi: "UPI",
    card: "Card",
    other: "Other",
  };

  return methodMap[method] || method;
};

exports.formatPaymentType = (type) => {
  const typeMap = {
    credit: "Payment Received (Credit)",
    debit: "Payment Made (Debit)",
  };

  return typeMap[type] || type;
};

exports.validatePaymentAmount = (amount, maxAmount = null) => {
  const amt = parseFloat(amount);

  if (isNaN(amt) || amt <= 0) {
    return {
      isValid: false,
      message: "Amount must be a positive number",
    };
  }

  if (maxAmount !== null && amt > parseFloat(maxAmount)) {
    return {
      isValid: false,
      message: `Amount cannot exceed ${maxAmount}`,
    };
  }

  return {
    isValid: true,
    amount: amt.toFixed(2),
  };
};

exports.calculatePaymentSummary = (payments) => {
  let totalCredit = 0;
  let totalDebit = 0;
  let completedCount = 0;
  let pendingCount = 0;

  payments.forEach((payment) => {
    const amount = parseFloat(payment.amount || 0);

    if (payment.type === "credit") {
      totalCredit += amount;
    } else if (payment.type === "debit") {
      totalDebit += amount;
    }

    if (payment.status === "completed") {
      completedCount++;
    } else if (payment.status === "pending") {
      pendingCount++;
    }
  });

  return {
    totalCredit: totalCredit.toFixed(2),
    totalDebit: totalDebit.toFixed(2),
    netAmount: (totalCredit - totalDebit).toFixed(2),
    totalPayments: payments.length,
    completedCount,
    pendingCount,
  };
};
