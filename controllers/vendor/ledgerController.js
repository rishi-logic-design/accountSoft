const ledgerService = require("../../services/vendor/ledgerService");
const accountService = require("../../services/vendor/accountService");

exports.getCustomerList = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { search, page, size } = req.query;
    const result = await ledgerService.getCustomerList(vendorId, {
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCustomerLedger = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { customerId } = req.params;
    const { fromDate, toDate, search } = req.query;
    const result = await ledgerService.getCustomerLedger(vendorId, customerId, {
      fromDate,
      toDate,
      search,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

exports.getVendorList = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { search, page, size } = req.query;
    const result = await ledgerService.getVendorList(vendorId, {
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVendorLedger = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { sellerId } = req.params;
    const { fromDate, toDate, search } = req.query;
    const result = await ledgerService.getVendorLedger(vendorId, sellerId, {
      fromDate,
      toDate,
      search,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

exports.getAccountList = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { accountType, search } = req.query;
    const accounts = await accountService.getAccountList(vendorId, {
      accountType,
      search,
    });
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAccountLedger = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;
    const { fromDate, toDate, search } = req.query;
    const ledger = await accountService.getAccountLedger(vendorId, id, {
      fromDate,
      toDate,
      search,
    });
    res.json({ success: true, data: ledger });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const asyncHandler = require("../../utils/asyncHandler");
const { Op } = require("sequelize");
const {
  ChallanModel,
  TransactionModel,
  CustomerModel,
} = require("../../models");
const PDFDocument = require("pdfkit");
const { Parser } = require("json2csv");
const { success, error } = require("../../utils/apiResponse");
const {
  buildDateFilter,
  buildVendorFilter,
} = require("../../utils/filterUtils");

exports.getLedgerSummary = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { fromDate, toDate } = req.query;

  const dateFilter = buildDateFilter(fromDate, toDate, "createdAt");

  const challans = await ChallanModel.findAll({
    where: buildVendorFilter(vendorId, dateFilter),
  });

  const totalInvoices = challans.reduce(
    (sum, c) => sum + Number(c.totalWithGST || 0),
    0,
  );

  const transactionDateFilter = buildDateFilter(
    fromDate,
    toDate,
    "transactionDate",
  );

  const payments = await TransactionModel.findAll({
    where: {
      ...buildVendorFilter(vendorId),
      type: "payment",
      ...transactionDateFilter,
    },
  });

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  success(res, {
    totalInvoices,
    totalPaid,
    outstanding: +(totalInvoices - totalPaid).toFixed(2),
  });
});

exports.exportLedger = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { fromDate, toDate, format = "pdf" } = req.body;
  const challanDateFilter = buildDateFilter(fromDate, toDate, "challanDate");
  const transactionDateFilter = buildDateFilter(
    fromDate,
    toDate,
    "transactionDate",
  );

  const challans = await ChallanModel.findAll({
    where: buildVendorFilter(vendorId, challanDateFilter),
    include: [{ model: CustomerModel, as: "customer" }],
  });

  const transactions = await TransactionModel.findAll({
    where: buildVendorFilter(vendorId, transactionDateFilter),
    include: [{ model: CustomerModel, as: "customer" }],
  });

  const ledgerEntries = [];

  challans.forEach((c) => {
    ledgerEntries.push({
      date: new Date(c.challanDate),
      particulars: `${c.customer?.customerName || "Client"}\nSales Invoice`,
      vchType: "Sales",
      invoiceNo: c.challanNumber,
      debit: Number(c.totalWithGST || 0),
      credit: 0,
    });
  });

  transactions.forEach((t) => {
    ledgerEntries.push({
      date: new Date(t.transactionDate),
      particulars: `${t.customer?.customerName || "Client"}\nReceipt`,
      vchType: "Receipt",
      invoiceNo: t.referenceNumber || "-",
      debit: 0,
      credit: Number(t.amount || 0),
    });
  });

  ledgerEntries.sort((a, b) => a.date - b.date);

  if (!ledgerEntries.length) {
    return error(res, "No ledger data found", 404);
  }

  if (format === "csv") {
    const parser = new Parser({
      fields: [
        "date",
        "particulars",
        "vchType",
        "invoiceNo",
        "debit",
        "credit",
      ],
    });
    const csv = parser.parse(ledgerEntries);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=ledger.csv");
    return res.send(csv);
  }

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const buffers = [];
  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => {
    const pdf = Buffer.concat(buffers);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=ledger.pdf");
    res.send(pdf);
  });

  const formatDate = (date) => {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]}-${d.getFullYear()}`;
  };
  const formatCurrency = (amount) =>
    amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(req.user.companyName || "Company", 40, 40);
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("Ledger Account", 0, 100, { align: "center" });

  const startY = 150;
  doc.fontSize(8).font("Helvetica-Bold");
  doc.text("Date", 40, startY);
  doc.text("Particulars", 100, startY);
  doc.text("Vch Type", 250, startY);
  doc.text("Invoice No", 310, startY);
  doc.text("Debit", 380, startY, { align: "right" });
  doc.text("Credit", 440, startY, { align: "right" });
  doc
    .moveTo(40, startY + 15)
    .lineTo(570, startY + 15)
    .stroke();

  let currentY = startY + 25;
  ledgerEntries.forEach((entry) => {
    if (currentY > 700) {
      doc.addPage();
      currentY = 40;
    }
    doc.fontSize(8).font("Helvetica");
    doc.text(formatDate(entry.date), 40, currentY);
    doc.text(entry.particulars.split("\n")[0], 100, currentY);
    doc.text(entry.vchType, 250, currentY);
    doc.text(entry.invoiceNo, 310, currentY);
    if (entry.debit)
      doc.text(formatCurrency(entry.debit), 380, currentY, { align: "right" });
    if (entry.credit)
      doc.text(formatCurrency(entry.credit), 440, currentY, { align: "right" });
    currentY += 20;
  });

  doc.moveTo(40, currentY).lineTo(570, currentY).stroke();
  doc.end();
});
