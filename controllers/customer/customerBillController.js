const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const service = require("../../services/customer/createBillservice");
const billService = require("../../services/vendor/billService");

exports.getMyBills = asyncHandler(async (req, res) => {
  const customerId = req.user.id;

  const { page = 1, size = 20, search, status, fromDate, toDate } = req.query;

  const data = await service.list(customerId, {
    page,
    size,
    search,
    status,
    fromDate,
    toDate,
  });

  success(res, data);
});

exports.getMyBill = asyncHandler(async (req, res) => {
  const customerId = req.user.id;

  const bill = await service.getById(req.params.id, customerId);

  if (!bill) {
    return error(res, "Bill not found", 404);
  }
  const response = {
    ...bill.toJSON(),
    items: bill.items || [],
  };

  success(res, response);
});

exports.downloadBillByPdf = asyncHandler(async (req, res) => {
  const { billId } = req.params;
  const customerId = req.user.id; // from auth middleware

  const pdfBuffer = await billService.generateBillPdfForCustomer(
    billId,
    customerId,
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=bill-${billId}.pdf`,
  );

  res.send(pdfBuffer);
});
