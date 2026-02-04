const paymentService = require("../../services/vendor/paymentService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const { validateIFSCCode } = require("../../utils/paymentUtil");
const notificationService = require("../../services/vendor/notificationService");

exports.createPayment = asyncHandler(async (req, res) => {
  const vendorId =
    req.user?.role === "vendor"
      ? req.user.id
      : req.body.vendorId || req.user.id;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

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
  } = req.body;

  const uploadedAttachments = Array.isArray(attachments) ? attachments : [];

  // Required field validation
  if (!customerId) {
    return error(res, "Customer is required", 400);
  }

  if (!type || !["credit", "debit"].includes(type)) {
    return error(res, "Payment type is required (credit/debit)", 400);
  }

  if (
    !subType ||
    ![
      "customer",
      "vendor",
      "cash-deposit",
      "cash-withdrawal",
      "bank-charges",
      "electricity-bill",
      "miscellaneous",
    ].includes(subType)
  ) {
    return error(res, "Payment sub-type is required", 400);
  }

  if (!amount || parseFloat(amount) <= 0) {
    return error(res, "Valid amount is required", 400);
  }

  if (!paymentDate) {
    return error(res, "Payment date is required", 400);
  }

  if (
    !method ||
    !["cash", "bank", "cheque", "online", "upi", "card", "other"].includes(
      method,
    )
  ) {
    return error(res, "Valid payment method is required", 400);
  }

  // Method-specific validation
  if (method === "bank") {
    if (!bankName || !accountNumber || !ifscCode) {
      return error(
        res,
        "Bank name, account number, and IFSC code are required for bank transfers",
        400,
      );
    }

    // Validate IFSC code
    const ifscValidation = validateIFSCCode(ifscCode);
    if (!ifscValidation.isValid) {
      return error(res, ifscValidation.message, 400);
    }
  }

  if (method === "upi" || method === "online") {
    if (!upiId) {
      return error(res, "UPI ID is required for UPI/online payments", 400);
    }

    // Validate UPI ID format
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    if (!upiRegex.test(upiId)) {
      return error(res, "Invalid UPI ID format", 400);
    }
  }

  if (method === "cheque") {
    if (!chequeNumber || !chequeDate || !chequeBankName) {
      return error(
        res,
        "Cheque number, date, and bank name are required for cheque payments",
        400,
      );
    }
  }

  if (adjustedInvoices && !Array.isArray(adjustedInvoices)) {
    return error(res, "Adjusted invoices must be an array", 400);
  }

  if (adjustedInvoices && adjustedInvoices.length > 0) {
    const totalAdjusted = adjustedInvoices.reduce(
      (sum, inv) => sum + parseFloat(inv.payAmount || 0),
      0,
    );
    if (Math.abs(totalAdjusted - parseFloat(amount)) > 0.01) {
      return error(
        res,
        "Sum of adjusted invoice amounts must equal payment amount",
        400,
      );
    }
  }

  const payload = {
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
    attachments: uploadedAttachments,
    bankName,
    accountNumber,
    ifscCode,
    upiId,
    chequeNumber,
    chequeDate,
    chequeBankName,
    status: status || "completed",
    adjustedInvoices,
  };

  const payment = await paymentService.createPayment(vendorId, payload);

  // 🔔 CREATE NOTIFICATION
  try {
    await notificationService.createNotification({
      userId: vendorId,
      userRole: "VENDOR",
      title: "Payment Recorded",
      message: `Payment of ₹${amount} received via ${method}`,
      type: "TRANSACTION",
      level: "SUCCESS",
      entityType: "PAYMENT",
      entityId: payment.id,
    });
  } catch (notifError) {
    console.error("Failed to create notification:", notifError);
  }

  success(res, payment, "Payment created successfully", 201);
});

exports.listPayments = asyncHandler(async (req, res) => {
  const vendorId =
    req.user?.role === "vendor" ? req.user.id : req.query.vendorId;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const {
    type,
    customerId,
    method,
    status,
    fromDate,
    toDate,
    page,
    size,
    search,
  } = req.query;

  const list = await paymentService.listPayments({
    vendorId,
    type,
    customerId,
    method,
    status,
    fromDate,
    toDate,
    page: page || 1,
    size: size || 20,
    search,
  });

  success(res, list, "Payments retrieved successfully");
});

