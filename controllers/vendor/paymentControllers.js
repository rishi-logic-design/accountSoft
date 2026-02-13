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
    status,
    adjustedInvoices,
  } = req.body;

  const uploadedAttachments = Array.isArray(attachments) ? attachments : [];

  // Required field validation
  if (subType === "customer") {
    if (!customerId) {
      return error(
        res,
        "Customer is required when payment sub-type is customer",
        400,
      );
    }
  } else {
    if (customerId) {
      return error(
        res,
        `Customer should not be provided for sub-type ${subType}`,
        400,
      );
    }
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
    customerId: subType === "customer" ? customerId : null,
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
  const existingPayment = await PaymentModel.findOne({
    where: { id, vendorId },
  });

  if (!existingPayment) {
    return error(res, "Payment not found", 404);
  }

  if (parseFloat(existingPayment.openingBalance) > 0) {
    return error(res, "Opening balance cannot be edited", 400);
  }
  const { amount } = req.body;

  // Validate amount if updating
  if (amount !== undefined && parseFloat(amount) <= 0) {
    return error(res, "Amount must be greater than 0", 400);
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
  const payment = await PaymentModel.findOne({
    where: { id, vendorId },
  });

  if (!payment) {
    return error(res, "Payment not found", 404);
  }

  if (parseFloat(payment.openingBalance) > 0) {
    return error(res, "Opening balance cannot be deleted", 400);
  }
  await paymentService.deletePayment(id, vendorId);

  success(res, null, "Payment deleted successfully");
});

exports.setOpeningBalance = asyncHandler(async (req, res) => {
  const vendorId =
    req.user?.role === "vendor" ? req.user.id : req.body.vendorId;

  if (!vendorId) {
    return error(res, "Vendor ID required", 400);
  }

  const { method, amount } = req.body;

  const opening = await paymentService.setOpeningBalance(
    vendorId,
    method,
    amount,
  );

  success(res, opening, "Opening balance set successfully");
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
