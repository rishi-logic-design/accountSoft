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
    totalPaid,
    outstanding: +(totalInvoices - totalPaid).toFixed(2),
  });
});

exports.exportLedger = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { fromDate, toDate, format = "pdf", sendEmail = false } = req.body;

  // Fetch both challans and transactions
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
  });

  const transactions = await TransactionModel.findAll({
    where: {
      vendorId,
      ...(fromDate &&
        toDate && {
          transactionDate: {
            [Op.between]: [new Date(fromDate), new Date(toDate)],
          },
        }),
    },
    include: [{ model: CustomerModel, as: "customer" }],
  });

  // Combine and sort all entries by date
  const ledgerEntries = [];

  // Add challans as debit entries
  challans.forEach((c) => {
    ledgerEntries.push({
      date: new Date(c.challanDate),
      particulars: `${
        c.customer?.customerName || "Auditra"
      }\nSales - Export Invoice\nWithout I G S T`,
      vchType: "Sales",
      invoiceNo: c.challanNumber,
      debit: Number(c.totalWithGST || 0),
      credit: 0,
      type: "invoice",
    });
  });

  // Add transactions as credit entries
  transactions.forEach((t) => {
    ledgerEntries.push({
      date: new Date(t.transactionDate),
      particulars: `${t.customer?.customerName || "Auditra"}\nReceipt -\n${
        t.description || "online_transfer"
      }`,
      vchType: "Receipt",
      invoiceNo: t.referenceNumber || "-",
      debit: 0,
      credit: Number(t.amount || 0),
      type: "receipt",
    });
  });

  // Sort by date
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

  // Create PDF
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const buffers = [];
  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => {
    const pdf = Buffer.concat(buffers);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=ledger.pdf");
    res.send(pdf);
  });

  // Helper function to format date
  const formatDate = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Helper function to format currency
  const formatCurrency = (amount) => {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Get vendor/company details (you should fetch this from your User/Vendor model)
  const companyName = req.user.companyName || "Company Name";
  const companyAddress = req.user.address || "Company Address";

  // Header
  doc.fontSize(12).font("Helvetica-Bold").text(companyName, 40, 40);
  doc.fontSize(8).font("Helvetica").text(companyAddress, 40, 55);

  // Title
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("Ledger Account", 0, 100, { align: "center" });

  const dateRange = `${formatDate(
    fromDate || ledgerEntries[0].date
  )} to ${formatDate(toDate || ledgerEntries[ledgerEntries.length - 1].date)}`;
  doc
    .fontSize(9)
    .font("Helvetica")
    .text(dateRange, 0, 118, { align: "center" });

  // Table header
  const startY = 150;
  const lineY = startY + 15;

  doc.fontSize(8).font("Helvetica-Bold");
  doc.text("Date", 40, startY, { width: 60 });
  doc.text("Particulars", 100, startY, { width: 150 });
  doc.text("Vch Type", 250, startY, { width: 60 });
  doc.text("Invoice No", 310, startY, { width: 70 });
  doc.text("Debit", 380, startY, { width: 60, align: "right" });
  doc.text("Credit", 440, startY, { width: 60, align: "right" });
  doc.text("Balance", 500, startY, { width: 70, align: "right" });

  // Draw line under header
  doc.moveTo(40, lineY).lineTo(570, lineY).stroke();

  // Calculate opening balance (you can get this from previous period)
  let balance = 26000.0; // This should come from your database
  let currentY = lineY + 10;

  // Opening Balance Row
  doc.fontSize(8).font("Helvetica");
  doc.text("", 40, currentY, { width: 60 });
  doc.text("", 100, currentY, { width: 150 });
  doc.text("", 250, currentY, { width: 60 });
  doc.text("Opening Bal.", 310, currentY, { width: 70 });
  doc.text(formatCurrency(balance), 380, currentY, {
    width: 60,
    align: "right",
  });
  doc.text("", 440, currentY, { width: 60, align: "right" });
  doc.text("", 500, currentY, { width: 70, align: "right" });

  currentY += 20;

  // Add each ledger entry
  ledgerEntries.forEach((entry, index) => {
    // Check if we need a new page
    if (currentY > 700) {
      doc.addPage();
      currentY = 40;
    }

    // Calculate running balance
    balance += entry.debit - entry.credit;

    const dateStr = formatDate(entry.date);
    const particulars = entry.particulars.split("\n");

    // Date
    doc.fontSize(8).font("Helvetica");
    doc.text(dateStr, 40, currentY, { width: 60 });

    // Particulars (multiline)
    let particularY = currentY;
    particulars.forEach((line, i) => {
      doc.text(line, 100, particularY, { width: 150 });
      particularY += 10;
    });

    // Vch Type
    doc.text(entry.vchType, 250, currentY, { width: 60 });

    // Invoice No
    doc.text(entry.invoiceNo, 310, currentY, { width: 70 });

    // Debit
    if (entry.debit > 0) {
      doc.text(formatCurrency(entry.debit), 380, currentY, {
        width: 60,
        align: "right",
      });
    }

    // Credit
    if (entry.credit > 0) {
      doc.text(formatCurrency(entry.credit), 440, currentY, {
        width: 60,
        align: "right",
      });
    }

    // Balance
    const balanceStr = `${formatCurrency(Math.abs(balance))} ${
      balance >= 0 ? "Dr" : "Cr"
    }`;
    doc.text(balanceStr, 500, currentY, { width: 70, align: "right" });

    // Move to next row (account for multiline particulars)
    currentY = Math.max(currentY, particularY) + 15;
  });

  // Draw final line
  doc.moveTo(40, currentY).lineTo(570, currentY).stroke();

  doc.end();
});