exports.getPaymentById = asyncHandler(async (req, res) => {
  const vendorId =
    req.user?.role === "vendor" ? req.user.id : req.query.vendorId;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const { id } = req.params;

  if (!id || isNaN(id)) {
    return error(res, "Invalid payment ID", 400);
  }

  const result = await paymentService.getPaymentById(id, vendorId);

  if (!result) {
    return error(res, "Payment not found", 404);
  }

  success(res, result, "Payment retrieved successfully");
});

exports.updatePayment = asyncHandler(async (req, res) => {
  const vendorId =
    req.user?.role === "vendor"
      ? req.user.id
      : req.body.vendorId || req.query.vendorId;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const { id } = req.params;

  if (!id || isNaN(id)) {
    return error(res, "Invalid payment ID", 400);
  }

  const {
    amount,
    paymentDate,
    method,
    bankName,
    accountNumber,
    ifscCode,
    upiId,
    chequeNumber,
    chequeDate,
    chequeBankName,
  } = req.body;

  // Validate amount if updating
  if (amount !== undefined && parseFloat(amount) <= 0) {
    return error(res, "Amount must be greater than 0", 400);
  }

  // Method-specific validation
  if (method === "bank" && (bankName || accountNumber || ifscCode)) {
    if (!bankName || !accountNumber || !ifscCode) {
      return error(
        res,
        "Bank name, account number, and IFSC code are all required for bank transfers",
        400,
      );
    }

    const ifscValidation = validateIFSCCode(ifscCode);
    if (!ifscValidation.isValid) {
      return error(res, ifscValidation.message, 400);
    }
  }

  if ((method === "upi" || method === "online") && upiId) {
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    if (!upiRegex.test(upiId)) {
      return error(res, "Invalid UPI ID format", 400);
    }
  }

  if (method === "cheque" && (chequeNumber || chequeDate || chequeBankName)) {
    if (!chequeNumber || !chequeDate || !chequeBankName) {
      return error(
        res,
        "Cheque number, date, and bank name are all required for cheque payments",
        400,
      );
    }
  }

  const payment = await paymentService.updatePayment(id, vendorId, req.body);

  success(res, payment, "Payment updated successfully");
});

exports.deletePayment = asyncHandler(async (req, res) => {
  const vendorId =
    req.user?.role === "vendor" ? req.user.id : req.query.vendorId;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const { id } = req.params;

  if (!id || isNaN(id)) {
    return error(res, "Invalid payment ID", 400);
  }

  await paymentService.deletePayment(id, vendorId);

  success(res, null, "Payment deleted successfully");
});

exports.getPaymentStats = asyncHandler(async (req, res) => {
  const vendorId =
    req.user?.role === "vendor" ? req.user.id : req.query.vendorId;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const { fromDate, toDate } = req.query;

  const stats = await paymentService.getPaymentStats(vendorId, {
    fromDate,
    toDate,
  });

  success(res, stats, "Payment statistics retrieved successfully");
});

exports.getCustomerOutstanding = asyncHandler(async (req, res) => {
  const vendorId =
    req.user?.role === "vendor" ? req.user.id : req.query.vendorId;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const { customerId } = req.params;

  if (!customerId || isNaN(customerId)) {
    return error(res, "Invalid customer ID", 400);
  }

  const outstanding = await paymentService.getCustomerOutstanding(
    vendorId,
    customerId,
  );

  success(res, outstanding, "Customer outstanding retrieved successfully");
});

exports.getCustomerPendingInvoices = asyncHandler(async (req, res) => {
  const vendorId =
    req.user?.role === "vendor" ? req.user.id : req.query.vendorId;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  const { customerId } = req.params;

  if (!customerId || isNaN(customerId)) {
    return error(res, "Invalid customer ID", 400);
  }

  const invoices = await paymentService.getCustomerPendingInvoices(
    vendorId,
    customerId,
  );

  success(res, invoices, "Pending invoices retrieved successfully");
});
