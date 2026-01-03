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

exports.validateIFSCCode = (ifsc) => {
  if (!ifsc) {
    return { isValid: false, message: "IFSC code is required" };
  }

  const ifscStr = ifsc.trim().toUpperCase();

  // IFSC format: 4 letters (bank code) + 0 + 6 alphanumeric (branch code)
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

  if (!ifscRegex.test(ifscStr)) {
    return { isValid: false, message: "Invalid IFSC code format" };
  }

  return { isValid: true, message: "Valid IFSC code", ifscCode: ifscStr };
};

exports.validateGSTNumber = (gstNumber) => {
  if (!gstNumber) {
    return { isValid: false, message: "GST number is required" };
  }

  const gst = gstNumber.trim().toUpperCase();

  if (gst.length !== 15) {
    return { isValid: false, message: "GST number must be exactly 15 characters" };
  }

  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  if (!gstRegex.test(gst)) {
    return { isValid: false, message: "Invalid GST number format" };
  }

  const stateCode = parseInt(gst.substring(0, 2));

  if (stateCode < 1 || stateCode > 37) {
    return { isValid: false, message: "Invalid GST state code" };
  }

  const pan = gst.substring(2, 12);
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(pan)) {
    return { isValid: false, message: "Invalid PAN format within GST number" };
  }

  const entityType = pan.charAt(3);
  const validEntityTypes = ['P', 'F', 'C', 'H', 'A', 'T', 'B', 'L', 'J', 'G'];
  if (!validEntityTypes.includes(entityType)) {
    return { isValid: false, message: "Invalid entity type in GST number" };
  }

  if (gst.charAt(13) !== 'Z') {
    return { isValid: false, message: "14th character of GST must be 'Z'" };
  }

  return { isValid: true, message: "Valid GST number", gstNumber: gst };
};

exports.validateAadhaarNumber = (aadhaarNumber) => {
  if (!aadhaarNumber) {
    return { isValid: false, message: "Aadhaar number is required" };
  }

  const aadhaar = aadhaarNumber.toString().replace(/\s+/g, '').replace(/\D/g, '');

  if (aadhaar.length !== 12) {
    return { isValid: false, message: "Aadhaar number must be exactly 12 digits" };
  }

  if (!/^\d{12}$/.test(aadhaar)) {
    return { isValid: false, message: "Aadhaar number must contain only digits" };
  }

  if (/^(\d)\1{11}$/.test(aadhaar)) {
    return { isValid: false, message: "Invalid Aadhaar number pattern" };
  }

  if (!verhoeffValidate(aadhaar)) {
    return { isValid: false, message: "Invalid Aadhaar number (checksum failed)" };
  }

  return { isValid: true, message: "Valid Aadhaar number", aadhaarNumber: aadhaar };
};

function verhoeffValidate(num) {
  const d = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  ];

  const p = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
  ];

  let c = 0;
  const myArray = num.split('').reverse();

  for (let i = 0; i < myArray.length; i++) {
    c = d[c][p[(i % 8)][parseInt(myArray[i])]];
  }

  return c === 0;
}