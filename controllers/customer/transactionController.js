const transactionService = require("../../services/customer/transactionService");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");

exports.listTransactions = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : req.query.vendorId || req.user.id;
  const {
    page,
    size,
    type,
    customerId,
    billId,
    challanId,
    fromDate,
    toDate,
    search,
    sortBy,
    sortDir,
  } = req.query;
  const result = await transactionService.listTransactions({
    vendorId,
    page,
    size,
    type,
    customerId,
    billId,
    challanId,
    fromDate,
    toDate,
    search,
    sortBy,
    sortDir,
  });
  success(res, result);
});

exports.getTransaction = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : req.query.vendorId || req.user.id;
  const trx = await transactionService.getTransactionById(
    req.params.id,
    vendorId
  );
  success(res, trx);
});

exports.exportCsv = asyncHandler(async (req, res) => {
  const vendorId =
    req.user.role === "vendor"
      ? req.user.id
      : req.query.vendorId || req.user.id;
  const { type, customerId, billId, challanId, fromDate, toDate } = req.query;
  const csv = await transactionService.exportTransactionsCsv({
    vendorId,
    type,
    customerId,
    billId,
    challanId,
    fromDate,
    toDate,
  });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=transactions_${vendorId || "all"}.csv`
  );
  res.send(csv);
});
