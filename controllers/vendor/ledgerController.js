const asyncHandler = require("../../utils/asyncHandler");
const op = require("../../utils/op");
const {
  ChallanModel,
  TransactionModel,
  CustomerModel,
} = require("../../models");
const PDFDocument = require("pdfkit");
const { parser } = require("json2csv");
const challanModel = require("../../models/vendor/challanModel");

exports.getLedgerSummary = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { fromDate, toDate } = req.query;

  const dateFilter = {};
  if (fromDate && toDate) {
    dateFilter.createdAt = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  }

  const challans = await ChallanModel.findAll({
    where: { vendorId, ...dateFilter },
  });

  const totalInvoices = challans.reduce(
    (sum, c) => sum + Number(c.totalWithGST || 0),
    0
  );

  const payments = await TransactionModel.findAll({
    where: {
      vendorId,
      type: "payment",
      ...(fromDate &&
        toDate && {
          transactionDate: {
            [Op.between]: [new Date(fromDate), new Date(toDate)],
          },
        }),
    },
  });

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  success(res, {
    totalInvoices,
    outstanding: +(totalInvoices - totalPaid).toFixed(2),
  });
});

exports.exportLedger = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { fromDate, toDate, format = "pdf", sendEmail = false } = req.body;

  const challans = await ChallanModel.findAll({
    where: {
      vendorId,
      ...(fromDate &&
        toDate && {
          challanDate: {
            [Op.between]: [new Date(fromDate), new Date(toDate)],
          },
        }),
    },
    include: [{ model: CustomerModel, as: "customer" }],
    order: [["challanDate", "ASC"]],
  });

  if (!challans.length) {
    return error(res, "No ledger data found", 404);
  }

  if (format === "csv") {
    const parser = new Parser({
      fields: [
        "challanNumber",
        "challanDate",
        "customer.customerName",
        "totalWithGST",
        "status",
      ],
    });

    const csv = parser.parse(challans);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=ledger.csv");
    return res.send(csv);
  }

  const doc = new PDFDocument({ margin: 40 });
  const buffers = [];
  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => {
    const pdf = Buffer.concat(buffers);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=ledger.pdf");
    res.send(pdf);
  });

  doc.fontSize(18).text("Ledger Report", { align: "center" });
  doc.moveDown();

  challans.forEach((c, i) => {
    doc
      .fontSize(10)
      .text(
        `${i + 1}. ${c.challanNumber} | ${c.customer?.customerName || "-"} | ₹${
          c.totalWithGST
        } | ${c.status}`
      );
  });

  doc.end();
});
