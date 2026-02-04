const challanService = require("../../services/vendor/challanService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const { whatsappLink } = require("../../utils/whatsappHelper");
const notificationService = require("../../services/vendor/notificationService");



exports.createChallan = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const challan = await challanService.createChallan(vendorId, req.body);

  // 🔔 CREATE NOTIFICATION
  try {
    const totalQty =
      req.body.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
    await notificationService.createNotification({
      userId: vendorId,
      userRole: "VENDOR",
      title: "New Challan Created",
      message: `Challan #${challan.challanNumber} created - ${totalQty} items`,
      type: "TRANSACTION",
      level: "SUCCESS",
      entityType: "CHALLAN",
      entityId: challan.id,
    });
  } catch (notifError) {
    console.error("Failed to create notification:", notifError);
  }

  success(res, challan, "Challan created", 201);
});

exports.listChallans = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const {
    page,
    size,
    pageSize,
    search,
    fromDate,
    toDate,
    status,
    sortBy,
    sortOrder,
    customerId,
  } = req.query;
  const list = await challanService.listChallans({
    vendorId,
    customerId,
    page,
    size: size || pageSize,
    search,
    fromDate,
    toDate,
    status,
    sortBy,
    sortOrder,
  });
  success(res, list);
});

exports.getChallanById = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  const result = await challanService.getChallanById(req.params.id, vendorId);
  success(res, result);
});

exports.markChallanPaid = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const payload = req.body;
  const result = await challanService.markChallanPaid(
    req.params.id,
    vendorId,
    payload,
  );

  // 🔔 PAYMENT NOTIFICATION
  try {
    await notificationService.createNotification({
      userId: vendorId,
      userRole: "VENDOR",
      title: "Challan Payment Received",
      message: `Challan #${result.challan.challanNumber} payment recorded - ₹${payload.paymentAmount}`,
      type: "TRANSACTION",
      level: "SUCCESS",
      entityType: "PAYMENT",
      entityId: result.payment.id,
    });
  } catch (notifError) {
    console.error("Failed to create notification:", notifError);
  }

  success(res, result, "Payment processed");
});

exports.sendChallanWhatsapp = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.body.vendorId || req.user.id;
  const { phone, defaultMessage } =
    await challanService.getWhatsappDataForChallan(req.params.id, vendorId);
  if (!phone) return error(res, "Customer phone not found", 400);
  const message = req.body.message || defaultMessage;
  const link = whatsappLink(phone, message);
  success(res, { phone, link }, "WhatsApp link ready");
});

exports.deleteChallan = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor" ? req.user.id : req.query.vendorId;
  await challanService.deleteChallan(req.params.id, vendorId);

  // 🔔 DELETE NOTIFICATION
  try {
    await notificationService.createNotification({
      userId: vendorId,
      userRole: "VENDOR",
      title: "Challan Deleted",
      message: `Challan #${req.params.id} has been deleted`,
      type: "TRANSACTION",
      level: "WARNING",
      entityType: "CHALLAN",
      entityId: null,
    });
  } catch (notifError) {
    console.error("Failed to create notification:", notifError);
  }

  success(res, null, "Challan deleted");
});

exports.downloadChallanPdf = asyncHandler(async (req, res) => {
  const user = req.user || {};

  const vendorId = user.role === "vendor" ? user.id : req.query.vendorId;
  if (!vendorId) {
    return error(res, "vendorId is required for admin", 400);
  }

  const buffer = await challanService.generateChallanPdf(
    req.params.id,
    vendorId,
  );
  if (!buffer) {
    return error(res, "Failed to generate PDF", 500);
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=challan_${req.params.id}.pdf`,
  );

  res.send(buffer);
});
